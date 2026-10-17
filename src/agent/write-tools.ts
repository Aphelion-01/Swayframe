import { z } from 'zod';
import { capabilityParametersSchema } from './capability-schema';
import { AgentExecutionError } from './execution-error';
import {
  radialGradientDefinition,
  gradientPropertyKey,
} from '../core/radial-gradient';
import { parameterError } from '../core/visual-capabilities';
import { command, CommandSystem, transaction } from '../core/command-system';
import type { Command } from '../core/command-system';
import {
  activeComposition,
  createLayer,
  createProperty,
  findProperty,
  layerProperties,
  effectKinds,
} from '../core/project-model';
import type { Layer, LayerKind } from '../core/project-model';
import {
  idSchema,
  vec2Schema,
  colorSchema,
  animValueSchema,
} from '../core/project-schema';
import { cloneLayer, animationEdit } from '../core/editing-commands';
import {
  parentCommands,
  precomposeCommands,
} from '../core/composition-editing';
import {
  deleteLayerCommands,
  transformEditCommands,
} from '../core/transform-editing';
import {
  evaluateProperty,
  interpolationSchema,
} from '../core/animation-engine';
import { createRenderSnapshot } from '../core/renderer-core';
import { createTransformContext } from '../core/transform-resolvers';
import {
  defaultTransformSettings,
  transformOrientations,
  transformPivotModes,
} from '../core/transform-context';
import { transformItems } from '../core/transform-operations';
import type { TransformOperation } from '../core/transform-operations';
import { motionCurveSchema, resolveMotionSegment } from '../core/motion-curve';
import { applyMotionCurveCommands } from '../core/motion-curve-commands';
import { reverseMotionCurve } from '../core/motion-curve-operations';
import { compileCompositingTool } from '../core/compositing-tools';
import { graphCommand } from '../core/compositing-commands';
import {
  reorderGraphEffects,
  linearGraphEffects,
} from '../core/compositing-migration';
import { AgentToolError, AgentToolRegistry } from './tool-registry';
import type { AgentToolContext } from './tool-registry';
const layerRef = { layerId: idSchema };
const at = { time: z.number().finite().nonnegative().optional() };
const optionalName = z.string().min(1).max(200).optional();
export function editableLayer(context: AgentToolContext, id: string) {
  const c = activeComposition(context.project);
  const layer = c.layers.find((l) => l.id === id);
  if (!layer)
    throw new AgentExecutionError({
      code: 'CONTEXT_INVALID',
      phase: 'compile',
      field: 'layerId',
      targetId: id,
      received: id,
      expected: 'existing layer in active composition',
      recoverable: true,
      message: '当前合成中不存在目标图层',
    });
  if (layer.locked)
    throw new AgentToolError('permission_denied', '目标图层已锁定');
  return { c, layer };
}
function time(context: AgentToolContext, explicit?: number) {
  const value = explicit ?? context.time;
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > activeComposition(context.project).duration
  )
    throw new AgentToolError('invalid_arguments', '修改时间超出合成范围');
  return value;
}
function replace(context: AgentToolContext, layer: Layer): Command[] {
  return [
    command({
      type: 'layer.replace',
      compositionId: activeComposition(context.project).id,
      layer,
    }),
  ];
}
function propertyEdit(
  context: AgentToolContext,
  layerId: string,
  key: string,
  value: Parameters<typeof animationEdit>[3],
  at?: number,
) {
  const { layer } = editableLayer(context, layerId);
  const property =
    key in layer.transform
      ? layer.transform[key as keyof typeof layer.transform]
      : layer.editor?.properties[key];
  if (!property) throw new AgentToolError('tool_failed', '属性不存在');
  return animationEdit(context.project, property.id, time(context, at), value);
}
function created(
  context: AgentToolContext,
  kind: LayerKind,
  args: {
    layerId?: string;
    name?: string;
    position?: { x: number; y: number };
    width?: number;
    height?: number;
    assetId?: string;
    content?: string;
  },
): Command[] {
  const c = activeComposition(context.project);
  if (
    kind === 'image' &&
    (!args.assetId ||
      !context.project.assets.some((a) => a.id === args.assetId))
  )
    throw new AgentToolError('invalid_arguments', '图片工具只能使用已导入素材');
  let layer = createLayer(kind, {
    name: args.name,
    position: args.position ?? { x: c.width / 2, y: c.height / 2 },
    width: args.width,
    height: args.height,
    assetId: args.assetId,
  });
  if (args.layerId)
    layer = {
      ...layer,
      id: args.layerId,
      editor: layer.editor
        ? {
            ...layer.editor,
            graph: layer.editor.graph
              ? {
                  ...layer.editor.graph,
                  owner: { type: 'layer', id: args.layerId },
                }
              : undefined,
          }
        : undefined,
    };
  if (layer.type === 'text' && args.content !== undefined)
    layer = { ...layer, text: args.content };
  return [command({ type: 'layer.create', compositionId: c.id, layer })];
}
export function transformCommands(
  context: AgentToolContext,
  ids: readonly string[],
  operation: TransformOperation,
  settings = context.transform ?? defaultTransformSettings,
  at?: number,
) {
  if (!ids.length)
    throw new AgentToolError('invalid_arguments', '请指定至少一个图层');
  ids.forEach((id) => {
    const { layer } = editableLayer(context, id);
    if (layer.editor?.is3D)
      throw new AgentToolError('invalid_arguments', '当前变换工具支持二维图层');
  });
  const c = activeComposition(context.project),
    t = time(context, at);
  const snapshot = createRenderSnapshot(c, t, ids, undefined, context.project);
  const capture = createTransformContext(
    snapshot,
    ids,
    settings,
    context.measure,
  );
  const items = transformItems(capture, operation);
  return transformEditCommands(
    context.project,
    snapshot,
    items,
    operation.kind === 'rotate'
      ? 'rotate'
      : operation.kind === 'scale'
        ? 'scale'
        : 'move',
    t,
    false,
  );
}
const creation = z
  .object({
    layerId: idSchema.optional(),
    name: optionalName,
    position: vec2Schema
      .describe(
        'Layer transform position in composition pixels, at the layer anchor/center, not its top-left corner. Default is composition center.',
      )
      .optional(),
    width: z.number().positive().max(16384).optional(),
    height: z.number().positive().max(16384).optional(),
  })
  .strict();
