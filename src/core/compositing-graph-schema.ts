import { validateNode } from './compositing-registry';
import { z } from 'zod';
import { portTypes, validateGraph } from './compositing-graph';
import type { CompositingGraph } from './compositing-graph';
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
