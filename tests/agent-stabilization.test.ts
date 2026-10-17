import { expect, it, vi } from 'vitest';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { registerSemanticActions } from '../src/agent/semantic-actions';
import { registerCompositingTools } from '../src/agent/compositing-tools';
import { registerReadTools } from '../src/agent/read-tools';
import {
  creationCapabilities,
  registerCreationTools,
  resolveCreationDetails,
} from '../src/agent/creation-planner';
import { ToolContextLoader } from '../src/agent/tool-context';
import { NativeSkillRuntime } from '../src/agent/native-skill-runtime';
import { AgentOrchestrator } from '../src/agent/orchestrator';
import { AgentTransaction } from '../src/agent/transaction';
import {
  RecoveryController,
  applyPlanRepair,
  classifyRecovery,
} from '../src/agent/recovery-controller';
import { AgentExecutionError } from '../src/agent/execution-error';
import { verifyExecutionState } from '../src/agent/execution-verification';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
import { saveProject, loadProject } from '../src/core/project-io';
import { evaluateProperty } from '../src/core/animation-engine';
import { defaultAISettings, AIError } from '../src/ai/contracts';
import type { AgentPlan, AgentRuntimePort } from '../src/agent/session';
const ref = (stepId: string, output = 'layerId') => ({
  kind: 'stepResult',
  stepId,
  output,
});
const minimal: AgentPlan = {
  id: 'minimal',
  goal: '创建矩形和Cubic文字淡入',
  risk: 'low',
  steps: [
    {
      id: 'rectangle',
      label: '矩形',
      tool: 'createRectangle',
      arguments: { name: 'Rectangle', width: 400, height: 300 },
    },
    {
      id: 'fill',
      label: '填充',
      tool: 'setFill',
      arguments: {
        layerId: ref('rectangle'),
        color: { r: 0, g: 0.7, b: 0.8, a: 1 },
      },
    },
    {
      id: 'text',
      label: '文本',
      tool: 'createText',
      arguments: { content: 'Cubic', name: 'Title', fontSize: 64 },
    },
    {
      id: 'font',
      label: '字体',
      tool: 'setFont',
      arguments: { layerId: ref('text'), fontFamily: 'serif' },
    },
    {
      id: 'position',
      label: '位置',
      tool: 'setPosition',
      arguments: { layerId: ref('text'), value: { x: 960, y: 450 } },
    },
    {
      id: 'key0',
      label: '关键帧0',
      tool: 'addKeyframe',
      arguments: {
        layerId: ref('text'),
        property: 'opacity',
        time: 0,
        value: 0,
      },
    },
    {
      id: 'key1',
      label: '关键帧1',
      tool: 'addKeyframe',
      arguments: {
        layerId: ref('text'),
        property: 'opacity',
        time: 2,
        value: 1,
      },
    },
  ],
};
function setup(skillsEnabled = false) {
  const registry = registerReadTools(
    registerCompositingTools(
      registerSemanticActions(
        registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
      ),
    ),
  );
  const creation = registerCreationTools(registry),
    host = new CommandSystem(createDefaultProject()),
    base = host.getSnapshot();
  const ctx = { project: base, time: 0, selection: [] };
  const skills = new NativeSkillRuntime(registry),
    loader = new ToolContextLoader(registry);
  loader.begin(
    minimal.goal,
    registry.catalog().map((t) => t.name),
  );
  skills.route(minimal.goal, skillsEnabled);
  const runtime: AgentRuntimePort = {
    project: host.getSnapshot,
    context: () => ({ nativeSkills: skills.context() }),
    tools: () => loader.definitions(),
    readTools: () =>
      loader
        .definitions()
        .filter((t) => registry.contract(t.name).permission === 'READ'),
    permission: (n, a) => registry.permission(n, a),
    preparePlan: (p) => ({
      ...p,
      creation: resolveCreationDetails(p, registry, creation.capabilities()),
    }),
    validate: (p) => {
      skills.validate(p, base);
      registry.validatePlan(p, undefined, ctx);
      resolveCreationDetails(p, registry, creation.capabilities());
    },
    inspect: async (n, a, s) => {
      const result = await registry.read(n, a, ctx, s);
      if (n === 'inspectToolContract')
        loader.load((a as { names: string[] }).names);
      return result;
    },
    begin: () => new AgentTransaction(host, registry, base, ctx),
    verifyExecution: async (b, d, e) => verifyExecutionState(registry, b, d, e),
    executionMetadata: () => ({
      skillIds: skills
        .context()
        .map((s) => ({ id: s.id, version: s.version, hash: s.hash })),
      selectedCapabilities: loader.metrics().loadedToolNames,
      registeredTools: registry.catalog().map((t) => t.name),
      availableCapabilities: creation.capabilities().map((c) => c.id),
    }),
  };
  const settings = defaultAISettings();
  settings.agent.visualVerification = false;
  const chat = vi.fn<
    NonNullable<ConstructorParameters<typeof AgentOrchestrator>[1]['chat']>
  >(async () => ({
    text: '',
    model: 'fixed-contract-fixture',
    toolCalls: [{ id: 'plan', name: 'submitPlan', arguments: minimal }],
  }));
  const agent = new AgentOrchestrator(runtime, { chat }, () => settings);
  return {
    host,
    base,
    registry,
    creation,
    ctx,
    skills,
    runtime,
    settings,
    chat,
    agent,
  };
}
function assertScene(s: ReturnType<typeof setup>) {
  const ls = activeComposition(s.host.getSnapshot()).layers;
  expect(ls).toHaveLength(2);
  const text = ls.find((l) => l.type === 'text')!;
  expect(text).toMatchObject({
    text: 'Cubic',
    fontFamily: 'serif',
    transform: { position: { baseValue: { x: 960, y: 450 } } },
  });
  expect(evaluateProperty(text.transform.opacity, 1)).toBe(0.5);
  expect(s.host.undoStack).toHaveLength(1);
  expect(saveProject(loadProject(saveProject(s.host.getSnapshot())))).toBe(
    saveProject(s.host.getSnapshot()),
  );
  const final = saveProject(s.host.getSnapshot());
  s.host.undo();
  expect(s.host.getSnapshot()).toEqual(s.base);
  s.host.redo();
  expect(saveProject(s.host.getSnapshot())).toBe(final);
}
it('registered Rectangle resolves to exact Tool capability and real layer.create Command', () => {
  const s = setup(),
    cap = creationCapabilities(s.registry).find(
      (c) => c.id === 'createRectangle',
    )!;
  expect(cap.executionTools).toEqual(['createRectangle']);
  expect(cap.parameters).toEqual(
    s.registry.contract('createRectangle').parameters,
  );
  expect(s.registry.compile('createRectangle', {}, s.ctx)[0]?.type).toBe(
    'layer.create',
  );
  expect(
    creationCapabilities(s.registry).some((c) => c.id === 'shape.rectangle'),
  ).toBe(false);
});
it('rejects unknown capability early; it is never registered as an alias', () => {
  const s = setup(),
    creation = resolveCreationDetails(
      minimal,
      s.registry,
      s.creation.capabilities(),
    );
  creation.tasks[0]!.capabilityId = 'shape.rectangle';
  expect(() =>
    resolveCreationDetails(
      { ...minimal, creation },
      s.registry,
      s.creation.capabilities(),
    ),
  ).toThrow('shape.rectangle');
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('visual capability may differ from Tool Name only with registry-derived execution mapping', () => {
  const s = setup();
  const p: AgentPlan = {
    id: 'fill',
    goal: 'radial',
    risk: 'low',
    steps: [{ id: 'fill', tool: 'setFill', label: 'fill', arguments: {} }],
    creation: {
      intent: 'radial',
      warnings: [],
      tasks: [
        {
          id: 'fill',
          description: 'radial',
          executionDomain: 'property',
          strategy: 'modify-existing',
          capabilityId: 'radialGradient',
          stepIds: ['fill'],
          dependencies: [],
        },
      ],
    },
  };
  expect(
    resolveCreationDetails(p, s.registry, s.creation.capabilities()).tasks[0]
      ?.capabilityId,
  ).toBe('radialGradient');
  p.steps[0]!.tool = 'createText';
  expect(() =>
    resolveCreationDetails(p, s.registry, s.creation.capabilities()),
  ).toThrow('不匹配');
});
it('stale Skill tool IDs fail before skill is advertised', () => {
  const s = setup();
  vi.spyOn(s.skills.registry, 'load').mockImplementation(
    () =>
      ({ manifest: { requiredCapabilities: ['shape.rectangle'] } }) as never,
  );
  expect(() => s.skills.route('矩形')).toThrow('真实能力');
  expect(s.skills.context()).toEqual([]);
});
it('planning READ is allowed, then fixed valid plan executes once', async () => {
  const s = setup();
  s.chat.mockResolvedValueOnce({
    text: '',
    model: 'fixture',
    toolCalls: [
      {
        id: 'read',
        name: 'discoverCapabilities',
        arguments: { query: 'rectangle' },
      },
    ],
  });
  await s.agent.run(minimal.goal);
  expect(s.agent.getSnapshot().status).toBe('completed');
  assertScene(s);
  expect(s.agent.getSnapshot().trace?.planning?.[0]).toMatchObject({
    inspectionCalls: 1,
    outcome: 'inspected',
  });
});
it.each(['createRectangle', 'inventedTool'])(
  'rejects %s in planning with precise reason and zero mutations',
  async (name) => {
    const s = setup();
    s.chat.mockResolvedValueOnce({
      text: '',
      model: 'fixture',
      toolCalls: [{ id: 'bad', name, arguments: {} }],
    });
    await s.agent.run(minimal.goal);
    const code =
      name === 'createRectangle' ? 'TOOL_NOT_ALLOWED' : 'TOOL_NOT_REGISTERED';
    expect(s.agent.getSnapshot().executionError).toMatchObject({
      code,
      phase: 'planning',
      module: 'orchestrator',
      toolName: name,
    });
    expect(s.agent.getSnapshot().trace?.planning?.[0]?.rejection).toMatchObject(
      { code, allowed: false },
    );
    expect(s.chat).toHaveBeenCalledOnce();
    expect(s.host.getSnapshot()).toBe(s.base);
  },
);
it('three inspection rounds do not consume separate repair attempts', async () => {
  const s = setup();
  for (let i = 0; i < 3; i++)
    s.chat.mockResolvedValueOnce({
      text: '',
      model: 'fixture',
      toolCalls: [{ id: String(i), name: 'inspectComposition', arguments: {} }],
    });
  await s.agent.run(minimal.goal);
  expect(s.chat).toHaveBeenCalledTimes(4);
  expect(s.chat.mock.calls[3]![1].tools?.map((t) => t.name)).toEqual([
    'submitPlan',
  ]);
  assertScene(s);
});
it('bounded READ count rejects only excess call, then requires submitPlan', async () => {
  const s = setup();
  s.chat.mockResolvedValueOnce({
    text: '',
    model: 'fixture',
    toolCalls: Array.from({ length: 13 }, (_, i) => ({
      id: String(i),
      name: 'inspectComposition',
      arguments: {},
    })),
  });
  await s.agent.run(minimal.goal);
  expect(
    s.agent.getSnapshot().toolCalls.find((a) => a.status === 'failed')?.result,
  ).toMatchObject({ code: 'TOOL_BUDGET_EXCEEDED' });
  assertScene(s);
});
it('a READ after inspection exhaustion reports budget, not permission failure', async () => {
  const s = setup();
  for (let i = 0; i < 4; i++)
    s.chat.mockResolvedValueOnce({
      text: '',
      model: 'fixture',
      toolCalls: [{ id: String(i), name: 'inspectComposition', arguments: {} }],
    });
  await s.agent.run(minimal.goal);
  expect(s.agent.getSnapshot().executionError?.code).toBe(
    'TOOL_BUDGET_EXCEEDED',
  );
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('missing metadata capability can be repaired only to exact catalogue alternative for failed task', () => {
  const s = setup(),
    creation = resolveCreationDetails(
      minimal,
      s.registry,
      s.creation.capabilities(),
    );
  creation.tasks[0]!.capabilityId = 'shape.rectangle';
  const p = { ...minimal, creation };
  let error: unknown;
  try {
    resolveCreationDetails(p, s.registry, s.creation.capabilities());
  } catch (e) {
    error = e;
  }
  expect(classifyRecovery(error).category).toBe('MODEL_REPAIR_REQUIRED');
  const patch = {
    planId: p.id,
    taskPatches: [
      { id: creation.tasks[0]!.id, capabilityId: 'createRectangle' },
    ],
  };
  const fixed = applyPlanRepair(p, patch, error);
  expect(fixed.steps).toEqual(p.steps);
  expect(() => s.runtime.validate(fixed)).not.toThrow();
  expect(() =>
    applyPlanRepair(
      p,
      {
        ...patch,
        taskPatches: [
          { id: creation.tasks[0]!.id, capabilityId: 'radialGradient' },
        ],
      },
      error,
    ),
  ).toThrow('只能');
});
it('invalid parameters roll back entire draft instead of silently skipping failed step', async () => {
  const s = setup(),
    tx = new AgentTransaction(s.host, s.registry, s.base, s.ctx);
  await tx.execute(
    'createRectangle',
    {},
    new AbortController().signal,
    'rectangle',
  );
  await expect(
    tx.execute(
      'createText',
      { text: 'wrong' },
      new AbortController().signal,
      'text',
    ),
  ).rejects.toThrow();
  tx.discard();
  expect(s.host.getSnapshot()).toBe(s.base);
  expect(s.host.undoStack).toHaveLength(0);
});
it('deterministic dependency reorder is safe and cycles reject', () => {
  const s = setup(),
    recovery = new RecoveryController();
  const details = resolveCreationDetails(
    minimal,
    s.registry,
    s.creation.capabilities(),
  );
  const reversed = {
    ...minimal,
    creation: {
      ...details,
      tasks: [details.tasks[1]!, details.tasks[0]!, ...details.tasks.slice(2)],
    },
  };
  expect(
    recovery.validateAndRepair(
      reversed,
      (p) => s.runtime.validate(p),
      (n, a) => s.registry.permission(n, a),
    ).steps[0]?.id,
  ).toBe('rectangle');
  const creation = resolveCreationDetails(
    minimal,
    s.registry,
    s.creation.capabilities(),
  );
  creation.tasks[0]!.dependencies = [creation.tasks[1]!.id];
  creation.tasks[1]!.dependencies = [creation.tasks[0]!.id];
  expect(() => s.runtime.validate({ ...minimal, creation })).toThrow('循环');
});
it('repeated same error stops under shared recovery controller', () => {
  const r = new RecoveryController(),
    e = new AgentExecutionError({
      code: 'TOOL_ARGUMENT_INVALID',
      phase: 'preflight',
      recoverable: true,
      message: 'invalid',
    });
  expect(r.repeat(e, {}, 'base')).toBe(false);
  expect(r.repeat(e, {}, 'base')).toBe(true);
});
it('CONFIG A direct Commands builds equivalent scene with one Undo and Save/Reload', () => {
  const s = setup();
  const rect = createLayer('rectangle'),
    text = createLayer('text');
  if (text.type !== 'text') throw Error('text fixture');
  s.host.executeTransaction(
    transaction('direct fixture', 'agent', [
      command({
        type: 'layer.create',
        compositionId: s.base.activeCompositionId,
        layer: rect,
      }),
      command({
        type: 'layer.create',
        compositionId: s.base.activeCompositionId,
        layer: {
          ...text,
          type: 'text',
          text: 'Cubic',
          fontFamily: 'serif',
          fontSize: 64,
        },
      }),
      command({
        type: 'property.setBase',
        propertyId: text.transform.position.id,
        value: { x: 960, y: 450 },
      }),
      ...[0, 2].map((time, i) =>
        command({
          type: 'keyframe.add',
          propertyId: text.transform.opacity.id,
          keyframe: {
            id: crypto.randomUUID(),
            time,
            value: i,
            interpolation: { type: 'linear' as const },
          },
        }),
      ),
    ]),
  );
  assertScene(s);
});
it('CONFIG B Tool Adapter uses schema, actual bindings and one commit', async () => {
  const s = setup(),
    tx = new AgentTransaction(s.host, s.registry, s.base, s.ctx);
  for (const step of minimal.steps)
    await tx.execute(
      step.tool,
      step.arguments,
      new AbortController().signal,
      step.id,
    );
  const evidence = tx.evidence();
  expect(evidence.bindings.rectangle?.layerId).toMatch(/^[a-f0-9-]{36}$/);
  expect(
    verifyExecutionState(s.registry, s.base, tx.getSnapshot(), evidence).scene
      .status,
  ).toBe('PASSED');
  expect(s.host.getSnapshot()).toBe(s.base);
  tx.commit('fixture');
  assertScene(s);
});
it.each([false, true])(
  'CONFIG C/D planner nativeSkills=%s shares the same executor and one commit',
  async (enabled) => {
    const s = setup(enabled);
    await s.agent.run(minimal.goal);
    expect(s.agent.getSnapshot().status).toBe('completed');
    assertScene(s);
    expect(s.agent.getSnapshot().trace?.validationResults?.scene.status).toBe(
      'PASSED',
    );
    expect(
      s.agent.getSnapshot().trace?.objectBindings.text?.layerId,
    ).toBeTruthy();
    const initial = s.chat.mock.calls[0]![1];
    expect(initial.tools?.some((t) => t.name === 'createRectangle')).toBe(
      false,
    );
  },
);

it('planning exposes declared core READ contracts and execution catalogue cannot grant write privilege', () => {
  const s = setup(),
    declared = s.runtime.readTools!().map((t) => t.name);
  expect(
    declared.every((name) => s.registry.contract(name).permission === 'READ'),
  ).toBe(true);
  expect(declared).toContain('getCanvasInfo');
  expect(declared).not.toContain('createRectangle');
});
it('live getCanvasInfo declaration failure is fixed without relaxing WRITE protection', async () => {
  const s = setup();
  s.chat.mockResolvedValueOnce({
    text: '',
    model: 'offline-replay-of-observed-live-call',
    toolCalls: [
      { id: 'inspect', name: 'inspectComposition', arguments: {} },
      { id: 'canvas', name: 'getCanvasInfo', arguments: {} },
    ],
  });
  await s.agent.run(minimal.goal);
  expect(s.agent.getSnapshot().status).toBe('completed');
  assertScene(s);
});
it('planning argument failure is distinct from permission and budget failures', async () => {
  const s = setup();
  s.chat.mockResolvedValueOnce({
    text: '',
    model: 'fixture',
    toolCalls: [
      {
        id: 'invalid',
        name: 'inspectComposition',
        arguments: { unexpected: true },
      },
    ],
  });
  await s.agent.run(minimal.goal);
  expect(s.agent.getSnapshot().toolCalls[0]?.result).toMatchObject({
    code: 'TOOL_ARGUMENT_INVALID',
    phase: 'planning',
    toolName: 'inspectComposition',
  });
  assertScene(s);
});

it('empty composition reuses createText schema and does not preload unrelated keyframes/font mutations', () => {
  const s = setup(),
    loader = new ToolContextLoader(s.registry);
  loader.begin(
    '创建 Cubic 文字标题',
    s.registry.catalog().map((t) => t.name),
    true,
  );
  expect(loader.definitions().map((t) => t.name)).toContain('createText');
  expect(loader.definitions().map((t) => t.name)).not.toContain('addKeyframe');
  expect(loader.definitions().map((t) => t.name)).not.toContain('setFont');
  loader.load(['setFont']);
  expect(loader.definitions().map((t) => t.name)).toContain('setFont');
});
it('observed missing capability repairs only metadata after a bounded model patch, without replay or UUID guessing', async () => {
  const s = setup(),
    creation = resolveCreationDetails(
      minimal,
      s.registry,
      s.creation.capabilities(),
    );
  creation.tasks[0]!.capabilityId = 'shape.rectangle';
  s.chat
    .mockResolvedValueOnce({
      text: '',
      model: 'fixture',
      toolCalls: [
        { id: 'plan', name: 'submitPlan', arguments: { ...minimal, creation } },
      ],
    })
    .mockResolvedValueOnce({
      text: '',
      model: 'fixture',
      toolCalls: [
        {
          id: 'repair',
          name: 'repairPlan',
          arguments: {
            planId: minimal.id,
            taskPatches: [
              { id: creation.tasks[0]!.id, capabilityId: 'createRectangle' },
            ],
          },
        },
      ],
    });
  await s.agent.run(minimal.goal);
  expect(s.agent.getSnapshot().status).toBe('completed');
  expect(s.chat).toHaveBeenCalledTimes(2);
  assertScene(s);
});

it('explicit provider tool-unsupported diagnostic stays distinct from invalid parameters or HTTP failure', () => {
  const error = new AIError('invalid_request', 'unsupported', {
    kind: 'http',
    status: 400,
    code: 'unsupported_tools',
    field: 'tools',
  });
  expect(classifyRecovery(error)).toMatchObject({
    code: 'PROVIDER_TOOL_UNSUPPORTED',
    category: 'NON_RECOVERABLE',
  });
});