export function registerCoreWriteTools(registry: AgentToolRegistry) {
  registry.register(
    'setLayerDimensions',
    'Set existing layer width and height in pixels; preserve identity and all other attributes.',
    z
      .object({
        ...layerRef,
        width: z.number().positive().max(16384),
        height: z.number().positive().max(16384),
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { layer } = editableLayer(ctx, args.layerId);
        return replace(ctx, {
          ...layer,
          width: args.width,
          height: args.height,
        });
      },
    },
  );
  registry.register(
    'createLayer',
    'Create a real editable layer; a full-frame background uses kind=solid or rectangle, width/height matching the composition and position at composition center. kind=null is an invisible helper, not a rendered background. Images require an imported asset ID.',
    creation.extend({
      kind: z.enum([
        'rectangle',
        'ellipse',
        'polygon',
        'star',
        'path',
        'text',
        'image',
        'solid',
        'null',
      ]),
      assetId: idSchema.optional(),
    }),
    'WRITE',
    { compile: (ctx, args) => created(ctx, args.kind, args) },
  );
  for (const [name, kind] of [
    ['createRectangle', 'rectangle'],
    ['createEllipse', 'ellipse'],
    ['createPolygon', 'polygon'],
    ['createStar', 'star'],
  ] as const)
    registry.register(
      name,
      'Create an editable ' + kind + ' layer.',
      creation,
      'WRITE',
      { compile: (ctx, args) => created(ctx, kind, args) },
    );
  registry.register(
    'createText',
    'Create editable text. content is required; position is {x,y} composition pixels. Optional fontSize, fontFamily, color {r,g,b,a} in 0..1, alignment left/center/right. Defaults to canvas center. Never use text/font_size aliases.',
    creation.extend({
      content: z.string().max(10000),
      fontSize: z.number().min(1).max(2000).optional(),
      fontFamily: z.string().min(1).max(200).optional(),
      color: colorSchema.optional(),
      alignment: z.enum(['left', 'center', 'right']).optional(),
    }),
    'WRITE',
    {
      compile: (ctx, args) => {
        const result = created(ctx, 'text', args);
        const first = result[0]!;
        if (first.type !== 'layer.create' || first.layer.type !== 'text')
          throw Error('文字创建映射失败');
        const layer = first.layer;
        return [
          command({
            ...first,
            layer: {
              ...layer,
              fontSize: args.fontSize ?? layer.fontSize,
              fontFamily: args.fontFamily ?? layer.fontFamily,
              fill: args.color ?? layer.fill,
              editor: {
                ...layer.editor!,
                textAlign: args.alignment ?? layer.editor!.textAlign,
                properties: {
                  ...layer.editor!.properties,
                  fontSize: {
                    ...layer.editor!.properties.fontSize!,
                    baseValue: args.fontSize ?? layer.fontSize,
                  },
                  fill: {
                    ...layer.editor!.properties.fill!,
                    baseValue: args.color
                      ? [args.color.r, args.color.g, args.color.b, args.color.a]
                      : layer.editor!.properties.fill!.baseValue,
                  },
                },
              },
            },
          }),
        ];
      },
    },
  );
  registry.register(
    'createPath',
    'Create a closed editable path. points is a flat array of [x,y,inX,inY,outX,outY] per vertex. All six coordinates are ABSOLUTE layer-local pixels, origin at the layer center, NOT handle offsets or composition coordinates. For straight edges repeat the vertex three times: [x,y,x,y,x,y]; zero handles curve toward the origin. Typically vertices span -width/2..width/2 and -height/2..height/2. position places the local origin in the composition.',
    creation.extend({
      points: z
        .array(z.number().finite())
        .min(6)
        .max(12000)
        .refine((p) => p.length % 6 === 0),
    }),
    'WRITE',
    {
      compile: (ctx, args) => {
        const commands = created(ctx, 'path', args);
        const first = commands[0]!;
        if (first.type !== 'layer.create') throw Error('创建路径失败');
        return [
          command({
            ...first,
            layer: {
              ...first.layer,
              editor: {
                ...first.layer.editor!,
                properties: {
                  ...first.layer.editor!.properties,
                  path: {
                    ...first.layer.editor!.properties.path!,
                    baseValue: args.points,
                  },
                },
              },
            },
          }),
        ];
      },
    },
  );
  registry.register(
    'deleteLayer',
    'Delete a layer and detach remaining children; requires confirmation.',
    z.object(layerRef).strict(),
    'DESTRUCTIVE',
    {
      compile: (ctx, args) => {
        const { c } = editableLayer(ctx, args.layerId);
        return deleteLayerCommands(
          ctx.project,
          c,
          [args.layerId],
          time(ctx),
          parentCommands,
        );
      },
    },
  );
  registry.register(
    'duplicateLayer',
    'Duplicate a layer with fresh entity IDs.',
    z.object(layerRef).strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { c, layer } = editableLayer(ctx, args.layerId);
        return [
          command({
            type: 'layer.create',
            compositionId: c.id,
            layer: cloneLayer(layer),
          }),
        ];
      },
    },
  );
  registry.register(
    'renameLayer',
    'Rename editable layer.',
    z.object({ ...layerRef, name: z.string().min(1).max(200) }).strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { c } = editableLayer(ctx, args.layerId);
        return [
          command({
            type: 'layer.patch',
            compositionId: c.id,
            layerId: args.layerId,
            patch: { name: args.name },
          }),
        ];
      },
    },
  );
  registry.register(
    'reorderLayer',
    'Move layer to a zero-based stack index.',
    z.object({ ...layerRef, index: z.number().int().nonnegative() }).strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { c } = editableLayer(ctx, args.layerId);
        if (args.index >= c.layers.length) throw new Error('图层顺序越界');
        return [
          command({
            type: 'layer.reorder',
            compositionId: c.id,
            layerId: args.layerId,
            toIndex: args.index,
          }),
        ];
      },
    },
  );
  registry.register(
    'setLayerVisibility',
    'Set actual visibility.',
    z.object({ ...layerRef, visible: z.boolean() }).strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { c } = editableLayer(ctx, args.layerId);
        return [
          command({
            type: 'layer.patch',
            compositionId: c.id,
            layerId: args.layerId,
            patch: { visible: args.visible },
          }),
        ];
      },
    },
  );
  registry.register(
    'setParent',
    'Reuse shared parent transform compensation.',
    z.object({ ...layerRef, parentId: idSchema.nullable(), ...at }).strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        editableLayer(ctx, args.layerId);
        if (args.parentId) editableLayer(ctx, args.parentId);
        return parentCommands(
          ctx.project,
          args.layerId,
          args.parentId,
          time(ctx, args.time),
        );
      },
    },
  );
  registry.register(
    'createPrecomp',
    'Precompose related selected layers through shared commands.',
    z.object({ layerIds: z.array(idSchema).min(1).max(100) }).strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        args.layerIds.forEach((id) => editableLayer(ctx, id));
        return precomposeCommands(ctx.project, args.layerIds).commands;
      },
    },
  );
  for (const [name, key, schema] of [
    ['setPosition', 'position', vec2Schema],
    ['setAnchor', 'anchor', vec2Schema],
    ['setOpacity', 'opacity', z.number().min(0).max(1)],
  ] as const)
    registry.register(
      name,
      'Set ' + key + ' at current/explicit timeline time.',
      z.object({ ...layerRef, value: schema, ...at }).strict(),
      'WRITE',
      {
        compile: (ctx, args) =>
          propertyEdit(ctx, args.layerId, key, args.value, args.time),
      },
    );
  registry.register(
    'setScale',
    'Set absolute local scale with shared pivot compensation.',
    z.object({ ...layerRef, value: vec2Schema, ...at }).strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { layer } = editableLayer(ctx, args.layerId);
        const current = evaluateProperty(
          layer.transform.scale,
          time(ctx, args.time),
        );
        if (Math.abs(current.x) < 1e-9 || Math.abs(current.y) < 1e-9)
          throw new Error('原缩放为零，无法计算相对缩放');
        return transformCommands(
          ctx,
          [args.layerId],
          {
            kind: 'scale',
            factor: {
              x: args.value.x / current.x,
              y: args.value.y / current.y,
            },
          },
          undefined,
          args.time,
        );
      },
    },
  );
  registry.register(
    'setRotation',
    'Set absolute rotation with shared pivot compensation.',
    z.object({ ...layerRef, value: z.number().finite(), ...at }).strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { layer } = editableLayer(ctx, args.layerId);
        return transformCommands(
          ctx,
          [args.layerId],
          {
            kind: 'rotate',
            angle:
              args.value -
              evaluateProperty(layer.transform.rotation, time(ctx, args.time)),
          },
          undefined,
          args.time,
        );
      },
    },
  );
  registry.register(
    'transformSelection',
    'Relative group/individual transform. Factor 1.2 means 120%; use selection-center for a shared center.',
    z
      .object({
        layerIds: z.array(idSchema).min(1).max(100),
        operation: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('move'), delta: vec2Schema }).strict(),
          z.object({ kind: z.literal('scale'), factor: vec2Schema }).strict(),
          z
            .object({ kind: z.literal('rotate'), angle: z.number().finite() })
            .strict(),
        ]),
        orientation: z.enum(transformOrientations).optional(),
        pivot: z.enum(transformPivotModes).optional(),
        customPivot: vec2Schema.optional(),
        ...at,
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) =>
        transformCommands(
          ctx,
          args.layerIds,
          args.operation,
          {
            ...(ctx.transform ?? defaultTransformSettings),
            ...(args.orientation ? { orientation: args.orientation } : {}),
            ...(args.pivot ? { pivotMode: args.pivot } : {}),
            ...(args.customPivot ? { customPivot: args.customPivot } : {}),
          },
          args.time,
        ),
    },
  );
  registry.register(
    'setTransformPivot',
    'Set workspace pivot for subsequent transforms; never modifies layer anchor.',
    z
      .object({
        pivot: z.enum(transformPivotModes),
        customPivot: vec2Schema.optional(),
      })
      .strict(),
    'WRITE',
    {
      compile: () => [],
      workspace: (_ctx, args) => {
        if (args.pivot === 'custom' && !args.customPivot)
          throw new Error('自定义支点需要明确坐标');
        return {
          pivotMode: args.pivot,
          ...(args.customPivot ? { customPivot: args.customPivot } : {}),
        };
      },
    },
  );
  registry.register(
    'setTransformOrientation',
    'Set workspace orientation for subsequent transforms.',
    z.object({ orientation: z.enum(transformOrientations) }).strict(),
    'WRITE',
    {
      compile: () => [],
      workspace: (_ctx, args) => ({ orientation: args.orientation }),
    },
  );
  registry.register(
    'setFill',
    'Set native animated shape/solid/text fill. Optional gradient none/linear/radial changes the existing fill mode, preserving shape alpha and geometry. linear uses color and endColor. radial uses radialParameters with exact registered radialGradient parameter IDs (normalized center, radius, flat stops). Native fill does NOT require createNode or graph wiring; existing downstream blur processes it.',
    z
      .object({
        ...layerRef,
        color: colorSchema,
        gradient: z.enum(['none', 'linear', 'radial']).optional(),
        endColor: colorSchema.optional(),
        radialParameters: capabilityParametersSchema(
          radialGradientDefinition,
        ).optional(),
        ...at,
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { layer } = editableLayer(ctx, args.layerId);
        if (!['shape', 'solid', 'text'].includes(layer.type))
          throw new AgentExecutionError({
            code: 'SEMANTIC_INVALID',
            phase: 'compile',
            toolName: 'setFill',
            field: 'layerId',
            targetId: args.layerId,
            expected: ['shape', 'solid', 'text'],
            received: layer.type,
            recoverable: true,
            message: '当前图层类型不支持填充',
          });
        const commands: Command[] = [];
        if (
          args.radialParameters &&
          args.gradient !== 'radial' &&
          layer.editor?.gradient !== 'radial'
        )
          throw new AgentExecutionError({
            code: 'SEMANTIC_INVALID',
            phase: 'compile',
            toolName: 'setFill',
            field: 'gradient',
            expected: 'radial',
            received: args.gradient ?? layer.editor?.gradient,
            recoverable: true,
            message: 'radialParameters 需要径向渐变填充',
          });
        let nextContext = ctx;
        if (args.gradient) {
          if (!layer.editor) throw Error('图层编辑属性缺失');
          const properties = { ...layer.editor.properties };
          if (args.gradient === 'radial')
            for (const p of radialGradientDefinition.parameters)
              properties[gradientPropertyKey(p.id)] ??= createProperty(
                structuredClone(p.defaultValue),
              );
          const updated = {
            ...layer,
            editor: { ...layer.editor, gradient: args.gradient, properties },
          };
          commands.push(...replace(ctx, updated));
          const draft = new CommandSystem(ctx.project);
          const result = draft.executeTransaction(
            transaction('校验填充模式', 'agent', commands),
          );
          if (!result.ok) throw Error(result.error);
          nextContext = { ...ctx, project: draft.getSnapshot() };
        }
        commands.push(
          ...propertyEdit(
            nextContext,
            args.layerId,
            'fill',
            [args.color.r, args.color.g, args.color.b, args.color.a],
            args.time,
          ),
        );
        if (args.endColor) {
          const c = args.endColor;
          commands.push(
            ...propertyEdit(
              nextContext,
              args.layerId,
              'gradientEnd',
              [c.r, c.g, c.b, c.a],
              args.time,
            ),
          );
        }
        for (const [key, value] of Object.entries(
          args.radialParameters ?? {},
        )) {
          if (value === undefined) continue;
          const definition = radialGradientDefinition.parameters.find(
            (p) => p.id === key,
          );
          if (!definition) throw Error('未知径向渐变参数：' + key);
          const error = parameterError(definition, value);
          if (error) throw Error(key + ': ' + error);
          commands.push(
            ...propertyEdit(
              nextContext,
              args.layerId,
              gradientPropertyKey(key),
              value,
              args.time,
            ),
          );
        }
        return commands;
      },
    },
  );
  registry.register(
    'setStroke',
    'Set actual stroke color and width.',
    z
      .object({
        ...layerRef,
        color: colorSchema,
        width: z.number().min(0).max(1000),
        ...at,
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { layer } = editableLayer(ctx, args.layerId);
        if (layer.type !== 'shape') throw new Error('描边需要形状图层');
        return [
          ...propertyEdit(
            ctx,
            args.layerId,
            'stroke',
            [args.color.r, args.color.g, args.color.b, args.color.a],
            args.time,
          ),
          ...propertyEdit(
            ctx,
            args.layerId,
            'strokeWidth',
            args.width,
            args.time,
          ),
        ];
      },
    },
  );
  const textLayer = (ctx: AgentToolContext, id: string) => {
    const { layer } = editableLayer(ctx, id);
    if (layer.type !== 'text') throw new Error('此工具需要文字图层');
    return layer;
  };
  registry.register(
    'setTextContent',
    'Replace editable text content.',
    z.object({ ...layerRef, content: z.string().max(10000) }).strict(),
    'WRITE',
    {
      compile: (ctx, args) =>
        replace(ctx, { ...textLayer(ctx, args.layerId), text: args.content }),
    },
  );
  registry.register(
    'setFont',
    'Set font family name; cannot read fonts from disk.',
    z.object({ ...layerRef, fontFamily: z.string().min(1).max(200) }).strict(),
    'WRITE',
    {
      compile: (ctx, args) =>
        replace(ctx, {
          ...textLayer(ctx, args.layerId),
          fontFamily: args.fontFamily,
        }),
    },
  );
  for (const [name, key, min, max] of [
    ['setFontSize', 'fontSize', 1, 2000],
    ['setTracking', 'tracking', -100, 1000],
    ['setLeading', 'lineHeight', 0.1, 10],
  ] as const)
    registry.register(
      name,
      'Set text ' + key + ' through animated property.',
      z
        .object({ ...layerRef, value: z.number().min(min).max(max), ...at })
        .strict(),
      'WRITE',
      {
        compile: (ctx, args) => {
          textLayer(ctx, args.layerId);
          return propertyEdit(ctx, args.layerId, key, args.value, args.time);
        },
      },
    );
  registry.register(
    'setTextColor',
    'Set text fill color.',
    z.object({ ...layerRef, color: colorSchema, ...at }).strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        textLayer(ctx, args.layerId);
        return propertyEdit(
          ctx,
          args.layerId,
          'fill',
          [args.color.r, args.color.g, args.color.b, args.color.a],
          args.time,
        );
      },
    },
  );
  registry.register(
    'setTextAlignment',
    'Set text alignment without changing glyph data.',
    z
      .object({ ...layerRef, alignment: z.enum(['left', 'center', 'right']) })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const layer = textLayer(ctx, args.layerId);
        return replace(ctx, {
          ...layer,
          editor: { ...layer.editor!, textAlign: args.alignment },
        });
      },
    },
  );
  registry.register(
    'addEffect',
    'Insert an existing effect into the actual compositing graph.',
    z
      .object({
        ...layerRef,
        kind: z.enum(effectKinds),
        effectId: idSchema.optional(),
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        editableLayer(ctx, args.layerId);
        return compileCompositingTool(
          {
            name: 'createNode',
            layerId: args.layerId,
            type: args.kind,
            nodeId: args.effectId,
          },
          ctx.project,
          time(ctx),
        );
      },
    },
  );
  registry.register(
    'removeEffect',
    'Remove effect node; requires confirmation.',
    z.object({ ...layerRef, effectId: idSchema }).strict(),
    'DESTRUCTIVE',
    {
      compile: (ctx, args) => {
        const { layer } = editableLayer(ctx, args.layerId);
        if (
          !layer.editor?.graph?.nodes.some(
            (n) =>
              n.id === args.effectId &&
              effectKinds.includes(n.type as (typeof effectKinds)[number]),
          )
        )
          throw new Error('效果不存在');
        return compileCompositingTool(
          { name: 'deleteNode', nodeId: args.effectId },
          ctx.project,
          time(ctx),
        );
      },
    },
  );
  registry.register(
    'setEffectParameter',
    'Set animated parameter of an existing effect node.',
    z
      .object({
        ...layerRef,
        effectId: idSchema,
        key: z.string().min(1).max(100),
        value: animValueSchema,
        ...at,
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { layer } = editableLayer(ctx, args.layerId);
        if (
          !layer.editor?.graph?.nodes.some(
            (n) =>
              n.id === args.effectId &&
              effectKinds.includes(n.type as (typeof effectKinds)[number]),
          )
        )
          throw new Error('效果不存在');
        return compileCompositingTool(
          {
            name: 'setNodeParameter',
            nodeId: args.effectId,
            key: args.key,
            value: args.value,
            time: time(ctx, args.time),
          },
          ctx.project,
          time(ctx),
        );
      },
    },
  );
  registry.register(
    'enableEffect',
    'Toggle an actual effect node.',
    z
      .object({ ...layerRef, effectId: idSchema, enabled: z.boolean() })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { layer } = editableLayer(ctx, args.layerId);
        if (
          !layer.editor?.graph?.nodes.some(
            (n) =>
              n.id === args.effectId &&
              effectKinds.includes(n.type as (typeof effectKinds)[number]),
          )
        )
          throw new Error('效果不存在');
        return compileCompositingTool(
          { name: 'enableNode', nodeId: args.effectId, enabled: args.enabled },
          ctx.project,
          time(ctx),
        );
      },
    },
  );
  registry.register(
    'reorderEffect',
    'Reorder a linear effect stack; branched graphs are rejected.',
    z
      .object({
        ...layerRef,
        effectId: idSchema,
        index: z.number().int().nonnegative(),
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { layer } = editableLayer(ctx, args.layerId),
          graph = layer.editor?.graph;
        if (!graph) throw new Error('图层没有效果图');
        const effects = linearGraphEffects(graph);
        if (!effects) throw new Error('分支图不能作为线性效果栈排序');
        const ids = effects.map((e) => e.id),
          from = ids.indexOf(args.effectId);
        if (from < 0 || args.index >= ids.length)
          throw new Error('效果顺序无效');
        ids.splice(from, 1);
        ids.splice(args.index, 0, args.effectId);
        return [
          graphCommand(
            ctx.project,
            args.layerId,
            reorderGraphEffects(graph, ids),
          ),
        ];
      },
    },
  );
  return registry;
}
export function registerAnimationTools(registry: AgentToolRegistry) {
  const reference = { propertyId: idSchema, keyframeId: idSchema };
  const target = (ctx: AgentToolContext, id: string) => {
    const location = findProperty(ctx.project, id);
    editableLayer(ctx, location.layer.id);
    return location.property;
  };
  registry.register(
    'addKeyframe',
    'Add a real timeline keyframe. Use propertyId, or layerId + property path (position/scale/rotation/opacity or editor.properties key), including layers created earlier in the same plan.',
    z
      .object({
        propertyId: idSchema.optional(),
        layerId: idSchema.optional(),
        property: z.string().max(100).optional(),
        keyframeId: idSchema.optional(),
        time: z.number().nonnegative(),
        value: animValueSchema,
        interpolation: interpolationSchema.optional(),
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        let propertyId = args.propertyId;
        if (propertyId && (args.layerId || args.property))
          throw Error('只能指定一种属性引用');
        if (!propertyId) {
          if (!args.layerId || !args.property)
            throw Error('需要Property ID，或Layer ID与属性路径');
          const { layer } = editableLayer(ctx, args.layerId);
          const keys = [
            args.property,
            'transform.' + args.property,
            'editor.properties.' + args.property,
          ];
          propertyId = layerProperties(layer).find((p) => keys.includes(p.key))
            ?.property.id;
          if (!propertyId) throw Error('属性不存在');
        }
        target(ctx, propertyId);
        return [
          command({
            type: 'keyframe.add',
            propertyId,
            keyframe: {
              id: args.keyframeId ?? crypto.randomUUID(),
              time: time(ctx, args.time),
              value: args.value,
              interpolation: args.interpolation ?? { type: 'linear' },
            },
          }),
        ];
      },
    },
  );
  registry.register(
    'deleteKeyframe',
    'Delete a timeline keyframe.',
    z.object(reference).strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        target(ctx, args.propertyId);
        return [command({ type: 'keyframe.delete', ...args })];
      },
    },
  );
  registry.register(
    'moveKeyframe',
    'Move a timeline keyframe in seconds.',
    z.object({ ...reference, time: z.number().nonnegative() }).strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        target(ctx, args.propertyId);
        return [
          command({
            type: 'keyframe.update',
            propertyId: args.propertyId,
            keyframeId: args.keyframeId,
            patch: { time: time(ctx, args.time) },
          }),
        ];
      },
    },
  );
  registry.register(
    'setKeyframeValue',
    'Change actual keyframe value.',
    z.object({ ...reference, value: animValueSchema }).strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        target(ctx, args.propertyId);
        return [
          command({
            type: 'keyframe.update',
            propertyId: args.propertyId,
            keyframeId: args.keyframeId,
            patch: { value: args.value },
          }),
        ];
      },
    },
  );
  registry.register(
    'setInterpolation',
    'Set interpolation and clear stale outgoing handles.',
    z.object({ ...reference, interpolation: interpolationSchema }).strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        target(ctx, args.propertyId);
        return [
          command({
            type: 'keyframe.update',
            propertyId: args.propertyId,
            keyframeId: args.keyframeId,
            patch: { interpolation: args.interpolation, outgoing: null },
          }),
        ];
      },
    },
  );
  const segment = z.string().min(1).max(200);
  registry.register(
    'applyMotionCurve',
    'Apply normalized motion curve to actual adjacent keyframe segments.',
    z
      .object({
        segmentIds: z.array(segment).min(1).max(100),
        curve: motionCurveSchema,
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        args.segmentIds.forEach((id) =>
          target(ctx, resolveMotionSegment(ctx.project, id).propertyId),
        );
        return applyMotionCurveCommands(
          ctx.project,
          args.segmentIds,
          args.curve,
        );
      },
    },
  );
  registry.register(
    'copyEasing',
    'Copy a normalized segment curve to other segments.',
    z
      .object({
        sourceSegmentId: segment,
        targetSegmentIds: z.array(segment).min(1).max(100),
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const source = resolveMotionSegment(ctx.project, args.sourceSegmentId);
        if (!source.curve) throw new Error('源区间不是可复制的运动曲线');
        args.targetSegmentIds.forEach((id) =>
          target(ctx, resolveMotionSegment(ctx.project, id).propertyId),
        );
        return applyMotionCurveCommands(
          ctx.project,
          args.targetSegmentIds,
          source.curve,
        );
      },
    },
  );
  registry.register(
    'reverseEasing',
    'Reverse timing and progress of normalized curves.',
    z.object({ segmentIds: z.array(segment).min(1).max(100) }).strict(),
    'WRITE',
    {
      compile: (ctx, args) =>
        args.segmentIds.flatMap((id) => {
          const source = resolveMotionSegment(ctx.project, id);
          target(ctx, source.propertyId);
          if (!source.curve) throw new Error('此区间不是可反转的运动曲线');
          return applyMotionCurveCommands(
            ctx.project,
            [id],
            reverseMotionCurve(source.curve),
          );
        }),
    },
  );
  return registry;
}
