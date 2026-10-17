import { expect, it, vi } from 'vitest';
import { AIError } from '../src/ai/contracts';
import {
  AgentExecutionError,
  argumentFingerprint,
} from '../src/agent/execution-error';
import {
  RecoveryController,
  classifyRecovery,
  recoveryFeedback,
  recoveryFingerprint,
  applyPlanRepair,
} from '../src/agent/recovery-controller';
import {
  validatePlanDependencies,
  repairDependencyOrder,
} from '../src/agent/dependency-graph';
import type { AgentPlan } from '../src/agent/session';
const signal = new AbortController().signal;
const task = (id: string, stepIds: string[], dependencies: string[] = []) => ({
  id,
  stepIds,
  dependencies,
  description: id,
  executionDomain: 'scene' as const,
  strategy: 'modify-existing' as const,
  capabilityId: 'native.text',
});
const p = (): AgentPlan => ({
  id: 'cubic-controlled',
  goal: 'Cubic text with font',
  risk: 'low',
  steps: [
    {
      id: 's1',
      label: 'Cubic',
      tool: 'createText',
      arguments: {
        content: 'Cubic',
        fontFamily: 'Times New Roman',
        fontSize: 110,
      },
    },
    {
      id: 's2',
      label: 'Font',
      tool: 'setFont',
      arguments: {
        layerId: { kind: 'stepResult', stepId: 's1', output: 'layerId' },
        fontFamily: 'Times New Roman',
      },
    },
  ],
  creation: {
    intent:
      'controlled reconstruction of retained historical prefix; not exact historical replay',
    warnings: [],
    tasks: [task('font', ['s2'], ['text']), task('text', ['s1'])],
  },
});
const failure = (
  code:
    | 'PLAN_DEPENDENCY_INVALID'
    | 'PLAN_CYCLE_DETECTED' = 'PLAN_DEPENDENCY_INVALID',
) =>
  new AgentExecutionError({
    code,
    phase: 'preflight',
    field: 'creation.tasks.dependencies',
    message: 'dependency',
    recoverable: true,
  });
