import { z } from 'zod';
import { AgentToolRegistry } from './tool-registry';
import { editableLayer } from './write-tools';
import { visualCapabilities } from '../core/visual-capabilities';
import type { EffectPackage } from '../core/programmable-effect';
import {
  effectDefinition,
  effectPackageSchema,
} from '../core/programmable-effect';
import { effectForge, EffectForgeWorkspace } from '../core/effect-forge';
import { createProgrammableNode } from '../core/compositing-registry';
import { insertGraphNode } from '../core/compositing-operations';
import { graphCommand } from '../core/compositing-commands';
import { createGeneratorLayer } from '../core/generator-layer';
import { activeComposition } from '../core/project-model';
import { command } from '../core/command-system';
import { animationEdit } from '../core/editing-commands';
import { contentHash } from '../core/content-hash';
import { trustEffect } from '../core/effect-trust';
const empty = z.object({}).strict(),
  draftId = z.object({ draftId: z.string().uuid() }).strict(),
  source = effectPackageSchema.omit({ contentHash: true });
const value = z.union([
  z.number().finite(),
  z.object({ x: z.number().finite(), y: z.number().finite() }).strict(),
  z.array(z.number().finite()).max(160),
]);
const summary = (d: ReturnType<EffectForgeWorkspace['get']>) => ({
  draftId: d.id,
  state: d.state,
  capability: effectDefinition(d.package),
  diagnostics: d.diagnostics,
  evaluation: d.evaluation,
});
export function registerEffectForgeTools(
  registry: AgentToolRegistry,
  workspace = effectForge,
  previewImage?: (
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
  ) => string | undefined,
  libraryPackages: () => readonly EffectPackage[] = () => [],
) {
  const allCapabilities = () => [
    ...visualCapabilities.all(),
    ...libraryPackages().map(effectDefinition),
  ];
  registry.register(
    'effect_list',
    '列出统一内置能力。优先复用，禁止为已支持的基础模糊或径向渐变造新程序。',
    empty,
    'READ',
    { read: () => allCapabilities() },
  );
  registry.register(
    'effect_search',
    '先搜索内置能力，再考虑组合节点，最后才创建程序化草稿。',
    z.object({ query: z.string().max(200) }).strict(),
    'READ',
    {
      read: (_ctx, args) => ({
        strategy: ['native', 'compose', 'programmable'],
        matches: allCapabilities().filter((d) =>
          [d.id, d.name, d.description, ...d.keywords]
            .join(' ')
            .toLowerCase()
            .includes(args.query.toLowerCase()),
        ),
      }),
    },
  );
  registry.register(
    'effect_inspect',
    '检查内置能力的精确版本、端口和参数',
    z
      .object({ id: z.string().max(80), version: z.string().default('1.0.0') })
      .strict(),
    'READ',
    {
      read: (_ctx, args) => {
        const pkg = libraryPackages().find(
          (p) => p.id === args.id && p.version === args.version,
        );
        const d =
          visualCapabilities.get(args.id, args.version) ??
          (pkg ? effectDefinition(pkg) : undefined);
        if (!d) throw Error('能力不存在');
        return d;
      },
    },
  );
  registry.register(
    'effect_createDraft',
    '生成新的受控声明式像素效果草稿；只能使用公开指令，不能含JS/WGSL或系统调用；需要validate compile preview evaluate后才可申请应用。',
    z.object({ source }).strict(),
    'READ',
    {
      read: (_ctx, args) => {
        if (visualCapabilities.get(args.source.id))
          throw Error('已有内置能力，请复用');
        return summary(workspace.create(args.source));
      },
    },
  );
  registry.register(
    'effect_updateDraft',
    '更新草稿并使旧预览和检查失效',
    z.object({ draftId: z.string().uuid(), source }).strict(),
    'READ',
    {
      read: (_ctx, args) =>
        summary(workspace.update(args.draftId, args.source)),
    },
  );
  registry.register(
    'effect_validate',
    '验证草稿的源定义、端口、绑定与资源限制',
    draftId,
    'READ',
    { read: (_ctx, args) => summary(workspace.validate(args.draftId)) },
  );
  registry.register(
    'effect_compile',
    '编译已验证草稿，按源内容哈希缓存',
    draftId,
    'READ',
    { read: (_ctx, args) => summary(workspace.compile(args.draftId)) },
  );
  registry.register(
    'effect_preview',
    '真实渲染草稿192×108预览，返回像素统计；隐私许可且有识图能力时可发送图片。统计不代表满足视觉目标。',
    z
      .object({
        draftId: z.string().uuid(),
        time: z.number().min(0).max(3600).default(0),
        parameters: z.record(z.string(), value).default({}),
      })
      .strict(),
    'READ',
    {
      read: (_ctx, args) => {
        const d = workspace.preview(args.draftId, args.parameters, args.time),
          p = d.preview!;
        trustEffect(d.package.contentHash);
        return {
          ...summary(d),
          width: p.width,
          height: p.height,
          time: p.time,
          pixelHash: contentHash([...p.pixels]),
          image: previewImage?.(p.pixels, p.width, p.height),
          visualVerification:
            '必须检查真实预览；未提供图片时不能声称已识图确认',
        };
      },
    },
  );
  registry.register(
    'effect_evaluate',
    '记录真实预览的检查结论；没有视觉证据时必须标明限制，应用后仍由Observer检查',
    z
      .object({ draftId: z.string().uuid(), note: z.string().min(1).max(1000) })
      .strict(),
    'READ',
    {
      read: (_ctx, args) =>
        summary(workspace.evaluate(args.draftId, args.note)),
    },
  );
  registry.register(
    'effect_getDiagnostics',
    '读取草稿状态及错误，不返回源代码执行权限',
    draftId,
    'READ',
    { read: (_ctx, args) => summary(workspace.get(args.draftId)) },
  );
  registry.register(
    'effect_discardDraft',
    '丢弃临时草稿，工程不变',
    draftId,
    'READ',
    { read: (_ctx, args) => summary(workspace.discard(args.draftId)) },
  );
  registry.register(
    'effect_applyDraft',
    '把已预览和检查的草稿提交到Agent Transaction；工程内嵌精确版本，不自动保存到正式库',
    z
      .object({
        draftId: z.string().uuid(),
        layerId: z.string().uuid().optional(),
        independent: z.boolean().default(false),
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const p = workspace.ready(args.draftId).package;
        if (args.independent) {
          if (p.category !== 'generator') throw Error('滤镜需要输入图层');
          const c = activeComposition(ctx.project);
          return [
            command({
              type: 'layer.create',
              compositionId: c.id,
              layer: createGeneratorLayer(c, p),
            }),
          ];
        }
        const { layer } = editableLayer(
          ctx,
          args.layerId ?? ctx.selection[0] ?? '',
        );
        if (!layer.editor?.graph) throw Error('目标没有处理图');
        return [
          graphCommand(
            ctx.project,
            layer.id,
            insertGraphNode(layer.editor.graph, createProgrammableNode(p))
              .graph,
          ),
        ];
      },
    },
  );
  registry.register(
    'effect_saveReusable',
    '仅发起保存建议。正式效果库只能由用户在效果浏览器检查并显式保存；本工具不会静默安装。',
    draftId,
    'READ',
    {
      read: (_ctx, args) => ({
        draftId: workspace.get(args.draftId).id,
        requiresUserAcceptance: true,
        home: '属性 → 添加效果 → AI 草稿 / 导入',
        instruction: '请用户确认应用并点击保存到我的效果库',
      }),
    },
  );
  for (const name of ['effect_addToLayer', 'effect_addToGraph'])
    registry.register(
      name,
      '添加已注册内置能力到共享Graph；不会创建新的效果实现',
      z
        .object({
          id: z.string().max(80),
          version: z.string().default('1.0.0'),
          layerId: z.string().uuid(),
          values: z.record(z.string(), value).default({}),
        })
        .strict(),
      'WRITE',
      {
        compile: (ctx, args) => {
          const pkg = libraryPackages().find(
            (p) => p.id === args.id && p.version === args.version,
          );
          const d =
            visualCapabilities.get(args.id, args.version) ??
            (pkg ? effectDefinition(pkg) : undefined);
          if (!d) throw Error('能力版本不存在');
          const { layer } = editableLayer(ctx, args.layerId);
          if (!layer.editor?.graph) throw Error('没有处理图');
          let inserted = insertGraphNode(
            layer.editor.graph,
            pkg ? createProgrammableNode(pkg) : args.id,
          );
          inserted = {
            ...inserted,
            graph: {
              ...inserted.graph,
              nodes: inserted.graph.nodes.map((n) =>
                n.id === inserted.node.id
                  ? {
                      ...n,
                      params: Object.fromEntries(
                        Object.entries(n.params).map(([k, p]) => [
                          k,
                          { ...p, baseValue: args.values[k] ?? p.baseValue },
                        ]),
                      ),
                    }
                  : n,
              ),
            },
          };
          return [graphCommand(ctx.project, layer.id, inserted.graph)];
        },
      },
    );
  registry.register(
    'effect_setParameter',
    '通过标准动画Property设置效果参数，已有动画时在指定时间记录关键帧',
    z
      .object({
        layerId: z.string().uuid(),
        nodeId: z.string().uuid(),
        parameter: z.string().max(100),
        value,
        time: z.number().nonnegative().optional(),
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const { layer, c } = editableLayer(ctx, args.layerId),
          property = layer.editor?.graph?.nodes.find(
            (n) => n.id === args.nodeId,
          )?.params[args.parameter];
        if (!property) throw Error('效果参数不存在');
        const time = args.time ?? ctx.time;
        if (time > c.duration) throw Error('时间超出合成范围');
        return animationEdit(ctx.project, property.id, time, args.value);
      },
    },
  );
  return registry;
}
