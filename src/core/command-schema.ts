import { z } from 'zod';
import {
  graphSchema,
  assetSchema,
  vec2Schema,
  colorSchema,
  idSchema,
  layerSchema,
  projectSchema,
  semanticSchema,
  animValueSchema,
  compositionSchema,
} from './project-schema';
import { interpolationSchema, curvePointSchema } from './animation-engine';

const spatialControl = z.union([
  vec2Schema,
  z.array(z.number().finite()).length(3),
]);
const value = animValueSchema;
const index = z.number().int().nonnegative().optional();
const frame = z
  .object({
    id: idSchema,
    time: z.number().nonnegative(),
    value,
    interpolation: interpolationSchema,
    incoming: curvePointSchema.optional(),
    outgoing: curvePointSchema.optional(),
    spatialIncoming: spatialControl.optional(),
    spatialOutgoing: spatialControl.optional(),
  })
  .strict();
const identity = { id: idSchema };
export const commandSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...identity,
      type: z.literal('graph.replace'),
      compositionId: idSchema,
      layerId: idSchema,
      graph: graphSchema.nullable(),
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('layer.replace'),
      compositionId: idSchema,
      layer: layerSchema,
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('composition.add'),
      composition: compositionSchema,
      index,
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('composition.remove'),
      compositionId: idSchema,
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('composition.replace'),
      composition: compositionSchema,
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('project.activate'),
      compositionId: idSchema,
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('layer.create'),
      compositionId: idSchema,
      layer: layerSchema,
      index,
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('layer.delete'),
      compositionId: idSchema,
      layerId: idSchema,
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('layer.reorder'),
      compositionId: idSchema,
      layerId: idSchema,
      toIndex: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('layer.patch'),
      compositionId: idSchema,
      layerId: idSchema,
      patch: z
        .object({
          name: z.string().min(1).max(200).optional(),
          visible: z.boolean().optional(),
          locked: z.boolean().optional(),
          semantic: semanticSchema.nullable().optional(),
          text: z.string().max(10000).optional(),
          fill: colorSchema.optional(),
          fontSize: z.number().positive().max(1000).optional(),
          fontFamily: z.string().min(1).max(200).optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('property.setBase'),
      propertyId: idSchema,
      value,
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('keyframe.add'),
      propertyId: idSchema,
      keyframe: frame,
      index,
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('keyframe.update'),
      propertyId: idSchema,
      keyframeId: idSchema,
      patch: z
        .object({
          time: z.number().nonnegative().optional(),
          value: value.optional(),
          interpolation: interpolationSchema.optional(),
          incoming: curvePointSchema.nullable().optional(),
          outgoing: curvePointSchema.nullable().optional(),
          spatialIncoming: spatialControl.nullable().optional(),
          spatialOutgoing: spatialControl.nullable().optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('keyframe.delete'),
      propertyId: idSchema,
      keyframeId: idSchema,
    })
    .strict(),
  z
    .object({
      ...identity,
      type: z.enum(['asset.add', 'asset.replace']),
      asset: assetSchema,
      index,
    })
    .strict(),
  z
    .object({ ...identity, type: z.literal('asset.remove'), assetId: idSchema })
    .strict(),
  z
    .object({
      ...identity,
      type: z.literal('project.replace'),
      project: projectSchema,
    })
    .strict(),
]);
export const transactionSchema = z
  .object({
    id: idSchema,
    label: z.string().min(1).max(300),
    source: z.enum(['human', 'agent', 'system']),
    commands: z.array(commandSchema).min(1).max(500),
    createdAt: z.number().finite().nonnegative(),
  })
  .strict()
  .refine(
    (tx) => new Set(tx.commands.map((c) => c.id)).size === tx.commands.length,
    'Command ID 重复',
  );
