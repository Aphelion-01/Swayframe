import { validatePlanDependencies } from './dependency-graph';
import { AgentExecutionError } from './execution-error';
import { layoutCompositingGraph } from '../core/compositing-layout';
import { builtinMotionPresets } from '../core/motion-presets';
import { visualCapabilities } from '../core/visual-capabilities';
import {
  graphNodeRegistry,
  createProgrammableNode,
} from '../core/compositing-registry';
import { organicTexturePackage } from '../core/effect-examples';
import {
  effectDefinition,
  type EffectPackage,
} from '../core/programmable-effect';
import { graphCommand } from '../core/compositing-commands';
import {
  insertGraphNode,
  connectPorts,
  patchGraphNode,
} from '../core/compositing-operations';
import { activeComposition } from '../core/project-model';
import { idSchema } from '../core/project-schema';
import { z } from 'zod';
import { editableLayer } from './write-tools';
import type { AgentPlan } from './session';
import {
  creationDetailsSchema,
  type CreationDetails,
} from './creation-contracts';
import { graphBranch, inspectGraphNode } from './creation-scope';
import type { AgentToolRegistry, AgentToolContext } from './tool-registry';
const domain = (
  tool: string,
): CreationDetails['tasks'][number]['executionDomain'] =>
  /effect_(createDraft|compile|preview|validate|evaluate|applyDraft)/.test(tool)
    ? 'effect-forge'
    : /Node|Graph|effect_/.test(tool)
      ? 'compositing'
      : /Keyframe|Motion|Easing|Animation/.test(tool)
        ? 'animation'
        : /^set|^transform|^align/.test(tool)
          ? 'property'
          : 'scene';
