import { expect, it, vi } from 'vitest';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { registerReadTools } from '../src/agent/read-tools';
import { registerSemanticActions } from '../src/agent/semantic-actions';
import { AgentTransaction } from '../src/agent/transaction';
import { AgentOrchestrator } from '../src/agent/orchestrator';
import type { AgentPlan, AgentRuntimePort } from '../src/agent/session';
import { verifyExecutionState } from '../src/agent/execution-verification';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import {
  createDefaultProject,
  activeComposition,
  createLayer,
  type Project,
} from '../src/core/project-model';
import { evaluateProperty } from '../src/core/animation-engine';
import { saveProject, loadProject } from '../src/core/project-io';
import { defaultAISettings } from '../src/ai/contracts';
import type { ProviderConfig } from '../src/ai/contracts';
import {
  createIsolatedCoreV2,
  defaultAgentRuntime,
  AgentPlanner,
  ProviderBridge,
  validateIntent,
} from '../src/agent-v2';
import { EditorAdapter } from '../src/agent-v2/editor-adapter';
import { TaskRuntime } from '../src/agent-v2/runtime';
import { problem, recoveryFeedback } from '../src/agent-v2/errors';
import { verifyAction } from '../src/agent-v2/verification';
import { benchmarks } from '../src/agent-v2/benchmarks';
import { executionTool, type SemanticAction } from '../src/agent-v2/actions';
import { validateRepair } from '../src/agent-v2/recovery';
const registry = () =>
  registerReadTools(
    registerSemanticActions(
      registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
    ),
  );