it('B1 controlled Cubic retained prefix: repairs metadata, preserves all IDs, text, step order and references', () => {
  const original = p();
  const validate = vi.fn(validatePlanDependencies);
  const recovery = new RecoveryController();
  const fixed = recovery.validateAndRepair(original, validate, () => 'WRITE');
  expect(fixed.creation?.tasks.map((t) => t.id)).toEqual(['text', 'font']);
  expect(fixed.steps).toEqual(original.steps);
  expect(fixed.goal).toBe(original.goal);
  expect(original.creation?.tasks[0]?.id).toBe('font');
  expect(recovery.records.at(-1)?.outcome).toBe('verified');
  expect(validate).toHaveBeenCalledTimes(1);
});
it('does not accept repair before native revalidation passes', () => {
  const r = new RecoveryController();
  expect(() =>
    r.validateAndRepair(
      p(),
      () => {
        throw new AgentExecutionError({
          code: 'CAPABILITY_UNAVAILABLE',
          phase: 'preflight',
          recoverable: false,
          message: 'missing capability',
        });
      },
      () => 'WRITE',
    ),
  ).toThrow('missing capability');
  expect(r.records.some((x) => x.outcome === 'verified')).toBe(false);
});
it('B4 a genuine cycle remains rejected; model may fix dependency metadata once, not delete work', async () => {
  const original = p();
  original.creation!.tasks[1]!.dependencies = ['font'];
  expect(() => validatePlanDependencies(original)).toThrow();
  const r = new RecoveryController();
  const model = {
    chat: vi.fn(async () => ({
      text: '',
      model: 'fixture',
      toolCalls: [
        {
          id: 'repair',
          name: 'repairPlan',
          arguments: {
            planId: original.id,
            taskPatches: [{ id: 'text', dependencies: [] }],
          },
        },
      ],
    })),
  };
  const fixed = await r.repairWithModel(
    original,
    failure('PLAN_CYCLE_DETECTED'),
    model,
    validatePlanDependencies,
    () => 'WRITE',
    [],
    signal,
  );
  expect(fixed.steps).toEqual(original.steps);
  expect(fixed.creation?.tasks).toHaveLength(2);
  expect(model.chat).toHaveBeenCalledTimes(1);
});
it('B5 identical rejected plan and error stops after one ineffective model patch', async () => {
  const original = p();
  original.creation!.tasks[1]!.dependencies = ['font'];
  const model = {
    chat: vi.fn(async () => ({
      model: 'fixture',
      text: '',
      toolCalls: [
        {
          id: 'repair',
          name: 'repairPlan',
          arguments: { planId: original.id },
        },
      ],
    })),
  };
  const r = new RecoveryController();
  let error: unknown;
  try {
    validatePlanDependencies(original);
  } catch (e) {
    error = e;
  }
  await expect(
    r.repairWithModel(
      original,
      error,
      model,
      validatePlanDependencies,
      () => 'WRITE',
      [],
      signal,
    ),
  ).rejects.toThrow('相同错误');
  expect(model.chat).toHaveBeenCalledTimes(1);
});
it('rejects missing dependencies, duplicate tasks, self dependency and impossible producer outputs', () => {
  for (const kind of ['missing', 'duplicate', 'self', 'output']) {
    const x = p();
    if (kind === 'missing') x.creation!.tasks[0]!.dependencies = ['absent'];
    if (kind === 'duplicate') x.creation!.tasks[1]!.id = 'font';
    if (kind === 'self') x.creation!.tasks[0]!.dependencies = ['font'];
    if (kind === 'output')
      x.steps[1]!.arguments.layerId = {
        kind: 'stepResult',
        stepId: 's1',
        output: 'nodeId',
      };
    expect(() => validatePlanDependencies(x)).toThrow(AgentExecutionError);
  }
});
it('never sorts noncommutative write operations to conceal a bad dependency', () => {
  const x = p();
  x.steps.reverse();
  expect(() => repairDependencyOrder(x, () => 'WRITE')).toThrow('不可交换');
});
it('stable topological sort preserves unrelated READ order', () => {
  const x: AgentPlan = {
    id: 'read',
    goal: 'inspect',
    risk: 'low',
    steps: ['a', 'b', 'c'].map((id) => ({
      id,
      label: id,
      tool: 'inspectScene',
      arguments: {},
    })),
    creation: {
      intent: 'inspect',
      warnings: [],
      tasks: [task('ta', ['a'], ['tc']), task('tb', ['b']), task('tc', ['c'])],
    },
  };
  expect(repairDependencyOrder(x, () => 'READ').steps.map((s) => s.id)).toEqual(
    ['b', 'c', 'a'],
  );
});
it('dependency metadata participates in fixed-size fingerprint; canonical argument key order does not', () => {
  const x = p(),
    y = p();
  y.creation!.tasks[0]!.dependencies = [];
  expect(argumentFingerprint(x)).not.toBe(argumentFingerprint(y));
  expect(argumentFingerprint({ b: 2, a: 1 })).toBe(
    argumentFingerprint({ a: 1, b: 2 }),
  );
  expect(argumentFingerprint(x)).toMatch(/^[a-f0-9]{64}$/);
  expect(recoveryFingerprint(failure(), x, 1)).not.toBe(
    recoveryFingerprint(failure(), x, 2),
  );
});
it('serialized structured errors preserve classification and concise model feedback omits nested trace', () => {
  const e = {
    code: 'PLAN_DEPENDENCY_INVALID',
    phase: 'preflight',
    message: 'wrong order',
    field: 'creation.tasks.dependencies',
    recoverable: true,
    cause: {
      reason: 'producer scheduled after consumer',
      producer: 'text',
      consumer: 'font',
      diagnostics: [p()],
    },
  };
  expect(classifyRecovery(e)).toEqual({
    code: 'PLAN_DEPENDENCY_INVALID',
    category: 'AUTO_REPAIRABLE',
  });
  const f = recoveryFeedback(e);
  expect(f).toMatchObject({ dependsOn: 'text', consumer: 'font' });
  expect(JSON.stringify(f)).not.toContain('diagnostics');
  expect(JSON.stringify(f).length).toBeLessThan(800);
});
it('permission, cancellation, unsafe operations never become generic retryable plan errors', () => {
  for (const code of [
    'PERMISSION_DENIED',
    'USER_CANCELLED',
    'UNSAFE_OPERATION',
  ] as const) {
    const c = classifyRecovery(
      new AgentExecutionError({
        code,
        phase: 'execute',
        message: code,
        recoverable: true,
      }),
    );
    expect(c.category).toBe(
      code === 'PERMISSION_DENIED' ? 'USER_ACTION_REQUIRED' : 'NON_RECOVERABLE',
    );
  }
});
it('localized repair cannot add work, alter capability or patch an unrelated step', () => {
  expect(() =>
    applyPlanRepair(p(), { planId: p().id, stepOrder: ['s1'] }, failure()),
  ).toThrow('增删');
  expect(() =>
    applyPlanRepair(
      p(),
      { planId: p().id, taskPatches: [{ id: 'font', capabilityId: 'other' }] },
      failure(),
    ),
  ).toThrow();
  expect(() =>
    applyPlanRepair(
      p(),
      {
        planId: p().id,
        stepPatches: [{ id: 's1', arguments: { content: 'other' } }],
      },
      failure(),
    ),
  ).toThrow('实际失败');
});
it('B4 finite model budget rejects endless changing invalid dependency patches', async () => {
  const x = p();
  x.creation!.tasks[0]!.dependencies = ['missing'];
  let count = 0;
  const model = {
    chat: vi.fn(async () => ({
      model: 'fixture',
      text: '',
      toolCalls: [
        {
          id: 'patch',
          name: 'repairPlan',
          arguments: {
            planId: x.id,
            taskPatches: [{ id: 'font', dependencies: ['missing' + ++count] }],
          },
        },
      ],
    })),
  };
  const r = new RecoveryController({ planModelRepairs: 2 });
  await expect(
    r.repairWithModel(
      x,
      failure(),
      model,
      validatePlanDependencies,
      () => 'WRITE',
      [],
      signal,
    ),
  ).rejects.toThrow();
  expect(model.chat).toHaveBeenCalledTimes(2);
});
it('provider retry charges the same phase budget and never retries permission failure', async () => {
  const model = {
    chat: vi.fn(async () => {
      throw new AIError('network', 'network');
    }),
  };
  const r = new RecoveryController({ planningRequests: 1 });
  await expect(
    r.chat(model, 'planning', 'planning', { messages: [] }, signal),
  ).rejects.toThrow('预算');
  expect(model.chat).toHaveBeenCalledTimes(1);
  const denied = {
    chat: vi.fn(async () => {
      throw new AIError('invalid_key', 'key');
    }),
  };
  await expect(
    new RecoveryController().chat(
      denied,
      'planning',
      'planning',
      { messages: [] },
      signal,
    ),
  ).rejects.toThrow('key');
  expect(denied.chat).toHaveBeenCalledTimes(1);
});
it('per-step and overall execution recovery budgets are independent and finite', () => {
  const r = new RecoveryController({
    stepModelRepairs: 1,
    executionModelRepairs: 2,
  });
  expect(r.claimStepRepair('a', failure())).toBe(1);
  expect(() => r.claimStepRepair('a', failure())).toThrow('预算');
  expect(r.claimStepRepair('b', failure())).toBe(1);
  expect(() => r.claimStepRepair('c', failure())).toThrow('预算');
});
it('local repair request carries exact relevant tool schema and parseable feedback, without entire failed plans', async () => {
  const x = p();
  x.creation = undefined;
  x.steps[1]!.arguments = { layerId: 'bad' };
  const error = new AgentExecutionError({
    code: 'OBJECT_REFERENCE_INVALID',
    phase: 'preflight',
    stepId: 's2',
    toolName: 'setFont',
    field: 'layerId',
    received: 'bad',
    expected: 'stepResult',
    recoverable: true,
    message: 'invalid target',
  });
  const model = {
    chat: vi.fn(async (_task, request) => {
      expect(JSON.parse(request.messages[1].content).error).toMatchObject({
        expected: 'stepResult',
        received: 'bad',
      });
      expect(request.messages[0].content).toContain('deep-contract');
      return {
        text: '',
        model: 'fixture',
        toolCalls: [
          {
            id: 'p',
            name: 'repairPlan',
            arguments: {
              planId: x.id,
              stepPatches: [{ id: 's2', arguments: p().steps[1]!.arguments }],
            },
          },
        ],
      };
    }),
  };
  await new RecoveryController().repairWithModel(
    x,
    error,
    model,
    validatePlanDependencies,
    () => 'WRITE',
    [
      {
        name: 'setFont',
        parameters: { a: { b: { c: { d: 'deep-contract' } } } },
      },
    ],
    signal,
  );
  expect(model.chat).toHaveBeenCalledTimes(1);
});

