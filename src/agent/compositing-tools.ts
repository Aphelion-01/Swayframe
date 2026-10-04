import { z } from 'zod';
import { AgentToolRegistry } from './tool-registry';
import type { AgentToolContext } from './tool-registry';
import { editableLayer } from './write-tools';
import {
  compositingToolSchemas,
  compileCompositingTool,
  runCompositingTool,
} from '../core/compositing-tools';
import { command, CommandSystem } from '../core/command-system';
import { createMask } from '../core/effect-model';
import {
  activeComposition,
  createComposition,
  createLayer,
} from '../core/project-model';
import { animationEdit } from '../core/editing-commands';
import { idSchema } from '../core/project-schema';
function owner(ctx: AgentToolContext, nodeId: string) {
  const layer = activeComposition(ctx.project).layers.find((l) =>
    l.editor?.graph?.nodes.some((n) => n.id === nodeId),
  );
  if (!layer) throw Error('当前合成中不存在节点');
  editableLayer(ctx, layer.id);
}
export function registerCompositingTools(registry: AgentToolRegistry) {
  for (const schema of compositingToolSchemas) {
    const name = schema.shape.name.value;
    if (name === 'inspectGraph') continue;
    const args = z
      .object(
        Object.fromEntries(
          Object.entries(schema.shape).filter(([key]) => key !== 'name'),
        ) as z.ZodRawShape,
      )
      .strict();
    const read = name === 'compileGraph';
    const check = (ctx: AgentToolContext, data: Record<string, unknown>) => {
      if (typeof data.layerId === 'string') editableLayer(ctx, data.layerId);
      if (typeof data.nodeId === 'string' && name !== 'createNode')
        owner(ctx, data.nodeId);
      if (name === 'connectPorts')
        for (const ref of [data.from, data.to])
          owner(ctx, (ref as { nodeId: string }).nodeId);
      if (name === 'disconnectEdge') {
        const layer = activeComposition(ctx.project).layers.find((l) =>
          l.editor?.graph?.edges.some((e) => e.id === data.edgeId),
        );
        if (!layer) throw Error('当前合成中不存在连线');
        editableLayer(ctx, layer.id);
      }
    };
    registry.register(
      name === 'connectPorts' ? 'connectNodes' : name,
      '调用共享合成图服务：' + name,
      args,
      read ? 'READ' : name === 'deleteNode' ? 'DESTRUCTIVE' : 'WRITE',
      read
        ? {
            read: (ctx, data) => {
              check(ctx, data);
              return runCompositingTool(
                new CommandSystem(ctx.project),
                schema.parse({ ...data, name }),
                ctx.time,
              );
            },
          }
        : {
            compile: (ctx, data) => {
              check(ctx, data);
              return compileCompositingTool(
                schema.parse({ ...data, name }),
                ctx.project,
                ctx.time,
              );
            },
          },
    );
  }
  registry.register(
    'createMask',
    '创建现有可渲染图层遮罩；路径每个点为 x,y,inX,inY,outX,outY',
    z
      .object({
        layerId: idSchema,
        maskId: idSchema.optional(),
        kind: z.enum(['rectangle', 'ellipse', 'path']),
        mode: z.enum(['add', 'subtract', 'intersect']).optional(),
        path: z
          .array(z.number().finite())
          .min(18)
          .max(3072)
          .refine((v) => v.length % 6 === 0)
          .optional(),
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { c, layer } = editableLayer(ctx, args.layerId);
        if (!layer.editor) throw Error('图层编辑属性缺失');
        const mask = createMask(layer, args.kind);
        return [
          command({
            type: 'layer.replace',
            compositionId: c.id,
            layer: {
              ...layer,
              editor: {
                ...layer.editor,
                masks: [
                  ...layer.editor.masks,
                  {
                    ...mask,
                    id: args.maskId ?? mask.id,
                    mode: args.mode ?? mask.mode,
                    ...(args.path
                      ? { path: { ...mask.path, baseValue: args.path } }
                      : {}),
                  },
                ],
              },
            },
          }),
        ];
      },
    },
  );
  const maskRef = { layerId: idSchema, maskId: idSchema };
  registry.register(
    'setMaskMode',
    '设置遮罩叠加、减去或相交模式',
    z
      .object({ ...maskRef, mode: z.enum(['add', 'subtract', 'intersect']) })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { c, layer } = editableLayer(ctx, args.layerId);
        if (!layer.editor?.masks.some((m) => m.id === args.maskId))
          throw Error('遮罩不存在');
        return [
          command({
            type: 'layer.replace',
            compositionId: c.id,
            layer: {
              ...layer,
              editor: {
                ...layer.editor,
                masks: layer.editor.masks.map((m) =>
                  m.id === args.maskId ? { ...m, mode: args.mode } : m,
                ),
              },
            },
          }),
        ];
      },
    },
  );
  const fields = [
    [
      'setMaskPath',
      'path',
      z
        .array(z.number().finite())
        .min(18)
        .max(3072)
        .refine((v) => v.length % 6 === 0),
    ],
    ['setMaskFeather', 'feather', z.number().finite().min(0).max(200)],
    ['setMaskOpacity', 'opacity', z.number().finite().min(0).max(1)],
    ['setMaskExpansion', 'expansion', z.number().finite().min(-1000).max(1000)],
  ] as const;
  for (const [name, key, value] of fields)
    registry.register(
      name,
      '通过共享属性命令修改遮罩 ' + key,
      z
        .object({
          ...maskRef,
          value,
          time: z.number().nonnegative().optional(),
        })
        .strict(),
      'WRITE',
      {
        compile: (ctx, args) => {
          const { c, layer } = editableLayer(ctx, args.layerId);
          const mask = layer.editor?.masks.find((m) => m.id === args.maskId);
          if (!mask) throw Error('遮罩不存在');
          const t = args.time ?? ctx.time;
          if (t > c.duration) throw Error('时间超出合成范围');
          return animationEdit(ctx.project, mask[key].id, t, args.value);
        },
      },
    );
  registry.register(
    'createComposition',
    '创建空合成',
    z
      .object({
        compositionId: idSchema.optional(),
        name: z.string().min(1).max(200),
        width: z.number().int().min(1).max(16384),
        height: z.number().int().min(1).max(16384),
        fps: z.number().positive().max(240),
        duration: z.number().positive().max(3600),
      })
      .strict(),
    'WRITE',
    {
      compile: (_ctx, args) => {
        const { compositionId, ...options } = args;
        const c = createComposition(options);
        return [
          command({
            type: 'composition.add',
            composition: { ...c, id: compositionId ?? c.id },
          }),
        ];
      },
    },
  );
  const compositionRef = { compositionId: idSchema };
  const composition = (ctx: AgentToolContext, id: string) => {
    const c = ctx.project.compositions.find((c) => c.id === id);
    if (!c) throw Error('合成不存在');
    return c;
  };
  registry.register(
    'setCompositionSize',
    '修改合成尺寸',
    z
      .object({
        ...compositionRef,
        width: z.number().int().min(1).max(16384),
        height: z.number().int().min(1).max(16384),
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, a) => [
        command({
          type: 'composition.replace',
          composition: {
            ...composition(ctx, a.compositionId),
            width: a.width,
            height: a.height,
          },
        }),
      ],
    },
  );
  for (const [name, key, max] of [
    ['setDuration', 'duration', 3600],
    ['setFPS', 'fps', 240],
  ] as const)
    registry.register(
      name,
      '修改合成 ' + key,
      z
        .object({ ...compositionRef, value: z.number().positive().max(max) })
        .strict(),
      'WRITE',
      {
        compile: (ctx, a) => [
          command({
            type: 'composition.replace',
            composition: {
              ...composition(ctx, a.compositionId),
              [key]: a.value,
            },
          }),
        ],
      },
    );
  registry.register(
    'openComposition',
    '切换当前合成',
    z.object(compositionRef).strict(),
    'WRITE',
    {
      compile: (ctx, a) => {
        composition(ctx, a.compositionId);
        return [
          command({ type: 'project.activate', compositionId: a.compositionId }),
        ];
      },
    },
  );
  registry.register(
    'deleteComposition',
    '删除合成，需要确认；拒绝当前、最后一个及被引用合成',
    z.object(compositionRef).strict(),
    'DESTRUCTIVE',
    {
      compile: (ctx, a) => {
        composition(ctx, a.compositionId);
        if (
          ctx.project.compositions.length === 1 ||
          ctx.project.activeCompositionId === a.compositionId ||
          ctx.project.compositions.some((c) =>
            c.layers.some(
              (l) =>
                'compositionId' in l && l.compositionId === a.compositionId,
            ),
          )
        )
          throw Error('不能删除当前或被引用合成');
        return [
          command({
            type: 'composition.remove',
            compositionId: a.compositionId,
          }),
        ];
      },
    },
  );
  registry.register(
    'createLayerFromAsset',
    '仅使用已导入图像素材创建图层',
    z
      .object({
        assetId: idSchema,
        layerId: idSchema.optional(),
        name: z.string().max(200).optional(),
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, a) => {
        const asset = ctx.project.assets.find((v) => v.id === a.assetId);
        if (!asset || !asset.mimeType.startsWith('image/'))
          throw Error('必须使用已导入的图像素材');
        const l = createLayer('image', {
          assetId: a.assetId,
          name: a.name ?? asset.name,
        });
        const id = a.layerId ?? l.id;
        return [
          command({
            type: 'layer.create',
            compositionId: activeComposition(ctx.project).id,
            layer: {
              ...l,
              id,
              ...(l.editor
                ? {
                    editor: {
                      ...l.editor,
                      graph: l.editor.graph
                        ? { ...l.editor.graph, owner: { type: 'layer', id } }
                        : undefined,
                    },
                  }
                : {}),
            },
          }),
        ];
      },
    },
  );
  registry.register(
    'replaceAssetReference',
    '替换图像图层的已授权素材引用',
    z.object({ layerId: idSchema, assetId: idSchema }).strict(),
    'WRITE',
    {
      compile: (ctx, a) => {
        const { c, layer } = editableLayer(ctx, a.layerId);
        if (
          layer.type !== 'image' ||
          !ctx.project.assets.some(
            (v) => v.id === a.assetId && v.mimeType.startsWith('image/'),
          )
        )
          throw Error('图像图层或已导入素材无效');
        return [
          command({
            type: 'layer.replace',
            compositionId: c.id,
            layer: { ...layer, assetId: a.assetId },
          }),
        ];
      },
    },
  );
  return registry;
}