function setup(existing = false) {
  let base = createDefaultProject();
  if (existing)
    base = {
      ...base,
      compositions: base.compositions.map((c) => ({
        ...c,
        layers: [createLayer('rectangle', { name: 'Protected' })],
      })),
    };
  const host = new CommandSystem(base),
    reg = registry(),
    scope = {
      compositionId: base.activeCompositionId,
      existingLayerIds: [],
      allowCreate: true,
    };
  base = host.getSnapshot();
  const adapter = new EditorAdapter(host, reg, scope, []);
  return { base, host, reg, scope, adapter, runtime: new TaskRuntime(adapter) };
}
const shape = {
  goal: 'rectangle',
  actions: [{ id: 'shape', type: 'createShape', shape: 'rectangle' }],
};
const provider: ProviderConfig = {
  id: crypto.randomUUID(),
  name: 'Fixture',
  type: 'mock',
  baseUrl: 'http://localhost',
  enabled: true,
  defaultModel: 'fixture',
  models: [{ id: 'fixture', name: 'Fixture', capabilities: ['text'] }],
};
function semantic(project: Project) {
  return activeComposition(project).layers.map((l) => ({
    name: l.name,
    type: l.type,
    shapeKind: l.type === 'shape' ? l.shapeKind : null,
    text: l.type === 'text' ? l.text : null,
    font: l.type === 'text' ? l.fontFamily : null,
    fontSize: l.type === 'text' ? l.fontSize : null,
    width: l.width,
    height: l.height,
    position: l.transform.position.baseValue,
    fill: l.editor?.properties.fill?.baseValue,
    gradient: l.editor?.gradient,
    radial: Object.fromEntries(
      Object.entries(l.editor?.properties ?? {})
        .filter(([key]) => key.startsWith('radial_'))
        .map(([key, p]) => [key, p.baseValue]),
    ),
    frames: l.transform.position.keyframes.map((k) => ({
      time: k.time,
      value: k.value,
      interpolation: k.interpolation,
    })),
    effects: l.editor?.graph?.nodes
      .filter((n) => !['source', 'output'].includes(n.type))
      .map((n) => n.type),
  }));
}
/** Fixed model fixtures; V1 still executes its real Orchestrator/Registry/AgentTransaction. */
function legacyPlan(intent: ReturnType<typeof validateIntent>): AgentPlan {
  const steps = intent.actions
    .filter((a) => a.type !== 'modifyKeyframe')
    .map((a) => {
      const { id, type, dependsOn, ...params } = a;
      void type;
      void dependsOn;
      let args: unknown = params;
      if (a.type === 'createShape') {
        const { shape, ...p } = params as Omit<
          Extract<SemanticAction, { type: 'createShape' }>,
          'id' | 'type' | 'dependsOn'
        >;
        void shape;
        args = p;
      }
      if ('target' in a) {
        const layerId =
          a.target.kind === 'result'
            ? {
                kind: 'stepResult',
                stepId: a.target.actionId,
                output: 'layerId',
              }
            : a.target.kind === 'existing'
              ? a.target.id
              : { kind: 'selection', objectType: 'layer' };
        if (a.type === 'setFill') {
          const { target, ...p } = params as Omit<
            Extract<SemanticAction, { type: 'setFill' }>,
            'id' | 'type' | 'dependsOn'
          >;
          void target;
          args = { layerId, ...p };
        }
        if (a.type === 'setProperty') args = { layerId, value: a.value };
        if (a.type === 'addEffect') args = { layerId, kind: a.effect };
        if (a.type === 'addKeyframe') {
          const modifier = intent.actions.find(
            (m) =>
              m.type === 'modifyKeyframe' &&
              m.keyframe.kind === 'result' &&
              m.keyframe.actionId === a.id,
          );
          args = {
            layerId,
            property: a.property,
            time: a.time,
            value: a.value,
            ...(modifier?.type === 'modifyKeyframe'
              ? { interpolation: modifier.interpolation }
              : {}),
          };
        }
      }
      return {
        id,
        label: id,
        tool: executionTool(a),
        arguments: args as Record<string, unknown>,
      };
    });
  return { id: 'fixture', goal: intent.goal, risk: 'low', steps };
}
async function legacy(
  s: ReturnType<typeof setup>,
  plan: AgentPlan,
  inject = false,
) {
  const ctx = { project: s.base, time: 0, selection: [] };
  let injected = false;
  const runtime: AgentRuntimePort = {
    project: s.host.getSnapshot,
    context: () => ({}),
    tools: () => s.reg.definitions(),
    permission: (n, a) => s.reg.permission(n, a),
    validate: (p) => s.reg.validatePlan(p, undefined, ctx),
    begin: () => {
      const tx = new AgentTransaction(s.host, s.reg, s.base, ctx),
        execute = tx.execute.bind(tx);
      if (inject)
        tx.execute = async (n, a, signal, id) => {
          if (n === 'addEffect' && !injected) {
            injected = true;
            throw Object.assign(new Error('injected arguments'), {
              code: 'TOOL_ARGUMENT_INVALID',
              phase: 'execute',
              recoverable: true,
              field: 'kind',
            });
          }
          return execute(n, a, signal, id);
        };
      return tx;
    },
    verifyExecution: async (b, d, e) => verifyExecutionState(s.reg, b, d, e),
  };
  const chat = vi.fn(async () => ({
    model: 'offline-fixture',
    text: '',
    toolCalls: [{ id: 'fixed', name: 'submitPlan', arguments: plan }],
  }));
  const settings = defaultAISettings();
  settings.agent.visualVerification = false;
  settings.agent.autoApplySafe = false;
  const agent = new AgentOrchestrator(runtime, { chat }, () => settings);
  await agent.run(plan.goal);
  let state = agent.getSnapshot();
  if (state.currentPlan && state.pendingConfirmation) {
    await agent.preview(state.currentPlan.id);
    state = agent.getSnapshot();
    if (state.pendingConfirmation) await agent.apply(state.currentPlan!.id);
  }
  return agent.getSnapshot();
}
it.each(benchmarks)(
  '$id: V2 isolated draft, postconditions, one accept/Undo/Redo/serialization',
  async ({ intent }) => {
    const s = setup(true),
      result = await s.runtime.run(intent);
    expect(result.phase).toBe('AWAITING_ACCEPTANCE');
    expect(s.host.getSnapshot()).toBe(s.base);
    expect(result.completedActions).toHaveLength(intent.actions.length);
    expect(result.modelRequests).toBe(0);
    s.runtime.accept(result.proposalId!);
    expect(s.host.undoStack).toHaveLength(1);
    expect(activeComposition(s.host.getSnapshot()).layers[0]).toEqual(
      activeComposition(s.base).layers[0],
    );
    const final = saveProject(s.host.getSnapshot());
    expect(saveProject(loadProject(final))).toBe(final);
    s.host.undo();
    expect(s.host.getSnapshot()).toEqual(s.base);
    s.host.redo();
    expect(saveProject(s.host.getSnapshot())).toBe(final);
  },
);
it.each(benchmarks)(
  '$id: actual Legacy V1 and V2 produce equivalent semantic state',
  async ({ intent }) => {
    const v1 = setup(),
      v2 = setup();
    const state = await legacy(v1, legacyPlan(intent));
    expect(state.status).toBe('completed');
    const next = await v2.runtime.run(intent);
    expect(next.phase).toBe('AWAITING_ACCEPTANCE');
    v2.runtime.accept(next.proposalId!);
    expect(semantic(v1.host.getSnapshot())).toEqual(
      semantic(v2.host.getSnapshot()),
    );
  },
);
it('B1 second rectangle is Purple, no duplicate or unrelated layer', async () => {
  const s = setup();
  await s.runtime.run(benchmarks[0]!.intent);
  const ls = activeComposition(s.runtime.draftSnapshot()).layers;
  expect(ls).toHaveLength(3);
  expect(ls.map((l) => l.editor?.properties.fill?.baseValue)).toEqual([
    [1, 0, 0, 1],
    [0.5, 0, 0.5, 1],
    [0, 0, 1, 1],
  ]);
});
it('B4 actual animated property uses modified bezier at endpoints and midpoint', async () => {
  const s = setup();
  await s.runtime.run(benchmarks[3]!.intent);
  const p = activeComposition(s.runtime.draftSnapshot()).layers[0]!.transform
    .position;
  expect(p.keyframes).toHaveLength(2);
  expect(p.keyframes[0]!.interpolation.type).toBe('bezier');
  expect(evaluateProperty(p, 0)).toEqual({ x: 400, y: 540 });
  expect(evaluateProperty(p, 1)).toEqual({ x: 950, y: 540 });
  expect(evaluateProperty(p, 2)).toEqual({ x: 1500, y: 540 });
});
it('B5 failure recovers only failed action, real UUID binding and one blur/Undo', async () => {
  const s = setup(),
    original = s.adapter.execute.bind(s.adapter);
  let injected = false;
  const seen: string[] = [];
  vi.spyOn(s.adapter, 'execute').mockImplementation(async (a, t, k, signal) => {
    seen.push(a.id);
    if (a.type === 'addEffect' && !injected) {
      injected = true;
      throw problem('INVALID_ARGUMENTS', 'fixture injection', {
        recoverable: true,
        strategy: 'FAILED_ACTION_ONLY',
        field: 'effect',
      });
    }
    return original(a, t, k, signal);
  });
  const repair = vi.fn(async (a: SemanticAction) => ({ action: a })),
    runtime = new TaskRuntime(s.adapter, repair);
  const result = await runtime.run(benchmarks[4]!.intent);
  expect(result.phase).toBe('AWAITING_ACCEPTANCE');
  expect(seen).toEqual(['shape', 'blur', 'blur']);
  expect(repair).toHaveBeenCalledTimes(1);
  expect(result.recoveryAttempts).toBe(1);
  expect(activeComposition(runtime.draftSnapshot()).layers).toHaveLength(1);
  expect(result.references.shape?.layerId).toMatch(/^[0-9a-f-]{36}$/);
  expect(
    activeComposition(
      runtime.draftSnapshot(),
    ).layers[0]!.editor?.graph?.nodes.filter((n) => n.type === 'gaussianBlur'),
  ).toHaveLength(1);
  runtime.accept(result.proposalId!);
  s.host.undo();
  expect(s.host.getSnapshot()).toEqual(s.base);
});
it('repeated failure stops boundedly without replaying creation', async () => {
  const s = setup(),
    orig = s.adapter.execute.bind(s.adapter),
    ids: string[] = [];
  vi.spyOn(s.adapter, 'execute').mockImplementation(async (a, t, k, signal) => {
    ids.push(a.id);
    if (a.type === 'addEffect')
      throw problem('INVALID_ARGUMENTS', 'same', {
        recoverable: true,
        strategy: 'FAILED_ACTION_ONLY',
      });
    return orig(a, t, k, signal);
  });
  const repair = vi.fn(async (a: SemanticAction) => ({ action: a })),
    runtime = new TaskRuntime(s.adapter, repair);
  const state = await runtime.run(benchmarks[4]!.intent);
  expect(state.phase).toBe('FAILED');
  expect(ids).toEqual(['shape', 'blur', 'blur']);
  expect(repair).toHaveBeenCalledTimes(1);
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('cancel during recovery discards draft and blocks late continuation', async () => {
  const s = setup(),
    orig = s.adapter.execute.bind(s.adapter);
  vi.spyOn(s.adapter, 'execute').mockImplementation(async (a, t, k, signal) => {
    if (a.type === 'addEffect')
      throw problem('INVALID_ARGUMENTS', 'recover', {
        recoverable: true,
        strategy: 'FAILED_ACTION_ONLY',
      });
    return orig(a, t, k, signal);
  });
  let release: (a: SemanticAction) => void = () => {};
  const started = vi.fn();
  const runtime = new TaskRuntime(s.adapter, async () => {
    started();
    return new Promise<{ action: SemanticAction }>((r) => {
      release = (a) => r({ action: a });
    });
  });
  const run = runtime.run(benchmarks[4]!.intent);
  await vi.waitFor(() => expect(started).toHaveBeenCalled());
  runtime.cancel();
  release(benchmarks[4]!.intent.actions[1]!);
  expect((await run).phase).toBe('CANCELLED');
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('cancelled or succeeded task cannot be replayed', async () => {
  const s = setup();
  const r = await s.runtime.run(shape);
  s.runtime.accept(r.proposalId!);
  await expect(s.runtime.run(shape)).rejects.toMatchObject({
    diagnostic: { code: 'REPLAY_FORBIDDEN' },
  });
  expect(activeComposition(s.host.getSnapshot()).layers).toHaveLength(1);
});
it('stale formal base refuses commit and preserves newer user work', async () => {
  const s = setup();
  const result = await s.runtime.run(shape);
  s.host.executeTransaction(
    transaction('user', 'human', [
      command({
        type: 'layer.create',
        compositionId: s.base.activeCompositionId,
        layer: createLayer('rectangle', { name: 'User' }),
      }),
    ]),
  );
  expect(() => s.runtime.accept(result.proposalId!)).toThrow();
  expect(
    activeComposition(s.host.getSnapshot()).layers.map((l) => l.name),
  ).toEqual(['User']);
  expect(s.runtime.getSnapshot().phase).toBe('FAILED');
});
it('wrong proposal acceptance cannot commit', async () => {
  const s = setup();
  await s.runtime.run(shape);
  expect(() => s.runtime.accept('made-up')).toThrow();
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('existing object binding uses authorized UUID, not name guessing', async () => {
  const s = setup(true),
    id = activeComposition(s.base).layers[0]!.id;
  const runtime = new TaskRuntime(
    new EditorAdapter(
      s.host,
      s.reg,
      { ...s.scope, existingLayerIds: [id], allowCreate: false },
      [],
    ),
  );
  const state = await runtime.run({
    goal: 'modify authorized',
    actions: [
      {
        id: 'move',
        type: 'setProperty',
        target: { kind: 'existing', id },
        property: 'position',
        value: { x: 100, y: 200 },
      },
    ],
  });
  expect(state.phase).toBe('AWAITING_ACCEPTANCE');
  expect(state.targets).toEqual([id]);
});
it('selected object binding and ambiguous selection', async () => {
  const s = setup(true),
    id = activeComposition(s.base).layers[0]!.id;
  const scope = { ...s.scope, existingLayerIds: [id] };
  for (const selection of [[id], [id, id], []]) {
    const runtime = new TaskRuntime(
      new EditorAdapter(s.host, s.reg, scope, selection),
    );
    const state = await runtime.run({
      goal: 'selection',
      actions: [
        {
          id: 'move',
          type: 'setProperty',
          target: { kind: 'selection' },
          property: 'position',
          value: { x: 100, y: 200 },
        },
      ],
    });
    expect(state.phase).toBe(
      selection.length === 1 ? 'AWAITING_ACCEPTANCE' : 'FAILED',
    );
  }
});
it('unrelated object mutation refuses scope and leaves project untouched', async () => {
  const s = setup(true),
    id = activeComposition(s.base).layers[0]!.id;
  const state = await s.runtime.run({
    goal: 'not authorized',
    actions: [
      {
        id: 'move',
        type: 'setProperty',
        target: { kind: 'existing', id },
        property: 'position',
        value: { x: 100, y: 200 },
      },
    ],
  });
  expect(state.phase).toBe('FAILED');
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('missing or wrong-type step result cannot masquerade as layer UUID', async () => {
  const s = setup();
  const state = await s.runtime.run({
    goal: 'bad',
    actions: [
      ...benchmarks[3]!.intent.actions,
      {
        id: 'bad',
        type: 'setFill',
        target: { kind: 'result', actionId: 'start' },
        color: { r: 1, g: 0, b: 0, a: 1 },
      },
    ],
  });
  expect(state.phase).toBe('FAILED');
  expect(state.errors.some((e) => e.code === 'INVALID_REFERENCE')).toBe(true);
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('unknown capabilities and invented UUID fields are rejected before execution', async () => {
  for (const action of [
    { id: 'fake', type: 'shape.rectangle' },
    {
      id: 'shape',
      type: 'createShape',
      shape: 'rectangle',
      layerId: crypto.randomUUID(),
    },
  ]) {
    const s = setup();
    expect(
      (await s.runtime.run({ goal: 'bad', actions: [action] })).phase,
    ).toBe('FAILED');
    expect(s.runtime.getSnapshot().actionAttempts).toBe(0);
  }
});
it('registered tool missing is terminal rather than alias fabrication', async () => {
  const s = setup(),
    adapter = new EditorAdapter(s.host, new AgentToolRegistry(), s.scope, []),
    runtime = new TaskRuntime(adapter);
  const state = await runtime.run(shape);
  expect(state.phase).toBe('FAILED');
  expect(state.errors[0]?.code).toBe('MISSING_CAPABILITY');
});
it('defaults come from editor tools, no guessed model UUID', async () => {
  const s = setup();
  await s.runtime.run(shape);
  const layer = activeComposition(s.runtime.draftSnapshot()).layers[0]!;
  expect(layer.transform.position.baseValue).toEqual({ x: 960, y: 540 });
  expect(layer.width).toBeGreaterThan(0);
  expect(s.runtime.getSnapshot().references.shape?.layerId).toBe(layer.id);
});
it('stable dependency recovery orders real result references; cycles fail', () => {
  const p = validateIntent({
    goal: 'out of order',
    actions: [
      benchmarks[2]!.intent.actions[1],
      benchmarks[2]!.intent.actions[0],
    ],
  });
  expect(p.actions.map((a) => a.id)).toEqual(['shape', 'gradient']);
  expect(() =>
    validateIntent({
      goal: 'cycle',
      actions: [
        { id: 'a', type: 'createShape', shape: 'rectangle', dependsOn: ['b'] },
        { id: 'b', type: 'createShape', shape: 'rectangle', dependsOn: ['a'] },
      ],
    }),
  ).toThrow();
});
it('duplicate IDs and self dependency fail', () => {
  expect(() =>
    validateIntent({
      goal: 'bad',
      actions: [shape.actions[0], shape.actions[0]],
    }),
  ).toThrow();
  expect(() =>
    validateIntent({
      goal: 'bad',
      actions: [{ ...shape.actions[0], dependsOn: ['shape'] }],
    }),
  ).toThrow();
});
it('repair cannot replace succeeded action, expand targets, or dependencies', () => {
  const a = benchmarks[4]!.intent.actions[1]!;
  expect(() => validateRepair(a, { ...a, id: 'shape' })).toThrow();
  expect(() =>
    validateRepair(a, {
      ...a,
      target: { kind: 'existing', id: crypto.randomUUID() },
    }),
  ).toThrow();
  expect(() => validateRepair(a, { ...a, dependsOn: ['shape'] })).toThrow();
});
it('action and model budgets remain hard limits', async () => {
  const s = setup();
  expect(
    (await new TaskRuntime(s.adapter, undefined, { actions: 0 }).run(shape))
      .phase,
  ).toBe('FAILED');
  expect(
    () => new TaskRuntime(s.adapter, undefined, { recoveries: 3 }),
  ).toThrow();
});
it('required renderer absent refuses completion and any commit', async () => {
  const s = setup();
  const state = await new TaskRuntime(s.adapter, undefined, {}, true).run(
    shape,
  );
  expect(state.phase).toBe('FAILED');
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('independent semantic verifier rejects successful command with wrong content', () => {
  const s = setup(true);
  expect(() =>
    verifyAction(benchmarks[1]!.intent.actions[0]!, s.base, {
      layerId: activeComposition(s.base).layers[0]!.id,
    }),
  ).toThrow();
});
it('state snapshots cannot mutate Runtime state or its draft', async () => {
  const s = setup();
  await s.runtime.run(shape);
  const state = s.runtime.getSnapshot();
  state.completedActions = [];
  const draft = s.runtime.draftSnapshot();
  (activeComposition(draft) as unknown as { layers: unknown[] }).layers = [];
  expect(s.runtime.getSnapshot().completedActions).toEqual(['shape']);
  expect(activeComposition(s.runtime.draftSnapshot()).layers).toHaveLength(1);
});
it('isolated runtime selection leaves V1 default and prevents concurrent V2 writer', () => {
  const s = setup();
  expect(defaultAgentRuntime).toBe('legacy-v1');
  const options = {
    isolatedProject: true as const,
    host: s.host,
    registry: s.reg,
    scope: s.scope,
  };
  const one = createIsolatedCoreV2(options);
  expect(() => createIsolatedCoreV2(options)).toThrow();
  one.cancel();
  expect(() => createIsolatedCoreV2(options)).not.toThrow();
});
it('provider tool normalization invokes same runtime; only one planning request', async () => {
  const s = setup();
  const chat = vi.fn(async () => ({
    text: '',
    model: 'fixture',
    toolCalls: [{ id: '1', name: 'submitIntent', arguments: shape }],
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
  }));
  const bridge = new ProviderBridge({ chat }, provider, 'fixture', 'tools');
  const state = await s.runtime.planAndRun(
    'rectangle',
    new AgentPlanner(bridge),
  );
  expect(state.phase).toBe('AWAITING_ACCEPTANCE');
  expect(chat).toHaveBeenCalledTimes(1);
  expect(state.modelRequests).toBe(1);
  expect(state.usage).toEqual([{ inputTokens: 100, outputTokens: 50 }]);
  expect(bridge.profile.toolCalling).toBe('unknown');
});
it('structured text normalization supports explicit text-only endpoint', async () => {
  const s = setup(),
    bridge = new ProviderBridge(
      {
        chat: async () => ({
          text: JSON.stringify(shape),
          model: 'fixture',
          toolCalls: [],
        }),
      },
      provider,
      'fixture',
      'structured-plan',
    );
  expect(
    (await s.runtime.planAndRun('rectangle', new AgentPlanner(bridge))).phase,
  ).toBe('AWAITING_ACCEPTANCE');
});
it.each(['partial', 'multiple', 'write'])(
  'provider %s never executes actions',
  async (mode) => {
    const s = setup(),
      bridge = new ProviderBridge(
        {
          chat: async () => ({
            text: '{"goal":',
            model: 'fixture',
            toolCalls:
              mode === 'partial'
                ? []
                : mode === 'multiple'
                  ? [
                      { id: 'a', name: 'submitIntent', arguments: shape },
                      { id: 'b', name: 'submitIntent', arguments: shape },
                    ]
                  : [{ id: 'a', name: 'createRectangle', arguments: {} }],
          }),
        },
        provider,
        'fixture',
        'tools',
      );
    expect(
      (await s.runtime.planAndRun('rectangle', new AgentPlanner(bridge))).phase,
    ).toBe('FAILED');
    expect(s.runtime.getSnapshot().actionAttempts).toBe(0);
    expect(s.host.getSnapshot()).toBe(s.base);
  },
);
it('recovery diagnostic remains valid bounded JSON', () => {
  const e = problem('INVALID_ARGUMENTS', 'x'.repeat(1000), {
    expected: { secret: 'not a raw error body' },
    actual: 'y'.repeat(2000),
  }).diagnostic;
  const feedback = recoveryFeedback(e);
  expect(feedback.length).toBeLessThan(1000);
  expect(JSON.parse(feedback).expected).toEqual({
    omitted: true,
    reason: 'inspect registered contract for structured values',
  });
});
it('actual registry argument failure repairs only failed action through Provider Bridge', async () => {
  const s = setup();
  const raw = {
    goal: 'create then set opacity',
    actions: [
      shape.actions[0],
      {
        id: 'opacity',
        type: 'setProperty',
        target: { kind: 'result', actionId: 'shape' },
        property: 'opacity',
        value: { x: 1, y: 1 },
      },
    ],
  };
  const chat = vi.fn(
    async (request: import('../src/ai/contracts').ChatRequest) => ({
      model: 'fixture',
      text: '',
      usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
      toolCalls: [
        {
          id: 'fixture',
          name: request.toolChoice!,
          arguments:
            request.toolChoice === 'submitIntent'
              ? raw
              : { ...raw.actions[1], value: 0.5 },
        },
      ],
    }),
  );
  const planner = new AgentPlanner(
      new ProviderBridge({ chat }, provider, 'fixture', 'tools'),
    ),
    runtime = new TaskRuntime(s.adapter, (a, e, signal) =>
      planner.repair(a, e, signal),
    );
  const result = await runtime.planAndRun(raw.goal, planner);
  expect(result.phase).toBe('AWAITING_ACCEPTANCE');
  expect(result.completedActions).toEqual(['shape', 'opacity']);
  expect(result.recoveryAttempts).toBe(1);
  expect(result.modelRequests).toBe(2);
  expect(result.usage).toHaveLength(2);
  expect(activeComposition(runtime.draftSnapshot()).layers).toHaveLength(1);
  expect(
    activeComposition(runtime.draftSnapshot()).layers[0]!.transform.opacity
      .baseValue,
  ).toBe(0.5);
  const second = chat.mock.calls[1]![0];
  expect(second.messages.at(-1)?.content).not.toContain('"actions"');
  expect(second.messages.at(-1)?.content).not.toContain('"compositions"');
});
it('explicit unsupported tool calling reports capability instead of generic command error', async () => {
  const s = setup(),
    bridge = new ProviderBridge(
      {
        chat: async () => {
          throw new (await import('../src/ai/contracts')).AIError(
            'invalid_request',
            'private upstream body',
            { kind: 'http', status: 400, code: 'unsupported_tools' },
          );
        },
      },
      provider,
      'fixture',
      'tools',
    );
  const state = await s.runtime.planAndRun(
    'rectangle',
    new AgentPlanner(bridge),
  );
  expect(state.errors[0]?.code).toBe('PROVIDER_UNSUPPORTED');
  expect(JSON.stringify(state)).not.toContain('private upstream body');
  expect(state.actionAttempts).toBe(0);
});
it('cancel while planner response is pending cannot create any layer', async () => {
  const s = setup();
  let release: () => void = () => {};
  const started = vi.fn();
  const bridge = new ProviderBridge(
    {
      chat: async () => {
        started();
        await new Promise<void>((r) => {
          release = r;
        });
        return {
          model: 'fixture',
          text: '',
          toolCalls: [{ id: 'x', name: 'submitIntent', arguments: shape }],
        };
      },
    },
    provider,
    'fixture',
    'tools',
  );
  const pending = s.runtime.planAndRun('rectangle', new AgentPlanner(bridge));
  await vi.waitFor(() => expect(started).toHaveBeenCalled());
  s.runtime.cancel();
  release();
  expect((await pending).phase).toBe('CANCELLED');
  expect(activeComposition(s.host.getSnapshot()).layers).toHaveLength(0);
});
it('corrupted keyframe interpolation cannot pass independent verification', async () => {
  const s = setup();
  await s.runtime.run(benchmarks[3]!.intent);
  const draft = s.runtime.draftSnapshot(),
    action = benchmarks[3]!.intent.actions[3]!,
    l = activeComposition(draft).layers[0]!;
  expect(() =>
    verifyAction(action, draft, {}, l.id, crypto.randomUUID()),
  ).toThrow();
});
it('repair cannot change property path to evade invalid value', () => {
  const a = validateIntent({
    goal: 'opacity',
    actions: [
      {
        id: 'opacity',
        type: 'setProperty',
        target: { kind: 'selection' },
        property: 'opacity',
        value: 0,
      },
    ],
  }).actions[0]!;
  expect(() =>
    validateRepair(a, { ...a, property: 'position', value: { x: 1, y: 1 } }),
  ).toThrow();
});
it('renderer failure is typed verification failure rather than command rejection', async () => {
  const s = setup(),
    adapter = new EditorAdapter(s.host, s.reg, s.scope, [], async () => {
      throw new TypeError('internal test renderer');
    });
  const state = await new TaskRuntime(adapter).run(shape);
  expect(state.phase).toBe('FAILED');
  expect(state.errors.at(-1)).toMatchObject({
    code: 'VERIFICATION_FAILURE',
    phase: 'verification',
    field: 'renderer',
    actual: 'TypeError',
  });
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('missing keyframe belongs to no property and is refused before execution', async () => {
  const s = setup();
  const actions = [...benchmarks[3]!.intent.actions];
  actions[3] = {
    ...actions[3]!,
    keyframe: { kind: 'existing', id: crypto.randomUUID() },
  } as SemanticAction;
  const state = await s.runtime.run({ goal: 'wrong keyframe', actions });
  expect(state.phase).toBe('FAILED');
  expect(state.errors.some((e) => e.code === 'INVALID_REFERENCE')).toBe(true);
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('locked layer remains immutable even within allowed scope', async () => {
  const s = setup(true),
    l = activeComposition(s.base).layers[0]!;
  s.host.executeTransaction(
    transaction('lock', 'human', [
      command({
        type: 'layer.patch',
        compositionId: s.base.activeCompositionId,
        layerId: l.id,
        patch: { locked: true },
      }),
    ]),
  );
  const adapter = new EditorAdapter(
      s.host,
      s.reg,
      { ...s.scope, existingLayerIds: [l.id] },
      [],
    ),
    runtime = new TaskRuntime(adapter);
  const state = await runtime.run({
    goal: 'locked',
    actions: [
      {
        id: 'move',
        type: 'setProperty',
        target: { kind: 'existing', id: l.id },
        property: 'position',
        value: { x: 0, y: 0 },
      },
    ],
  });
  expect(state.phase).toBe('FAILED');
  expect(
    activeComposition(s.host.getSnapshot()).layers[0]!.transform.position
      .baseValue,
  ).toEqual(l.transform.position.baseValue);
});
it('verified proposal exposes real changed IDs and authorization before acceptance', async () => {
  const s = setup(true),
    state = await s.runtime.run(shape);
  expect(state.proposedChanges?.authorization).toEqual(s.scope);
  expect(state.proposedChanges?.diff.objects.created).toEqual([
    state.references.shape!.layerId,
  ]);
  expect(state.proposedChanges?.diff.objects.modified).toEqual([]);
  expect(s.host.getSnapshot()).toBe(s.base);
  s.runtime.cancel();
  expect(s.runtime.getSnapshot().proposedChanges).toBeNull();
});
