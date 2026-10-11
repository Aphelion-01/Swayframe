import { z } from 'zod';
const bounds = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .strict();
/** Vision-generated observations only; no fixed image descriptions or Scene mutation. */
export const referenceAnalysisSchema = z
  .object({
    canvas: z
      .object({
        width: z.number().positive(),
        height: z.number().positive(),
        background: z.string().max(300),
      })
      .strict(),
    visualElements: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            type: z.enum([
              'background',
              'geometry',
              'text',
              'shadow',
              'decoration',
            ]),
            bounds,
            position: z.string().max(300),
            layering: z.number().int(),
            geometry: z.string().max(500),
            colors: z.array(z.string().max(200)).max(20),
            gradients: z.array(z.string().max(300)).max(10),
            effects: z.array(z.string().max(200)).max(10),
            typography: z.string().max(500),
            dependencies: z.array(z.string().max(100)).max(20),
            confidence: z.number().min(0).max(1),
            mapping: z.string().min(1).max(500),
          })
          .strict(),
      )
      .min(1)
      .max(40),
    spatialRelationships: z.array(z.string().max(500)).max(40),
    limitations: z.array(z.string().max(500)).max(20),
    confidence: z.number().min(0).max(1),
  })
  .strict()
  .superRefine((a, ctx) => {
    const ids = new Set(a.visualElements.map((e) => e.id));
    if (ids.size !== a.visualElements.length)
      ctx.addIssue({ code: 'custom', message: '视觉元素标识重复' });
    for (const e of a.visualElements)
      for (const id of e.dependencies)
        if (!ids.has(id) || id === e.id)
          ctx.addIssue({ code: 'custom', message: '视觉元素依赖无效：' + id });
    const elements = new Map(a.visualElements.map((e) => [e.id, e]));
    const visited = new Set<string>(),
      visiting = new Set<string>();
    const visit = (id: string): boolean => {
      if (visiting.has(id)) return false;
      if (visited.has(id)) return true;
      visiting.add(id);
      for (const dependency of elements.get(id)?.dependencies ?? [])
        if (!visit(dependency)) return false;
      visiting.delete(id);
      visited.add(id);
      return true;
    };
    if (a.visualElements.some((e) => !visit(e.id)))
      ctx.addIssue({ code: 'custom', message: '视觉元素依赖存在循环' });
  });
export type ReferenceAnalysis = z.infer<typeof referenceAnalysisSchema>;
