import { z } from 'zod';
import { interpolationSchema } from './animation-engine';
import { transformKeys } from './project-model';

export const idSchema = z.string().uuid();
export const vec2Schema = z
  .object({ x: z.number().finite(), y: z.number().finite() })
  .strict();
export const colorSchema = z
  .object({
    r: z.number().min(0).max(1),
    g: z.number().min(0).max(1),
    b: z.number().min(0).max(1),
    a: z.number().min(0).max(1),
  })
  .strict();
export const semanticSchema = z
  .object({
    semanticRole: z.string().max(200).optional(),
    visualRole: z.string().max(200).optional(),
    importance: z.number().min(0).max(1).optional(),
    tags: z.array(z.string().max(200)).max(100).optional(),
  })
  .strict();
const propertySchema = <T extends z.ZodType>(value: T) =>
  z
    .object({
      id: idSchema,
      baseValue: value,
      keyframes: z
        .array(
          z
            .object({
              id: idSchema,
              time: z.number().nonnegative(),
              value,
              interpolation: interpolationSchema,
            })
            .strict(),
        )
        .max(10000),
    })
    .strict();
const transformSchema = z
  .object({
    position: propertySchema(vec2Schema),
    scale: propertySchema(vec2Schema),
    rotation: propertySchema(z.number().finite()),
    opacity: propertySchema(z.number().min(0).max(1)),
  })
  .strict();
const layerBase = {
  id: idSchema,
  name: z.string().min(1).max(200),
  visible: z.boolean(),
  locked: z.boolean(),
  width: z.number().positive().max(16384),
  height: z.number().positive().max(16384),
  transform: transformSchema,
  semantic: semanticSchema.optional(),
};
export const layerSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...layerBase,
      type: z.literal('shape'),
      shapeKind: z.enum(['rectangle', 'ellipse']),
      fill: colorSchema,
    })
    .strict(),
  z
    .object({
      ...layerBase,
      type: z.literal('text'),
      text: z.string().max(10000),
      fontSize: z.number().positive().max(1000),
      fontFamily: z.string().min(1).max(200),
      fill: colorSchema,
    })
    .strict(),
  z
    .object({ ...layerBase, type: z.literal('image'), assetId: idSchema })
    .strict(),
]);
export const assetSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(200),
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
    dataUrl: z
      .string()
      .max(14_000_000)
      .regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/),
  })
  .strict()
  .refine(
    (asset) => asset.dataUrl.startsWith(`data:${asset.mimeType};base64,`),
    'Asset MIME 与 dataUrl 不一致',
  );
export const compositionSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(200),
    width: z.number().positive().max(16384),
    height: z.number().positive().max(16384),
    fps: z.number().positive().max(240),
    duration: z.number().positive().max(3600),
    layers: z.array(layerSchema).max(500),
  })
  .strict();
export const projectSchema = z
  .object({
    schemaVersion: z.literal('0.1.0'),
    id: idSchema,
    name: z.string().min(1).max(200),
    compositions: z.array(compositionSchema).min(1).max(100),
    activeCompositionId: idSchema,
    assets: z.array(assetSchema).max(500),
  })
  .strict()
  .superRefine((project, ctx) => {
    const ids = new Set<string>();
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: 'custom', message, path });
    const addId = (id: string, path: (string | number)[]) => {
      if (ids.has(id)) issue('实体 ID 重复', path);
      ids.add(id);
    };
    addId(project.id, ['id']);
    project.assets.forEach((asset, i) => addId(asset.id, ['assets', i, 'id']));
    if (!project.compositions.some((c) => c.id === project.activeCompositionId))
      issue('活动 合成不存在', ['activeCompositionId']);
    project.compositions.forEach((c, ci) => {
      addId(c.id, ['compositions', ci, 'id']);
      c.layers.forEach((layer, li) => {
        const path = ['compositions', ci, 'layers', li];
        addId(layer.id, [...path, 'id']);
        if (
          layer.type === 'image' &&
          !project.assets.some((a) => a.id === layer.assetId)
        )
          issue('引用的 Image asset 不存在', [...path, 'assetId']);
        for (const key of transformKeys) {
          const p = layer.transform[key];
          addId(p.id, [...path, 'transform', key, 'id']);
          const times = new Set<number>();
          p.keyframes.forEach((frame, ki) => {
            const kp = [...path, 'transform', key, 'keyframes', ki];
            addId(frame.id, [...kp, 'id']);
            if (times.has(frame.time) || frame.time > c.duration)
              issue('关键帧时间重复或超出合成时长', [...kp, 'time']);
            times.add(frame.time);
          });
        }
      });
    });
  });
