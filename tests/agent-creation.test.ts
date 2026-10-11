import { expect, it } from 'vitest';
import { newId } from '../src/core/core-types';
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import { CommandSystem } from '../src/core/command-system';
import { loadProject, saveProject } from '../src/core/project-io';
import { compileGraph } from '../src/core/compositing-compiler';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { registerReadTools } from '../src/agent/read-tools';
import { registerCompositingTools } from '../src/agent/compositing-tools';
import {
  registerCreationTools,
  resolveCreationDetails,
} from '../src/agent/creation-planner';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import { AgentTransaction } from '../src/agent/transaction';
import {
  creationDiff,
  validateCreationScope,
  resolveExecutionScope,
} from '../src/agent/creation-scope';
import {
  agentPlanSchema,
  type AgentPlan,
  type AgentRuntimePort,
} from '../src/agent/session';
import { AgentOrchestrator } from '../src/agent/orchestrator';
import { defaultAISettings } from '../src/ai/contracts';
import { organicTexturePackage } from '../src/core/effect-examples';
import type { ExecutionScope } from '../src/agent/creation-contracts';
const signal = new AbortController().signal;
function setup() {
  const base = createDefaultProject(),
    camera = createLayer('camera'),
    other = createLayer('rectangle');
  const host = new CommandSystem({
    ...base,
    compositions: [{ ...base.compositions[0]!, layers: [camera, other] }],
  });
  const registry = registerReadTools(
    registerCompositingTools(
      registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
    ),
  );
  const creation = registerCreationTools(registry);
  return { host, registry, creation, camera, other };
}
export async function titleComposition(
  registry: AgentToolRegistry,
  host: CommandSystem,
) {
  const before = host.getSnapshot(),
    scope: ExecutionScope = {
      kind: 'FULL_COMPOSITION',
      compositionId: before.activeCompositionId,
    };
  const draft = new AgentTransaction(
    host,
    registry,
    before,
    { time: 0, selection: [] },
    false,
    undefined,
    (a, b) => validateCreationScope(a, b, scope),
  );
  const background = newId(),
    title = newId(),
    gradient = newId(),
    noise = newId(),
    merge = newId(),
    glow = newId();
  const calls: Array<[string, Record<string, unknown>]> = [
    [
      'createLayer',
      {
        kind: 'solid',
        layerId: background,
        name: '背景',
        width: 1920,
        height: 1080,
      },
    ],
    [
      'createNode',
      { layerId: background, type: 'radialGradient', nodeId: gradient },
    ],
    [
      'setNodeParameter',
      {
        nodeId: gradient,
        key: 'stops',
        value: [0, 0.08, 0.3, 0.8, 1, 1, 0.01, 0.025, 0.09, 1],
      },
    ],
    [
      'reuseProgrammableEffect',
      {
        layerId: background,
        id: 'organicTexture',
        version: '1.0.0',
        contentHash: organicTexturePackage().contentHash,
        nodeId: noise,
      },
    ],
    [
      'createNode',
      {
        layerId: background,
        type: 'merge',
        nodeId: merge,
        position: { x: 560, y: 40 },
      },
    ],
    [
      'connectNodes',
      {
        from: { nodeId: gradient, portId: 'out' },
        to: { nodeId: merge, portId: 'b' },
      },
    ],
    [
      'connectNodes',
      {
        from: { nodeId: noise, portId: 'out' },
        to: { nodeId: merge, portId: 'a' },
      },
    ],
    ['setNodeParameter', { nodeId: merge, key: 'opacity', value: 0.12 }],
    ['setGraphOutput', { layerId: background, nodeId: merge, portId: 'out' }],
    ['createNode', { layerId: background, type: 'glow', nodeId: glow }],
    ['renameGraphNode', { nodeId: gradient, name: '背景 · 径向渐变' }],
    ['renameGraphNode', { nodeId: glow, name: '背景 · 柔和发光' }],
    ['layoutGraph', { layerId: background }],
    [
      'createText',
      {
        layerId: title,
        name: '科技标题',
        content: 'SWAYFRAME',
        position: { x: 960, y: 600 },
      },
    ],
    ['setFill', { layerId: title, color: { r: 1, g: 1, b: 1, a: 1 } }],
    [
      'addKeyframe',
      {
        layerId: title,
        property: 'position',
        time: 0,
        value: { x: 960, y: 680 },
        interpolation: { type: 'spring', stiffness: 140, damping: 14, mass: 1 },
      },
    ],
    [
      'addKeyframe',
      {
        layerId: title,
        property: 'position',
        time: 1,
        value: { x: 960, y: 540 },
      },
    ],
    ['addKeyframe', { layerId: title, property: 'opacity', time: 0, value: 0 }],
    [
      'addKeyframe',
      { layerId: title, property: 'opacity', time: 0.4, value: 1 },
    ],
  ];
  for (const [name, args] of calls) await draft.execute(name, args, signal);
  return {
    draft,
    before,
    scope,
    background,
    title,
    gradient,
    noise,
    merge,
    glow,
    calls,
  };
}
it('A/B/C: discovers real capabilities and creates an editable gradient/noise/glow/title composition', async () => {
  const s = setup(),
    caps = (await s.registry.read(
      'discoverCapabilities',
      { query: '径向渐变' },
      { project: s.host.getSnapshot(), selection: [], time: 0 },
      signal,
    )) as { capabilities: { id: string }[] };
  expect(caps.capabilities.some((c) => c.id === 'radialGradient')).toBe(true);
  const multi = (await s.registry.read(
    'discoverCapabilities',
    { query: 'radialGradient glow text' },
    { project: s.host.getSnapshot(), selection: [], time: 0 },
    signal,
  )) as {
    capabilities: {
      id: string;
      parameters: { id: string; valueEncoding?: string }[];
    }[];
  };
  expect(multi.capabilities.some((c) => c.id === 'radialGradient')).toBe(true);
  expect(multi.capabilities.some((c) => c.id === 'glow')).toBe(true);
  expect(
    multi.capabilities
      .find((c) => c.id === 'radialGradient')
      ?.parameters.find((p) => p.id === 'stops')?.valueEncoding,
  ).toContain('[position,r,g,b,a]');
  const r = await titleComposition(s.registry, s.host),
    next = r.draft.getSnapshot(),
    layers = activeComposition(next).layers;
  expect(s.host.getSnapshot()).toBe(r.before);
  const graph = layers.find((l) => l.id === r.background)!.editor!.graph!;
  expect(compileGraph(graph).valid).toBe(true);
  expect(graph.nodes.filter((n) => n.type === 'radialGradient')).toHaveLength(
    1,
  );
  expect(graph.nodes.filter((n) => n.type === 'gaussianBlur')).toHaveLength(0);
  const title = layers.find((l) => l.id === r.title)!;
  expect(title.type).toBe('text');
  expect(title.transform.position.keyframes).toHaveLength(2);
  expect(title.transform.position.keyframes[0]!.interpolation.type).toBe(
    'spring',
  );
  const positions = graph.nodes.map((n) => `${n.position.x},${n.position.y}`);
  expect(new Set(positions).size).toBe(positions.length);
  r.draft.commit('创建标题动画');
  expect(s.host.undoStack).toHaveLength(1);
  expect(loadProject(saveProject(s.host.getSnapshot()))).toEqual(
    s.host.getSnapshot(),
  );
  s.host.undo();
  expect(s.host.getSnapshot()).toEqual(r.before);
});
it('E: branch proposal preserves noise, title/keyframes/curve, camera, unrelated graph and IDs; one Undo and round-trip', async () => {
  const s = setup(),
    r = await titleComposition(s.registry, s.host);
  r.draft.commit('创建');
  const base = s.host.getSnapshot(),
    scope = resolveExecutionScope(base, {
      kind: 'SELECTED_BRANCH',
      compositionId: base.activeCompositionId,
      layerId: r.background,
      nodeIds: [r.glow],
    });
  const draft = new AgentTransaction(
    s.host,
    s.registry,
    base,
    { time: 0, selection: [r.background] },
    false,
    undefined,
    (a, b) => validateCreationScope(a, b, scope),
  );
  await draft.execute(
    'setNodeParameter',
    {
      nodeId: r.gradient,
      key: 'stops',
      value: [0, 0.5, 0.1, 0.9, 1, 1, 0.08, 0.01, 0.15, 1],
    },
    signal,
  );
  await draft.execute(
    'setNodeParameter',
    { nodeId: r.glow, key: 'amount', value: 0.5 },
    signal,
  );
  const next = draft.getSnapshot(),
    p = creationDiff(base, next, scope);
  if (process.env.SWAYFRAME_WRITE_FIXTURE === '1') {
    const fs = await import('node:fs/promises');
    await fs.writeFile(
      'outputs/agent-creation/preservation-before.swayframe',
      saveProject(base),
    );
    await fs.writeFile(
      'outputs/agent-creation/preservation-after.swayframe',
      saveProject(next),
    );
    await fs.writeFile(
      'outputs/agent-creation/preservation-proposal.json',
      JSON.stringify(p, null, 2),
    );
  }
  expect(p.nodes.created).toHaveLength(0);
  expect(p.nodes.deleted).toHaveLength(0);
  expect(p.nodes.modified.sort()).toEqual([r.gradient, r.glow].sort());
  expect(p.connections.modified).toHaveLength(0);
  for (const id of [r.title, s.camera.id, s.other.id])
    expect(activeComposition(next).layers.find((l) => l.id === id)).toEqual(
      activeComposition(base).layers.find((l) => l.id === id),
    );
  const node = (project: typeof base, id: string) =>
    activeComposition(project)
      .layers.find((l) => l.id === r.background)!
      .editor!.graph!.nodes.find((n) => n.id === id);
  expect(node(next, r.noise)).toEqual(node(base, r.noise));
  expect(s.host.getSnapshot()).toBe(base);
  draft.commit('背景变紫');
  expect(s.host.undoStack).toHaveLength(2);
  expect(loadProject(saveProject(s.host.getSnapshot()))).toEqual(next);
  s.host.undo();
  expect(s.host.getSnapshot()).toEqual(base);
  s.host.redo();
  expect(s.host.getSnapshot()).toEqual(next);
});
it('scope: parameter-only cannot edit another node, add layers, move a node or alter topology; branch cannot alter boundary', async () => {
  const s = setup(),
    r = await titleComposition(s.registry, s.host);
  r.draft.commit('创建');
  const base = s.host.getSnapshot(),
    scope = resolveExecutionScope(base, {
      kind: 'PARAMETER_ONLY',
      compositionId: base.activeCompositionId,
      layerId: r.background,
      nodeIds: [r.glow],
    });
  for (const [tool, args] of [
    ['setNodeParameter', { nodeId: r.gradient, key: 'radius', value: 2 }],
    ['createText', { content: 'NO' }],
    ['setNodePosition', { nodeId: r.glow, position: { x: 1, y: 2 } }],
    ['createNode', { layerId: r.background, type: 'gaussianBlur' }],
  ] as const) {
    const draft = new AgentTransaction(
      s.host,
      s.registry,
      base,
      { time: 0, selection: [] },
      false,
      undefined,
      (a, b) => validateCreationScope(a, b, scope),
    );
    await expect(draft.execute(tool, args, signal)).rejects.toThrow('范围');
    expect(() => draft.commit('不能提交')).toThrow('已结束');
    expect(s.host.getSnapshot()).toBe(base);
  }
  const branch = resolveExecutionScope(base, {
    kind: 'SELECTED_BRANCH',
    compositionId: base.activeCompositionId,
    layerId: r.background,
    nodeIds: [r.gradient],
  });
  const d = new AgentTransaction(
    s.host,
    s.registry,
    base,
    { time: 0, selection: [] },
    false,
    undefined,
    (a, b) => validateCreationScope(a, b, branch),
  );
  await expect(
    d.execute(
      'setGraphOutput',
      { layerId: r.background, nodeId: r.gradient, portId: 'out' },
      signal,
    ),
  ).rejects.toThrow('范围');
});
it('planner schema validates task dependencies, exact coverage and real capability IDs', () => {
  const s = setup(),
    plan: AgentPlan = {
      id: 'p',
      goal: '创建红色矩形',
      risk: 'low',
      steps: [
        { id: 'a', label: '矩形', tool: 'createRectangle', arguments: {} },
      ],
    };
  const creation = resolveCreationDetails(
    plan,
    s.registry,
    s.creation.capabilities(),
  );
  expect(creation.tasks[0]!.executionDomain).toBe('scene');
  expect(() =>
    resolveCreationDetails(
      {
        ...plan,
        creation: {
          ...creation,
          tasks: [{ ...creation.tasks[0]!, dependencies: ['a'] }],
        },
      },
      s.registry,
      s.creation.capabilities(),
    ),
  ).toThrow('依赖');
  expect(() =>
    resolveCreationDetails(
      {
        ...plan,
        creation: {
          ...creation,
          tasks: [{ ...creation.tasks[0]!, capabilityId: 'made-up' }],
        },
      },
      s.registry,
      s.creation.capabilities(),
    ),
  ).toThrow('未注册');
  expect(() =>
    agentPlanSchema.parse({ ...plan, unsafeScript: 'eval' }),
  ).toThrow();
});
it('orchestrator previews, rejects, accepts and refuses stale proposals without touching formal Scene', async () => {
  const s = setup(),
    base = s.host.getSnapshot(),
    scope: ExecutionScope = {
      kind: 'FULL_COMPOSITION',
      compositionId: base.activeCompositionId,
    },
    plan: AgentPlan = {
      id: 'p',
      goal: '红色矩形',
      risk: 'low',
      steps: [
        { id: 'a', label: '矩形', tool: 'createRectangle', arguments: {} },
      ],
    };
  const runtime: AgentRuntimePort = {
    project: s.host.getSnapshot,
    context: () => ({}),
    tools: () => s.registry.definitions(),
    permission: (n, a) => s.registry.permission(n, a),
    validate: (p) => s.registry.validatePlan(p),
    preparePlan: (p) => ({
      ...p,
      creation: resolveCreationDetails(
        p,
        s.registry,
        s.creation.capabilities(),
      ),
    }),
    reviewDraft: (a, b) => {
      validateCreationScope(a, b, scope);
      return creationDiff(a, b, scope);
    },
    begin: (p) =>
      new AgentTransaction(s.host, s.registry, p, { time: 0, selection: [] }),
  };
  const agent = new AgentOrchestrator(
    runtime,
    {
      chat: async () => ({
        model: 'fixture',
        text: '',
        toolCalls: [{ id: 'c', name: 'submitPlan', arguments: plan }],
      }),
    },
    defaultAISettings,
  );
  await agent.run('红色矩形');
  expect(agent.getSnapshot().pendingConfirmation).toBe(true);
  await agent.preview('p');
  expect(agent.getSnapshot().creationProposal!.objects.created).toHaveLength(1);
  expect(s.host.getSnapshot()).toBe(base);
  agent.stop();
  expect(s.host.getSnapshot()).toBe(base);
  await agent.run('红色矩形');
  await agent.preview('p');
  await agent.apply('p');
  expect(s.host.undoStack).toHaveLength(1);
  s.host.undo();
  expect(s.host.getSnapshot()).toEqual(base);
  await agent.run('红色矩形');
  await agent.preview('p');
  const other = new AgentTransaction(s.host, s.registry, s.host.getSnapshot(), {
    time: 0,
    selection: [],
  });
  await other.execute('createText', { content: '用户修改' }, signal);
  other.commit('用户');
  const current = s.host.getSnapshot();
  await agent.apply('p');
  expect(agent.getSnapshot().status).toBe('failed');
  expect(s.host.getSnapshot()).toBe(current);
});
it('D: blur radius 20→35 reuses one node, rejects preserve formal state and single Undo restores 20', async () => {
  const s = setup(),
    layerId = s.other.id,
    nodeId = newId();
  const initial = new AgentTransaction(
    s.host,
    s.registry,
    s.host.getSnapshot(),
    { time: 0, selection: [] },
  );
  await initial.execute(
    'createNode',
    { layerId, type: 'gaussianBlur', nodeId },
    signal,
  );
  await initial.execute(
    'setNodeParameter',
    { nodeId, key: 'radius', value: 20 },
    signal,
  );
  initial.commit('模糊');
  const base = s.host.getSnapshot();
  const scope = resolveExecutionScope(base, {
    kind: 'PARAMETER_ONLY',
    compositionId: base.activeCompositionId,
    layerId,
    nodeIds: [nodeId],
  });
  const draft = new AgentTransaction(
    s.host,
    s.registry,
    base,
    { time: 0, selection: [] },
    false,
    undefined,
    (a, b) => validateCreationScope(a, b, scope),
  );
  await draft.execute(
    'setNodeParameter',
    { nodeId, key: 'radius', value: 35 },
    signal,
  );
  expect(
    creationDiff(base, draft.getSnapshot(), scope).parameters,
  ).toMatchObject([{ key: 'radius', before: 20, after: 35 }]);
  expect(s.host.getSnapshot()).toBe(base);
  draft.commit('增加模糊');
  const graph = activeComposition(s.host.getSnapshot()).layers.find(
    (l) => l.id === layerId,
  )!.editor!.graph!;
  expect(graph.nodes.filter((n) => n.type === 'gaussianBlur')).toHaveLength(1);
  s.host.undo();
  expect(s.host.getSnapshot()).toEqual(base);
});
it('F: rectangle→position→keyframes→spring edits preserve layer, graph and keyframe IDs', async () => {
  const s = setup(),
    layerId = newId();
  const apply = async (calls: Array<[string, Record<string, unknown>]>) => {
    const tx = new AgentTransaction(s.host, s.registry, s.host.getSnapshot(), {
      time: 0,
      selection: [],
    });
    for (const [tool, args] of calls) await tx.execute(tool, args, signal);
    tx.commit('最小修改');
  };
  await apply([
    ['createRectangle', { layerId }],
    ['setFill', { layerId, color: { r: 1, g: 0, b: 0, a: 1 } }],
  ]);
  const layer = () =>
    activeComposition(s.host.getSnapshot()).layers.find(
      (l) => l.id === layerId,
    )!;
  const graph = layer().editor!.graph!;
  expect(graph.nodes).toHaveLength(2);
  await apply([['setPosition', { layerId, value: { x: 1200, y: 540 } }]]);
  const first = newId(),
    last = newId();
  await apply([
    [
      'addKeyframe',
      {
        layerId,
        property: 'position',
        keyframeId: first,
        time: 0,
        value: { x: 960, y: 540 },
      },
    ],
    [
      'addKeyframe',
      {
        layerId,
        property: 'position',
        keyframeId: last,
        time: 2,
        value: { x: 1400, y: 540 },
      },
    ],
  ]);
  const propertyId = layer().transform.position.id;
  await apply([
    [
      'setInterpolation',
      {
        propertyId,
        keyframeId: first,
        interpolation: { type: 'spring', stiffness: 100, damping: 9, mass: 1 },
      },
    ],
  ]);
  expect(layer().editor!.graph).toEqual(graph);
  expect(layer().transform.position.keyframes.map((k) => k.id)).toEqual([
    first,
    last,
  ]);
  expect(layer().transform.position.keyframes[0]!.interpolation.type).toBe(
    'spring',
  );
  expect(layer().transform.position.keyframes.map((k) => k.time)).toEqual([
    0, 2,
  ]);
});