export function creationCapabilities(
  registry: AgentToolRegistry,
  packages: readonly EffectPackage[] = [],
  providers: unknown[] = [],
) {
  const registered = new Set(registry.catalog().map((t) => t.name));
  const availableTools = (...names: string[]) =>
    names.filter((n) => registered.has(n));
  const visual = [
    ...visualCapabilities.all(),
    ...packages.map(effectDefinition),
  ].map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    version: d.version,
    contentHash: d.contentHash,
    inputTypes: d.inputs,
    outputTypes: d.outputs,
    parameters: d.parameters.map((p) => ({
      ...p,
      ...(p.type === 'gradientStops'
        ? {
            valueEncoding:
              'Flat array of 2..32 ordered stops, each [position,r,g,b,a]; every component 0..1; length must be a multiple of 5.',
          }
        : p.type === 'color'
          ? { valueEncoding: '[r,g,b,a], four normalized components 0..1' }
          : {}),
    })),
    executionDomain: 'compositing',
    executionTools:
      d.implementation.kind === 'declarative'
        ? availableTools('reuseProgrammableEffect', 'effect_applyDraft')
        : availableTools(
            'createNode',
            'setNodeParameter',
            ...(d.category === 'fill' ? ['setFill', 'setGradientFill'] : []),
          ),
    availability: (d.implementation.kind === 'declarative'
      ? availableTools('reuseProgrammableEffect', 'effect_applyDraft')
      : availableTools(
          'createNode',
          'setNodeParameter',
          ...(d.category === 'fill' ? ['setFill', 'setGradientFill'] : []),
        )
    ).length
      ? 'available'
      : 'unavailable',
    animatable: d.capabilities.animatable,
    execution: d.capabilities.realtime ? 'realtime' : 'local',
    cost:
      d.implementation.kind === 'declarative' ? 'CPU pixel budget' : 'local',
    compatibility: { runtime: d.implementation.kind, exactVersion: true },
    keywords: d.keywords,
  }));
  return [
    ...builtinMotionPresets.map((p) => ({
      id: p.id,
      name: p.name,
      category: 'motion-preset',
      executionTools: availableTools('applyMotionPreset'),
      parameters: p,
      inputTypes: ['Keyframe'],
      outputTypes: ['MotionCurve'],
      executionDomain: 'animation',
      availability: registered.has('applyMotionPreset')
        ? 'available'
        : 'unavailable',
      animatable: true,
      execution: 'local',
      cost: 'local',
      compatibility: 'native timing',
    })),
    ...visual,
    ...graphNodeRegistry
      .all()
      .filter((d) => !visual.some((v) => v.id === d.type))
      .map((d) => ({
        id: d.type,
        name: d.title,
        category: 'node',
        executionTools: availableTools('createNode', 'setNodeParameter'),
        inputTypes: d.inputs,
        outputTypes: d.outputs,
        parameters: d.params,
        executionDomain: 'compositing',
        availability: availableTools('createNode', 'setNodeParameter').length
          ? 'available'
          : 'unavailable',
        animatable: true,
        execution: 'local',
        cost: 'local',
        compatibility: 'typed ports',
      })),
    ...registry.catalog().map((t) => ({
      id: t.name,
      executionTools: [t.name],
      targetConstraints: registry.contract(t.name).referenceRules,
      outputSchema: registry.contract(t.name).outputSchema,
      name: t.description,
      category: t.permission === 'READ' ? 'inspection' : 'command',
      inputTypes: ['registered arguments'],
      outputTypes: [t.permission === 'READ' ? 'data / proposal' : 'Command'],
      parameters: t.parameters,
      executionDomain: domain(t.name),
      availability: 'available',
      animatable: /Keyframe|Parameter/.test(t.name),
      execution: /analyze/.test(t.name) ? 'async' : 'local',
      cost: /analyze/.test(t.name) ? 'provider metered' : 'local',
      compatibility: { permission: t.permission },
    })),
    ...providers.map((p, index) => ({
      id: 'provider:' + index,
      executionTools: [],
      name: '已接入模型服务',
      category: 'provider',
      parameters: p,
      inputTypes: ['prompt'],
      outputTypes: ['plan / proposal'],
      executionDomain: 'generation',
      availability: 'planning-only; no image/video generation node',
      animatable: false,
      execution: 'async',
      cost: 'provider metered',
      compatibility: 'explicit request only',
    })),
  ];
}
/** Backward-compatible plans acquire typed task metadata without replacing AgentPlan. */
export function resolveCreationDetails(
  plan: AgentPlan,
  registry: AgentToolRegistry,
  capabilities: ReturnType<typeof creationCapabilities>,
): CreationDetails {
  const details = creationDetailsSchema.parse(
    plan.creation ?? {
      intent: plan.goal,
      tasks: plan.steps.map((s) => ({
        id: s.id,
        description: s.label,
        executionDomain: domain(s.tool),
        strategy:
          domain(s.tool) === 'effect-forge'
            ? 'forge'
            : /^(create|reuse)|^effect_add/.test(s.tool)
              ? 'reuse'
              : /^(delete|connect|disconnect|setGraphOutput)/.test(s.tool)
                ? 'compose'
                : 'modify-existing',
        capabilityId: s.tool,
        stepIds: [s.id],
        dependencies: [],
      })),
      warnings: [],
    },
  );
  const taskIds = new Set(details.tasks.map((t) => t.id)),
    stepIds = new Set(plan.steps.map((s) => s.id));
  if (taskIds.size !== details.tasks.length)
    throw new AgentExecutionError({
      code: 'SCHEMA_INVALID',
      phase: 'preflight',
      field: 'creation.tasks.id',
      recoverable: true,
      message: '创作任务 ID 重复',
    });
  const assigned = details.tasks.flatMap((t) => t.stepIds);
  if (
    new Set(assigned).size !== assigned.length ||
    assigned.length !== stepIds.size ||
    assigned.some((id) => !stepIds.has(id))
  )
    throw new AgentExecutionError({
      code: 'SCHEMA_INVALID',
      phase: 'preflight',
      field: 'creation.tasks.stepIds',
      recoverable: true,
      message: '创作任务必须恰好覆盖每个计划步骤',
    });
  validatePlanDependencies({ ...plan, creation: details });
  for (const t of details.tasks) {
    const capability = capabilities.find((c) => c.id === t.capabilityId);
    if (!capability)
      throw new AgentExecutionError({
        code: 'CAPABILITY_MISSING',
        phase: 'preflight',
        field: 'creation.tasks.capabilityId',
        received: t.capabilityId,
        module: 'creation-planner',
        taskId: t.id,
        capabilityId: t.capabilityId,
        expected: {
          rule: 'An exact registered capability ID; native tasks use exact Tool Name',
          alternatives: [
            ...new Set(
              t.stepIds.map((id) => plan.steps.find((s) => s.id === id)!.tool),
            ),
          ].filter((name) =>
            capabilities.some(
              (c) => c.id === name && c.availability === 'available',
            ),
          ),
        },
        recoverable: true,
        message: '计划引用了未注册能力：' + t.capabilityId,
      });
    if (
      t.stepIds.some(
        (id) =>
          !registry
            .definitions()
            .some((d) => d.name === plan.steps.find((s) => s.id === id)!.tool),
      )
    )
      throw new AgentExecutionError({
        code: 'SCHEMA_INVALID',
        phase: 'preflight',
        field: 'creation.tasks.stepIds',
        recoverable: true,
        message: '任务引用了未注册工具',
      });
    const tools = t.stepIds.map(
      (id) => plan.steps.find((s) => s.id === id)!.tool,
    );
    if (
      capability.availability !== 'available' ||
      !tools.some((tool) =>
        (capability.executionTools as readonly string[]).includes(tool),
      )
    )
      throw new AgentExecutionError({
        code: 'CAPABILITY_UNAVAILABLE',
        phase: 'preflight',
        module: 'creation-planner',
        taskId: t.id,
        capabilityId: t.capabilityId,
        field: 'creation.tasks.capabilityId',
        expected: { executionTools: capability.executionTools },
        received: tools,
        recoverable: false,
        message: '创作能力与实际执行工具不匹配或不可用：' + t.capabilityId,
      });
    if (
      t.strategy === 'modify-existing' &&
      tools.some((tool) =>
        /^(create|delete|reuseProgrammableEffect)|^effect_(createDraft|applyDraft)/.test(
          tool,
        ),
      )
    )
      throw new AgentExecutionError({
        code: 'SCHEMA_INVALID',
        phase: 'preflight',
        field: 'creation.tasks.strategy',
        recoverable: true,
        message: '修改已有内容的任务不能创建或删除对象',
      });
    if (
      t.strategy === 'reuse' &&
      tools.some((tool) => /^effect_createDraft/.test(tool))
    )
      throw new AgentExecutionError({
        code: 'SCHEMA_INVALID',
        phase: 'preflight',
        field: 'creation.tasks.strategy',
        recoverable: true,
        message: '复用任务不能创建新的程序化草稿',
      });
    if (t.strategy === 'forge' && t.executionDomain !== 'effect-forge')
      throw new AgentExecutionError({
        code: 'SCHEMA_INVALID',
        phase: 'preflight',
        field: 'creation.tasks.executionDomain',
        recoverable: true,
        message: 'Forge 必须使用已存在的 Effect Forge 域',
      });
  }
  return details;
}
export function registerCreationTools(
  registry: AgentToolRegistry,
  library: () => readonly EffectPackage[] = () => [],
  providers: () => unknown[] = () => [],
) {
  const packages = () => [organicTexturePackage(), ...library()];
  registry.register(
    'discoverCapabilities',
    '查询真实命令、Fill/Generator/Effect/Node、可复用程序包及已接入服务。modify-existing > reuse > compose > generate > forge。',
    z.object({ query: z.string().max(200).default('') }).strict(),
    'READ',
    {
      read: (_ctx, a) => ({
        priority: ['modify-existing', 'reuse', 'compose', 'generate', 'forge'],
        capabilities: creationCapabilities(
          registry,
          packages(),
          providers(),
        ).filter((d) => {
          const terms = a.query
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
          const searchable = JSON.stringify({
            id: d.id,
            name: d.name,
            category: d.category,
            keywords: 'keywords' in d ? d.keywords : [],
          }).toLowerCase();
          return (
            !terms.length || terms.some((term) => searchable.includes(term))
          );
        }),
      }),
    },
  );
  const graphOf = (ctx: AgentToolContext, layerId: string) => {
    const layer = activeComposition(ctx.project).layers.find(
      (l) => l.id === layerId,
    );
    if (!layer?.editor?.graph) throw Error('目标图层没有节点图');
    return layer.editor.graph;
  };
  registry.register(
    'inspectGraphNode',
    '读取节点参数、端口连接、语义角色与下游渲染依赖，依赖不授予修改权限',
    z.object({ layerId: idSchema, nodeId: idSchema }).strict(),
    'READ',
    {
      read: (ctx, a) => {
        const g = graphOf(ctx, a.layerId),
          n = g.nodes.find((n) => n.id === a.nodeId);
        if (!n) throw Error('节点不存在');
        return inspectGraphNode(g, n);
      },
    },
  );
  registry.register(
    'inspectGraphBranch',
    '按选中末端节点查询上游分支；Source/Output不属于可编辑范围',
    z
      .object({ layerId: idSchema, nodeIds: z.array(idSchema).min(1).max(200) })
      .strict(),
    'READ',
    {
      read: (ctx, a) => {
        const g = graphOf(ctx, a.layerId),
          ids = graphBranch(g, a.nodeIds);
        return {
          nodeIds: ids,
          nodes: g.nodes
            .filter((n) => ids.includes(n.id))
            .map((n) => inspectGraphNode(g, n)),
          boundaryEdges: g.edges.filter(
            (e) => ids.includes(e.from.nodeId) !== ids.includes(e.to.nodeId),
          ),
        };
      },
    },
  );
  registry.register(
    'findRelatedNodes',
    '查询实际图内语义名称与类型；返回候选，无法唯一定位时必须让用户选择',
    z.object({ layerId: idSchema, query: z.string().max(200) }).strict(),
    'READ',
    {
      read: (ctx, a) =>
        graphOf(ctx, a.layerId).nodes.filter((n) =>
          `${n.name} ${n.type}`.toLowerCase().includes(a.query.toLowerCase()),
        ),
    },
  );
  registry.register(
    'getGraphDependencies',
    '读取目标节点的真实下游依赖',
    z.object({ layerId: idSchema, nodeId: idSchema }).strict(),
    'READ',
    {
      read: (ctx, a) => {
        const g = graphOf(ctx, a.layerId),
          n = g.nodes.find((n) => n.id === a.nodeId);
        if (!n) throw Error('节点不存在');
        return inspectGraphNode(g, n).outputDependencies;
      },
    },
  );
  registry.register(
    'renameGraphNode',
    '给已有节点设置可理解的语义名称',
    z.object({ nodeId: idSchema, name: z.string().min(1).max(200) }).strict(),
    'WRITE',
    {
      compile: (ctx, a) => {
        const l = activeComposition(ctx.project).layers.find((l) =>
          l.editor?.graph?.nodes.some((n) => n.id === a.nodeId),
        );
        if (!l?.editor?.graph) throw Error('节点不存在');
        editableLayer(ctx, l.id);
        return [
          graphCommand(
            ctx.project,
            l.id,
            patchGraphNode(l.editor.graph, a.nodeId, { name: a.name }),
          ),
        ];
      },
    },
  );
  registry.register(
    'reuseProgrammableEffect',
    '复用已验证的精确程序包版本/哈希；不生成新算法，不保存库。流动纹理用 organicTexture，再通过 merge 合成。',
    z
      .object({
        layerId: idSchema,
        id: z.string().max(80),
        version: z.string().max(30),
        contentHash: z.string().min(1),
        nodeId: idSchema,
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, a) => {
        const pkg = packages().find(
          (p) =>
            p.id === a.id &&
            p.version === a.version &&
            p.contentHash === a.contentHash,
        );
        if (!pkg) throw Error('可复用包版本/哈希不存在');
        const { layer } = editableLayer(ctx, a.layerId);
        if (!layer.editor?.graph) throw Error('目标没有图');
        const node = {
          ...createProgrammableNode(pkg),
          id: a.nodeId,
          metadata: { source: 'agent' as const },
        };
        return [
          graphCommand(
            ctx.project,
            layer.id,
            insertGraphNode(layer.editor.graph, node).graph,
          ),
        ];
      },
    },
  );
  registry.register(
    'setGraphOutput',
    '将已有 Image 输出接入当前图层的真实 Output，保留其他连接；不猜测处理端口',
    z
      .object({
        layerId: idSchema,
        nodeId: idSchema,
        portId: z.string().min(1).max(80),
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, a) => {
        const { layer } = editableLayer(ctx, a.layerId),
          g = layer.editor?.graph;
        if (!g) throw Error('没有处理图');
        const output = g.nodes.find((n) => n.id === g.outputNodeId)!,
          port = output.inputs.find((p) => p.type === 'Image');
        if (!port) throw Error('Output 图像端口缺失');
        return [
          graphCommand(
            ctx.project,
            layer.id,
            connectPorts(
              {
                ...g,
                edges: g.edges.filter(
                  (e) =>
                    !(e.to.nodeId === output.id && e.to.portId === port.id),
                ),
              },
              { nodeId: a.nodeId, portId: a.portId },
              { nodeId: output.id, portId: port.id },
            ),
          ),
        ];
      },
    },
  );
  registry.register(
    'layoutGraph',
    '将处理图按左到右拓扑自动排布，不改变连接、参数和 ID',
    z.object({ layerId: idSchema }).strict(),
    'WRITE',
    {
      compile: (ctx, a) => {
        const { layer } = editableLayer(ctx, a.layerId);
        if (!layer.editor?.graph) throw Error('没有节点图');
        return [
          graphCommand(
            ctx.project,
            layer.id,
            layoutCompositingGraph(layer.editor.graph),
          ),
        ];
      },
    },
  );
  return {
    registry,
    capabilities: () => creationCapabilities(registry, packages(), providers()),
  };
}
