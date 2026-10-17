import { z } from 'zod';
import { idSchema } from '../core/project-schema';
export const executionScopeSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('FULL_COMPOSITION'), compositionId: idSchema })
    .strict(),
  ...(['PARAMETER_ONLY', 'SELECTED_NODE', 'SELECTED_BRANCH'] as const).map(
    (kind) =>
      z
        .object({
          kind: z.literal(kind),
          compositionId: idSchema,
          layerId: idSchema,
          nodeIds: z.array(idSchema).min(1).max(200),
        })
        .strict(),
  ),
]);
export type ExecutionScope = z.infer<typeof executionScopeSchema>;
export const creationTaskSchema = z
  .object({
    id: z.string().min(1).max(100),
    description: z.string().min(1).max(400),
    executionDomain: z.enum([
      'scene',
      'canvas',
      'property',
      'animation',
      'compositing',
      'generation',
      'effect-forge',
    ]),
    strategy: z.enum([
      'modify-existing',
      'reuse',
      'compose',
      'generate',
      'forge',
    ]),
    capabilityId: z.string().max(100),
    stepIds: z.array(z.string().min(1)).min(1).max(100),
    dependencies: z.array(z.string().min(1)).max(100),
  })
  .strict();
export const creationDetailsSchema = z
  .object({
    intent: z.string().min(1).max(1000),
    tasks: z.array(creationTaskSchema).min(1).max(100),
    warnings: z.array(z.string().max(500)).max(20).default([]),
  })
  .strict();
export type CreationDetails = z.infer<typeof creationDetailsSchema>;
