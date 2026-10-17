import { z } from 'zod';
import { animValueSchema, idSchema } from '../core/project-schema';
export const ownerSchema = z
  .object({ projectId: idSchema, revision: z.string().min(1).max(100) })
  .strict();
export const layerQuery = ownerSchema.extend({ layerId: idSchema }).strict();
export const writeSchema = ownerSchema.extend({ requestId: idSchema }).strict();
export const propertyRequest = writeSchema
  .extend({
    layerId: idSchema,
    property: z.string().min(1).max(256),
    value: animValueSchema,
    time: z.number().finite().nonnegative(),
  })
  .strict();
export const importRequest = writeSchema
  .extend({
    compositionId: idSchema,
    directory: z.string().min(1).max(4096),
  })
  .strict();
export const renderRequest = ownerSchema
  .extend({
    compositionId: idSchema,
    time: z.number().finite().nonnegative(),
    maxDimension: z.number().int().min(2).max(2048).default(1024),
  })
  .strict();
