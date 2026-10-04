import { layerAccentIds } from './layer-accent';
import { createGraphSchema } from './compositing-graph-schema';
import { effectDefinitions } from './effect-model';
import { z } from 'zod';
import { interpolationSchema, curvePointSchema } from './animation-engine';
import { layerProperties, blendModes, effectKinds } from './project-model';

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
export const propertySchema = <T extends z.ZodType>(value: T) =>
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
              incoming: curvePointSchema.optional(),
              outgoing: curvePointSchema.optional(),
              spatialIncoming: vec2Schema.optional(),
              spatialOutgoing: vec2Schema.optional(),
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
export const animValueSchema = z.union([
  z.number().finite(),
  vec2Schema,
  z.array(z.number().finite()).max(12000),
]);
export const graphSchema = createGraphSchema(propertySchema(animValueSchema));
export const editorSchema = z
  .object({
    graph: graphSchema.optional(),
    properties: z.record(z.string().max(100), propertySchema(animValueSchema)),
    parentId: idSchema.nullable(),
    inPoint: z.number().nonnegative(),
    outPoint: z.number().positive().max(3600),
    startTime: z.number().finite(),
    blendMode: z.enum(blendModes),
    is3D: z.boolean(),
    pathClosed: z.boolean(),
    gradient: z.enum(['none', 'linear', 'radial']),
    textAlign: z.enum(['left', 'center', 'right']),
    strokeJoin: z.enum(['round', 'bevel', 'miter']),
    strokeCap: z.enum(['round', 'butt', 'square']),
    masks: z
      .array(
        z
          .object({
            id: idSchema,
            kind: z.enum(['rectangle', 'ellipse', 'path']),
            mode: z.enum(['add', 'subtract', 'intersect']),
            enabled: z.boolean(),
            path: propertySchema(
              z
                .array(z.number().finite())
                .min(6)
                .max(12000)
                .refine(
                  (v) => v.length % 6 === 0,
                  '路径点必须包含位置及两个切线',
                ),
            ),
            opacity: propertySchema(z.number().min(0).max(1)),
            feather: propertySchema(z.number().min(0).max(500)),
            expansion: propertySchema(z.number().min(-1000).max(1000)),
          })
          .strict(),
      )
      .max(100),
    effects: z
      .array(
        z
          .object({
            id: idSchema,
            kind: z.enum(effectKinds),
            enabled: z.boolean(),
            parameters: z.record(
              z.string().max(100),
              propertySchema(z.number().finite().min(-10000).max(10000)),
            ),
          })
          .strict(),
      )
      .max(100)
      .optional(),
  })
  .strict()
  .refine((v) => v.outPoint > v.inPoint, '出点必须晚于入点')
  .superRefine((e, ctx) => {
    if (e.graph && e.effects?.length)
      ctx.addIssue({ code: 'custom', message: '不能同时保存效果栈与节点图' });
    for (const effect of e.effects ?? []) {
      const definition = effectDefinitions[effect.kind];
      if (
        Object.keys(effect.parameters).length !==
        Object.keys(definition.parameters).length
      )
        ctx.addIssue({
          code: 'custom',
          message: '效果参数不完整',
          path: ['effects'],
        });
      for (const [key, property] of Object.entries(effect.parameters)) {
        const spec = definition.parameters[key];
        if (
          !spec ||
          [property.baseValue, ...property.keyframes.map((k) => k.value)].some(
            (v) => v < spec.min || v > spec.max,
          )
        )
          ctx.addIssue({
            code: 'custom',
            message: '效果参数类型或范围无效',
            path: ['effects', key],
          });
      }
      if (
        effect.kind === 'levels' &&
        (effect.parameters.black?.baseValue ?? 0) >=
          (effect.parameters.white?.baseValue ?? 1)
      )
        ctx.addIssue({
          code: 'custom',
          message: '白场必须大于黑场',
          path: ['effects'],
        });
    }

    for (const [key, p] of Object.entries(e.properties)) {
      const values = [p.baseValue, ...p.keyframes.map((k) => k.value)];
      for (const v of values) {
        let valid = true;
        if (['anchor'].includes(key))
          valid = !!v && typeof v === 'object' && !Array.isArray(v) && 'x' in v;
        else if (['fill', 'stroke', 'gradientEnd'].includes(key))
          valid =
            Array.isArray(v) &&
            v.length === 4 &&
            v.every((n) => n >= 0 && n <= 1);
        else if (
          [
            'position3D',
            'rotation3D',
            'scale3D',
            'anchor3D',
            'cameraPosition',
            'cameraRotation',
          ].includes(key)
        )
          valid = Array.isArray(v) && v.length === 3;
        else if (key === 'path')
          valid = Array.isArray(v) && v.length >= 6 && v.length % 6 === 0;
        else
          valid =
            typeof v === 'number' &&
            (![
              'strokeWidth',
              'fontSize',
              'lineHeight',
              'cameraZoom',
              'sides',
            ].includes(key) ||
              v >= 0);
        if (!valid)
          ctx.addIssue({
            code: 'custom',
            message: '属性值类型或范围无效',
            path: ['properties', key],
          });
      }
    }
  });
