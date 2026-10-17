import { validateNode } from './compositing-registry';
import { z } from 'zod';
import { portTypes, validateGraph } from './compositing-graph';
import type { CompositingGraph } from './compositing-graph';
function boundedEffectJSON(value: unknown): boolean {
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let count = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++count > 10000 || item.depth > 24) return false;
    if (item.value && typeof item.value === 'object')
      for (const v of Object.values(item.value))
        stack.push({ value: v, depth: item.depth + 1 });
  }
  return JSON.stringify(value).length <= 262144;
}
export function createGraphSchema<T extends z.ZodType>(property: T) {
  const id = z.string().uuid(),
    vec = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();
  const port = z
    .object({
      id: z.string().min(1).max(80),
      name: z.string().max(80),
      type: z.enum(portTypes),
      required: z.boolean().optional(),
    })
    .strict();
  const ref = z
    .object({ nodeId: id, portId: z.string().min(1).max(80) })
    .strict();
  return z
    .object({
      id,
      version: z.literal(1),
      owner: z.object({ type: z.enum(['layer', 'composition']), id }).strict(),
      nodes: z
        .array(
          z
            .object({
              id,
              type: z.string().min(1).max(80),
              name: z.string().min(1).max(200),
              position: vec,
              inputs: z.array(port).max(20),
              outputs: z.array(port).max(20),
              params: z.record(z.string().max(100), property),
              enabled: z.boolean(),
              effectPackage: z
                .custom<import('./programmable-effect').EffectPackage>(
                  boundedEffectJSON,
                  '效果包超过资源限制',
                )
                .transform(
                  (value) =>
                    value as import('./programmable-effect').EffectPackage,
                )
                .optional(),
              metadata: z
                .object({
                  source: z.enum(['human', 'agent', 'system']).optional(),
                })
                .strict()
                .optional(),
            })
            .strict(),
        )
        .min(2)
        .max(200),
      edges: z.array(z.object({ id, from: ref, to: ref }).strict()).max(1000),
      outputNodeId: id,
    })
    .strict()
    .superRefine((g, ctx) => {
      for (const n of g.nodes)
        for (const message of validateNode(
          n as import('./compositing-graph').GraphNode,
        ))
          ctx.addIssue({ code: 'custom', message });
      for (const e of validateGraph(g as CompositingGraph))
        ctx.addIssue({ code: 'custom', message: e.message });
    });
}