import { AgentToolRegistry } from '../src/agent/tool-registry';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { registerReadTools } from '../src/agent/read-tools';
import {
  registerCreationTools,
  resolveCreationDetails,
} from '../src/agent/creation-planner';
import { AgentTransaction } from '../src/agent/transaction';
import { AgentOrchestrator } from '../src/agent/orchestrator';
import { CommandSystem } from '../src/core/command-system';
import { createDefaultProject } from '../src/core/project-model';
import { saveProject } from '../src/core/project-io';
import { defaultAISettings } from '../src/ai/contracts';
it('B1 native Cubic pipeline fixes reversed metadata without a model call, commits once, preserves title/font and Undo', async () => {
  const host = new CommandSystem(createDefaultProject()),
    base = host.getSnapshot();
  const registry = registerCoreWriteTools(new AgentToolRegistry());
  const creation = registerCreationTools(registry);
  const original = p();
  original.creation = undefined;
  original.creation = resolveCreationDetails(
    original,
    registry,
    creation.capabilities(),
  );
  original.creation.tasks[1]!.dependencies = [original.creation.tasks[0]!.id];
  original.creation.tasks.reverse();
  const validate = (plan: AgentPlan) => {
    registry.validatePlan(plan, undefined, {
      project: base,
      selection: [],
      time: 0,
    });
    resolveCreationDetails(plan, registry, creation.capabilities());
  };
  const repaired = new RecoveryController().validateAndRepair(
    original,
    validate,
    (n, a) => registry.permission(n, a),
  );
  const draft = new AgentTransaction(host, registry, base, {
    selection: [],
    time: 0,
  });
  for (const s of repaired.steps)
    await draft.execute(s.tool, s.arguments, signal, s.id);
  draft.commit('Cubic recovery');
  const result = host.getSnapshot();
  expect(result.compositions[0]!.layers).toHaveLength(1);
  expect(result.compositions[0]!.layers[0]).toMatchObject({
    text: 'Cubic',
    fontFamily: 'Times New Roman',
    fontSize: 110,
  });
  expect(host.undoStack).toHaveLength(1);
  host.undo();
  expect(saveProject(host.getSnapshot())).toBe(saveProject(base));
});
it('B2/B6 rectangle -> radial gradient -> position -> keyframes recovers mid-draft without duplicates or partial commits', async () => {
  const host = new CommandSystem(createDefaultProject()),
    base = host.getSnapshot();
  const registry = registerAnimationTools(
    registerReadTools(registerCoreWriteTools(new AgentToolRegistry())),
  );
  const ref = { kind: 'stepResult', stepId: 'create', output: 'layerId' };
  const plan: AgentPlan = {
    id: 'rectangle',
    goal: 'radial radius 0.8 then move and animate',
    risk: 'low',
    steps: [
      {
        id: 'create',
        label: 'rectangle',
        tool: 'createRectangle',
        arguments: {},
      },
      {
        id: 'fill',
        label: 'fill',
        tool: 'setFill',
        arguments: {
          layerId: ref,
          color: { r: 0, g: 1, b: 1, a: 1 },
          gradient: 'radial',
          radialParameters: { radius: 0.5 },
        },
      },
      {
        id: 'move',
        label: 'move',
        tool: 'setPosition',
        arguments: { layerId: ref, value: { x: 500, y: 400 } },
      },
      ...[0, 1].map((time) => ({
        id: 'kf' + time,
        label: 'keyframe',
        tool: 'addKeyframe',
        arguments: { layerId: ref, property: 'opacity', time, value: time },
      })),
    ],
  };
  let first = true,
    failed = false;
  const settings = defaultAISettings();
  settings.agent.visualVerification = false;
  settings.agent.autoApplySafe = true;
  const chat = vi.fn(async () => {
    if (first) {
      first = false;
      return {
        text: '',
        model: 'fixture',
        toolCalls: [{ id: 'p', name: 'submitPlan', arguments: plan }],
      };
    }
    expect(host.getSnapshot()).toBe(base);
    return {
      text: '',
      model: 'fixture',
      toolCalls: [
        {
          id: 'p',
          name: 'submitPlan',
          arguments: {
            ...plan,
            steps: [
              {
                ...plan.steps[1]!,
                arguments: {
                  ...plan.steps[1]!.arguments,
                  radialParameters: { radius: 0.8 },
                },
              },
            ],
          },
        },
      ],
    };
  });
  const agent = new AgentOrchestrator(
    {
      project: host.getSnapshot,
      context: () => ({}),
      tools: () => registry.definitions(),
      permission: (n, a) => registry.permission(n, a),
      validate: (p, project) =>
        registry.validatePlan(p, undefined, {
          project: project ?? base,
          time: 0,
          selection: [],
        }),
      begin: () => {
        const draft = new AgentTransaction(host, registry, base, {
          time: 0,
          selection: [],
        });
        return {
          getSnapshot: draft.getSnapshot,
          discard: () => draft.discard(),
          commit: (label) => draft.commit(label),
          resolveArguments: draft.resolveArguments,
          execute: async (n, a, s, stepId) => {
            if (n === 'setFill' && !failed) {
              failed = true;
              throw new AgentExecutionError({
                code: 'TOOL_ARGUMENT_INVALID',
                phase: 'compile',
                toolName: n,
                field: 'radialParameters.radius',
                recoverable: true,
                message: 'radius must be 0.8',
              });
            }
            return draft.execute(n, a, s, stepId);
          },
        };
      },
    },
    { chat },
    () => settings,
  );
  await agent.run(plan.goal);
  expect(agent.getSnapshot().status).toBe('completed');
  expect(chat).toHaveBeenCalledTimes(2);
  const result = host.getSnapshot();
  const layer = result.compositions[0]!.layers[0]!;
  expect(result.compositions[0]!.layers).toHaveLength(1);
  expect(layer.editor?.properties.radial_radius?.baseValue).toBe(0.8);
  expect(layer.transform.position.baseValue).toEqual({ x: 500, y: 400 });
  expect(layer.transform.opacity.keyframes).toHaveLength(2);
  expect(host.undoStack).toHaveLength(1);
  host.undo();
  expect(saveProject(host.getSnapshot())).toBe(saveProject(base));
  host.redo();
  expect(saveProject(host.getSnapshot())).toBe(saveProject(result));
});
it('planning parameter recovery cannot change an unrelated target, even if the new ID could validate', () => {
  const plan = p();
  plan.steps[1]!.arguments = { layerId: 'original', fontSize: -1 };
  const error = new AgentExecutionError({
    code: 'TOOL_ARGUMENT_INVALID',
    phase: 'schema',
    stepId: 's2',
    field: 'fontSize',
    recoverable: true,
    message: 'size',
  });
  expect(() =>
    applyPlanRepair(
      plan,
      {
        planId: plan.id,
        stepPatches: [
          { id: 's2', arguments: { layerId: 'other', fontSize: 64 } },
        ],
      },
      error,
    ),
  ).toThrow('目标对象');
});