const layerBase = {
  id: idSchema,
  name: z.string().min(1).max(200),
  visible: z.boolean(),
  locked: z.boolean(),
  width: z.number().positive().max(16384),
  height: z.number().positive().max(16384),
  transform: transformSchema,
  editor: editorSchema.optional(),
  semantic: semanticSchema.optional(),
  ui: z
    .object({ accentColorId: z.enum(layerAccentIds).optional() })
    .strict()
    .optional(),
};
export const layerSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...layerBase,
      type: z.literal('shape'),
      shapeKind: z.enum(['rectangle', 'ellipse', 'polygon', 'star', 'path']),
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
  z
    .object({
      ...layerBase,
      type: z.enum(['solid', 'null', 'precomp', 'camera']),
      compositionId: idSchema.optional(),
    })
    .strict(),
]);
export const assetSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(200),
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
    dataUrl: z.string().max(14_000_000),
    source: z
      .object({
        kind: z.literal('linked'),
        path: z
          .string()
          .min(1)
          .max(32768)
          .refine((v) => !v.includes('\0')),
        metadata: z
          .object({
            width: z.number().nonnegative().max(100000),
            height: z.number().nonnegative().max(100000),
            size: z.number().nonnegative().max(10_000_000),
            modifiedAt: z.number().nonnegative(),
          })
          .strict(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (asset) =>
      asset.source
        ? /^swayframe-asset:\/\/local\/[a-f0-9]{64}$/.test(asset.dataUrl)
        : asset.dataUrl.startsWith(`data:${asset.mimeType};base64,`) &&
          /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(
            asset.dataUrl,
          ),
    'Asset MIME 或引用无效',
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
    backgroundColor: colorSchema.optional(),
  })
  .strict();
export const projectSchema = z
  .object({
    schemaVersion: z.literal('0.6.0'),
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
    const visit = (id: string, ancestors: Set<string>) => {
      if (ancestors.has(id)) {
        issue('合成嵌套存在循环', ['compositions']);
        return;
      }
      const next = new Set(ancestors);
      next.add(id);
      for (const l of project.compositions.find((c) => c.id === id)?.layers ??
        [])
        if (l.type === 'precomp' && l.compositionId)
          visit(l.compositionId, next);
    };
    for (const c of project.compositions) visit(c.id, new Set());
    project.compositions.forEach((c, ci) => {
      addId(c.id, ['compositions', ci, 'id']);
      const parents = new Map(c.layers.map((l) => [l.id, l.editor?.parentId]));
      for (const l of c.layers) {
        const seen = new Set<string>([l.id]);
        let id = l.editor?.parentId;
        while (id) {
          if (seen.has(id) || !parents.has(id)) {
            issue('父级引用不存在或存在循环', ['compositions', ci, 'layers']);
            break;
          }
          seen.add(id);
          id = parents.get(id);
        }
      }
      c.layers.forEach((layer, li) => {
        const path = ['compositions', ci, 'layers', li];
        addId(layer.id, [...path, 'id']);
        if (
          layer.type === 'image' &&
          !project.assets.some((a) => a.id === layer.assetId)
        )
          issue('引用的 Image asset 不存在', [...path, 'assetId']);
        if (
          layer.type === 'precomp' &&
          !project.compositions.some((v) => v.id === layer.compositionId)
        )
          issue('预合成引用不存在', [...path, 'compositionId']);
        const graph = layer.editor?.graph;
        if (graph) {
          if (graph.owner.id !== layer.id) issue('图所属图层不匹配', path);
          for (const id of [
            graph.id,
            ...graph.nodes.map((n) => n.id),
            ...graph.edges.map((e) => e.id),
          ])
            addId(id, [...path, 'editor', 'graph']);
        }
        for (const e of [
          ...(layer.editor?.masks ?? []),
          ...(layer.editor?.effects ?? []),
        ])
          addId(e.id, [...path, 'editor', 'id']);
        for (const { key, property: p } of layerProperties(layer)) {
          addId(p.id, [...path, 'transform', key, 'id']);
          const times = new Set<number>();
          p.keyframes.forEach((frame, ki) => {
            const kp = [...path, 'transform', key, 'keyframes', ki];
            addId(frame.id, [...kp, 'id']);
            if (times.has(frame.time) || frame.time > c.duration)
              issue('关键帧时间重复或超出合成时长', [...kp, 'time']);
            if (
              (frame.spatialIncoming || frame.spatialOutgoing) &&
              (key !== 'transform.position' ||
                typeof frame.value !== 'object' ||
                Array.isArray(frame.value))
            )
              issue('空间控制点只支持二维位置属性', kp);
            times.add(frame.time);
          });
        }
      });
    });
  });
