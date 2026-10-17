import { z } from 'zod';
import { effectKinds } from '../core/project-model';
import { stepReferences } from '../agent/object-reference';
import {
  animValueSchema,
  colorSchema,
  idSchema,
  vec2Schema,
} from '../core/project-schema';
import { interpolationSchema } from '../core/animation-engine';
import { radialGradientDefinition } from '../core/radial-gradient';
import { capabilityParametersSchema } from '../agent/capability-schema';

// Thin adapters to existing native tool definitions, not a second registry.
export const nativeCreateTools = [
  'createLayer',
  'createPolygon',
  'createStar',
  'createPath',
  'createLayerFromAsset',
] as const;
export const nativeEditTools = [
  'setAnchor',
  'setStroke',
  'setTextContent',
  'setTextColor',
  'setTextAlignment',
  'setTracking',
  'setLeading',
  'renameLayer',
  'reorderLayer',
  'setLayerVisibility',
  'setParent',
  'replaceAssetReference',
  'removeEffect',
  'setEffectParameter',
  'enableEffect',
  'reorderEffect',
  'createMask',
  'setMaskMode',
  'setMaskPath',
  'setMaskFeather',
  'setMaskOpacity',
  'setMaskExpansion',
  'addKeyframe',
  'moveKeyframe',
  'setKeyframeValue',
  'setInterpolation',
  'deleteKeyframe',
] as const;
const nativeArgs = z.record(z.string(), z.json());
const actionId = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);
export const layerReferenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('existing'), id: idSchema }).strict(),
  z.object({ kind: z.literal('selection') }).strict(),
  z.object({ kind: z.literal('result'), actionId }).strict(),
]);
export type LayerReference = z.infer<typeof layerReferenceSchema>;
const common = {
  id: actionId,
  dependsOn: z.array(actionId).max(40).default([]),
};
const creation = {
  name: z.string().min(1).max(200).optional(),
  width: z.number().positive().max(16384).optional(),
  height: z.number().positive().max(16384).optional(),
  position: vec2Schema.optional(),
};
export const actionSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...common,
      type: z.literal('createNative'),
      tool: z.enum(nativeCreateTools),
      args: nativeArgs,
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('editNative'),
      target: layerReferenceSchema,
      tool: z.enum(nativeEditTools),
      args: nativeArgs,
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('createShape'),
      shape: z.enum(['rectangle', 'ellipse']),
      ...creation,
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('createText'),
      ...creation,
      content: z.string().max(10000),
      fontFamily: z.string().min(1).max(200).optional(),
      fontSize: z.number().min(1).max(2000).optional(),
      color: colorSchema.optional(),
      alignment: z.enum(['left', 'center', 'right']).optional(),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('setDimensions'),
      target: layerReferenceSchema,
      width: z.number().positive().max(16384),
      height: z.number().positive().max(16384),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('setFont'),
      target: layerReferenceSchema,
      fontFamily: z.string().min(1).max(200),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('deleteKeyframe'),
      target: layerReferenceSchema,
      property: z.enum(['position', 'scale', 'rotation', 'opacity']),
      keyframeId: idSchema,
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('setProperty'),
      target: layerReferenceSchema,
      property: z.enum([
        'position',
        'scale',
        'rotation',
        'opacity',
        'fontSize',
      ]),
      value: z.union([vec2Schema, z.number().finite()]),
      time: z.number().finite().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('setFill'),
      target: layerReferenceSchema,
      color: colorSchema,
      gradient: z.enum(['none', 'linear', 'radial']).optional(),
      endColor: colorSchema.optional(),
      radialParameters: capabilityParametersSchema(
        radialGradientDefinition,
      ).optional(),
      time: z.number().finite().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('addEffect'),
      target: layerReferenceSchema,
      effect: z.enum(effectKinds),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('addKeyframe'),
      target: layerReferenceSchema,
      property: z.enum(['position', 'scale', 'rotation', 'opacity']),
      time: z.number().finite().nonnegative(),
      value: animValueSchema,
      interpolation: interpolationSchema.optional(),
    })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('modifyKeyframe'),
      target: layerReferenceSchema,
      property: z.enum(['position', 'scale', 'rotation', 'opacity']),
      keyframe: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('existing'), id: idSchema }).strict(),
        z.object({ kind: z.literal('result'), actionId }).strict(),
      ]),
      interpolation: interpolationSchema,
    })
    .strict(),
]);
export type SemanticAction = z.infer<typeof actionSchema>;
export const intentSchema = z
  .object({
    goal: z.string().min(1).max(4000),
    actions: z.array(actionSchema).min(1).max(100),
  })
  .strict();
export type TaskIntent = z.infer<typeof intentSchema>;
/** Mapping only: schemas, permissions and commands remain in the actual registry. */
export function executionTool(action: SemanticAction) {
  switch (action.type) {
    case 'createNative':
    case 'editNative':
      return action.tool;
    case 'setDimensions':
      return 'setLayerDimensions';
    case 'setFont':
      return 'setFont';
    case 'deleteKeyframe':
      return 'deleteKeyframe';
    case 'createShape':
      return action.shape === 'rectangle' ? 'createRectangle' : 'createEllipse';
    case 'createText':
      return 'createText';
    case 'setProperty':
      return action.property === 'position'
        ? 'setPosition'
        : action.property === 'fontSize'
          ? 'setFontSize'
          : action.property === 'scale'
            ? 'setScale'
            : action.property === 'rotation'
              ? 'setRotation'
              : 'setOpacity';
    case 'setFill':
      return 'setFill';
    case 'addEffect':
      return 'addEffect';
    case 'addKeyframe':
      return 'addKeyframe';
    case 'modifyKeyframe':
      return 'setInterpolation';
  }
}
export function dependencies(action: SemanticAction) {
  const references =
    'target' in action && action.target.kind === 'result'
      ? [action.target.actionId]
      : [];
  if (action.type === 'modifyKeyframe' && action.keyframe.kind === 'result')
    references.push(action.keyframe.actionId);
  if (action.type === 'createNative' || action.type === 'editNative')
    for (const ref of stepReferences(action.args))
      if (ref.kind === 'stepResult') references.push(ref.stepId);
  return [...new Set([...action.dependsOn, ...references])];
}
