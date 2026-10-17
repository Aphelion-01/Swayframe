import { afterAll, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import {
  activeComposition,
  createDefaultProject,
} from '../src/core/project-model';
import { contentHash } from '../src/core/content-hash';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { EditorAdapter } from '../src/agent-v2/editor-adapter';
import { TaskRuntime, type TaskState } from '../src/agent-v2/runtime';
import { AgentPlanner } from '../src/agent-v2/planner';
import { ProviderBridge } from '../src/agent-v2/provider';
import {
  AIError,
  type ChatRequest,
  type ProviderConfig,
} from '../src/ai/contracts';
import { validateIntent } from '../src/agent-v2/planner';
import { installFaults, type FaultSpec } from './helpers/agent-v2-faults';
const provider: ProviderConfig = {
  id: crypto.randomUUID(),
  name: 'OFFLINE V26',
  type: 'mock',
  baseUrl: 'http://localhost',
  enabled: true,
  defaultModel: 'fixture',
  models: [{ id: 'fixture', name: 'fixture', capabilities: ['text'] }],
};
const shape = {
  id: 'shape',
  type: 'createShape',
  shape: 'rectangle',
  name: 'Only',
  width: 200,
  height: 200,
  position: { x: 960, y: 540 },
};
const fill = {
  id: 'fill',
  type: 'setFill',
  target: { kind: 'result', actionId: 'shape' },
  color: { r: 0, g: 0.7, b: 0.8, a: 1 },
};
const blur = {
  id: 'blur',
  type: 'addEffect',
  target: { kind: 'result', actionId: 'shape' },
  effect: 'gaussianBlur',
};
const recorded: unknown[] = [];
function setup(specs: readonly FaultSpec[] = []) {
  const host = new CommandSystem(createDefaultProject()),
    base = host.getSnapshot();
  const registry = registerAnimationTools(
    registerCoreWriteTools(new AgentToolRegistry()),
  );
  const adapter = new EditorAdapter(
    host,
    registry,
    {
      compositionId: base.activeCompositionId,
      existingLayerIds: [],
      allowCreate: true,
    },
    [],
  );
  return {
    host,
    base,
    registry,
    adapter,
    faults: installFaults(adapter, registry, specs),
  };
}
function record(
  id: string,
  state: TaskState,
  faults: ReturnType<typeof installFaults>,
  runtime: TaskRuntime,
) {
  recorded.push({
    id,
    label: 'OFFLINE FIXTURE; NO PAID API',
    state,
    faults: { events: faults.events, executed: faults.executed },
    draft: runtime.draftSnapshot(),
  });
}
afterAll(() => {
  fs.mkdirSync('outputs/agent-v2-6', { recursive: true });
  fs.writeFileSync(
    'outputs/agent-v2-6/fault-offline.json',
    JSON.stringify(
      {
        label:
          'OFFLINE FIXTURE; recovery denominators include actually triggered faults only',
        rows: recorded,
      },
      null,
      2,
    ) + '\n',
  );
});
it('R1 real Registry invalid fill arguments: local fixture repair, creation preserved, one commit', async () => {
  const s = setup([
    {
      actionId: 'fill',
      mode: 'arguments',
      times: 1,
      field: 'color',
      actual: { r: -1, g: 0, b: 0, a: 1 },
    },
  ]);
  const requests: ChatRequest[] = [];
  const planner = new AgentPlanner(
    new ProviderBridge(
      {
        chat: async (request) => {
          requests.push(request);
          return {
            model: 'fixture',
            text: '',
            toolCalls: [
              {
                id: 'fixture',
                name: request.toolChoice!,
                arguments:
                  request.toolChoice === 'submitIntent'
                    ? { goal: 'One cyan rectangle', actions: [shape, fill] }
                    : fill,
              },
            ],
            usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          };
        },
      },
      provider,
      'fixture',
      'tools',
    ),
  );
  const runtime = new TaskRuntime(s.adapter, (a, e, signal, context) =>
    planner.repair(a, e, signal, context),
  );
  const state = await runtime.planAndRun('One cyan rectangle', planner);
  expect(state.phase).toBe('AWAITING_ACCEPTANCE');
  expect(s.faults.events).toHaveLength(1);
  expect(state.recoveryAttempts).toBe(1);
  expect(state.modelRequests).toBe(2);
  expect(s.faults.executed).toEqual(['shape', 'fill', 'fill']);
  expect(state.steps[0]!.result?.layerId).toBe(state.references.shape!.layerId);
  expect(state.steps[0]!.attempts).toBe(1);
  expect(state.recoveries[0]!.outcome).toBe('SUCCEEDED');
  expect(requests[1]!.messages[1]!.content).toContain('completedActions');
  expect(requests[1]!.messages[0]!.content.length).toBeLessThan(
    requests[0]!.messages[0]!.content.length,
  );
  expect(JSON.stringify(requests[1]!.tools)).not.toContain('createShape');
  expect(JSON.stringify(requests[1])).not.toContain('compositions');
  runtime.accept(state.proposalId!);
  expect(activeComposition(s.host.getSnapshot()).layers).toHaveLength(1);
  expect(s.host.undoStack).toHaveLength(1);
  s.host.undo();
  expect(s.host.getSnapshot()).toEqual(s.base);
  s.host.redo();
  record('R1', runtime.getSnapshot(), s.faults, runtime);
});
it('R2 stale resolved target rereads the real result map, never guesses names', async () => {
  const s = setup([{ actionId: 'position', mode: 'missing-target', times: 1 }]),
    repair = vi.fn();
  const runtime = new TaskRuntime(s.adapter, repair);
  const state = await runtime.run({
    goal: 'text move',
    actions: [
      { id: 'text', type: 'createText', content: 'Cubic' },
      {
        id: 'position',
        type: 'setProperty',
        target: { kind: 'result', actionId: 'text' },
        property: 'position',
        value: { x: 800, y: 440 },
      },
    ],
  });
  expect(state.phase).toBe('AWAITING_ACCEPTANCE');
  expect(state.deterministicRecoveries).toBe(1);
  expect(repair).not.toHaveBeenCalled();
  expect(s.faults.events).toHaveLength(1);
  expect(activeComposition(runtime.draftSnapshot()).layers[0]!.id).toBe(
    state.references.text!.layerId,
  );
  expect(state.steps[1]!.resolvedArguments).toMatchObject({
    layerId: state.references.text!.layerId,
  });
  expect(s.faults.executed.filter((x) => x === 'text')).toHaveLength(1);
  record('R2', state, s.faults, runtime);
});
it('R3 recoverable rejection before addEffect retries once without duplicate non-idempotent work', async () => {
  const s = setup([{ actionId: 'blur', mode: 'reject', times: 1 }]),
    repair = vi.fn(),
    runtime = new TaskRuntime(s.adapter, repair);
  const state = await runtime.run({ goal: 'one blur', actions: [shape, blur] });
  expect(state.phase).toBe('AWAITING_ACCEPTANCE');
  expect(state.deterministicRecoveries).toBe(1);
  expect(state.recoveryAttempts).toBe(0);
  expect(repair).not.toHaveBeenCalled();
  expect(s.faults.executed).toEqual(['shape', 'blur', 'blur']);
  expect(
    activeComposition(
      runtime.draftSnapshot(),
    ).layers[0]!.editor!.graph!.nodes.filter((n) => n.type === 'gaussianBlur'),
  ).toHaveLength(1);
  runtime.accept(state.proposalId!);
  expect(s.host.undoStack).toHaveLength(1);
  record('R3', runtime.getSnapshot(), s.faults, runtime);
});
it('R4 late stale context preserves all earlier verified steps and versions', async () => {
  const s = setup([{ actionId: 'late', mode: 'stale', times: 1 }]),
    runtime = new TaskRuntime(s.adapter, vi.fn());
  const actions = [
    shape,
    fill,
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `move${i}`,
      type: 'setProperty',
      target: { kind: 'result', actionId: 'shape' },
      property: 'position',
      value: { x: 600 + i * 10, y: 540 },
    })),
    {
      id: 'late',
      type: 'setProperty',
      target: { kind: 'result', actionId: 'shape' },
      property: 'opacity',
      value: 0.6,
    },
    blur,
  ];
  const state = await runtime.run({ goal: 'late recover', actions });
  expect(state.phase).toBe('AWAITING_ACCEPTANCE');
  expect(state.completedActions).toHaveLength(14);
  expect(
    state.steps
      .slice(0, 12)
      .every((step) => step.attempts === 1 && step.status === 'SUCCEEDED'),
  ).toBe(true);
  expect(s.faults.events).toHaveLength(1);
  expect(state.sceneVersion).toBe(contentHash(runtime.draftSnapshot()));
  record('R4', state, s.faults, runtime);
});
it('R5 repeated invalid repair is dry-validated and stopped, not executed or re-requested', async () => {
  const s = setup(),
    bad = {
      id: 'bad',
      type: 'setProperty',
      target: { kind: 'result', actionId: 'shape' },
      property: 'opacity',
      value: { x: 1, y: 1 },
    },
    repair = vi.fn(async () => ({ action: bad })),
    runtime = new TaskRuntime(s.adapter, repair);
  const state = await runtime.run({
    goal: 'invalid scalar',
    actions: [shape, bad],
  });
  expect(state.phase).toBe('FAILED');
  expect(repair).toHaveBeenCalledTimes(1);
  expect(state.steps[0]!.attempts).toBe(1);
  expect(s.faults.executed).toEqual(['shape']);
  expect(s.host.undoStack).toHaveLength(0);
  record('R5', state, s.faults, runtime);
});
it('R6 cancellation while repair ignores signal still finishes promptly and never commits', async () => {
  const s = setup([
      {
        actionId: 'fill',
        mode: 'arguments',
        times: 1,
        field: 'color',
        actual: { r: -1, g: 0, b: 0, a: 1 },
      },
    ]),
    started = vi.fn();
  const runtime = new TaskRuntime(s.adapter, async () => {
    started();
    return new Promise(() => {});
  });
  const pending = runtime.run({ goal: 'cancel', actions: [shape, fill] });
  await vi.waitFor(() => expect(started).toHaveBeenCalled());
  runtime.cancel();
  const state = await pending;
  expect(state.phase).toBe('CANCELLED');
  expect(state.steps[0]!.status).toBe('SUCCEEDED');
  expect(s.host.getSnapshot()).toBe(s.base);
  expect(s.host.undoStack).toHaveLength(0);
  record('R6', state, s.faults, runtime);
});
it('R7 actual formal project change while repair waits stops without overwriting user work', async () => {
  const s = setup([
    {
      actionId: 'fill',
      mode: 'arguments',
      times: 1,
      field: 'color',
      actual: { r: -1, g: 0, b: 0, a: 1 },
    },
  ]);
  let release: () => void = () => {};
  const entered = vi.fn();
  const runtime = new TaskRuntime(s.adapter, async () => {
    entered();
    return new Promise<{ action: unknown }>(
      (r) => (release = () => r({ action: fill })),
    );
  });
  const pending = runtime.run({ goal: 'stale base', actions: [shape, fill] });
  await vi.waitFor(() => expect(entered).toHaveBeenCalled());
  const edit = s.host.executeTransaction(
    transaction('User edit', 'human', [
      command({
        type: 'project.replace',
        project: { ...s.base, name: 'USER CHANGE' },
      }),
    ]),
  );
  expect(edit.ok).toBe(true);
  const changed = s.host.getSnapshot();
  release();
  const state = await pending;
  expect(state.phase).toBe('FAILED');
  expect(state.errors.at(-1)!.code).toBe('STALE_BASE');
  expect(s.host.getSnapshot()).toBe(changed);
  expect(activeComposition(changed).layers).toHaveLength(0);
  record('R7', state, s.faults, runtime);
});
it('R8 unavailable capability is terminal, no invented tool or repair', async () => {
  const s = setup();
  s.registry.catalog = () => [];
  const repair = vi.fn(),
    runtime = new TaskRuntime(s.adapter, repair);
  const state = await runtime.run({
    goal: 'missing registry',
    actions: [shape],
  });
  expect(state.phase).toBe('FAILED');
  expect(state.errors.at(-1)!.code).toBe('MISSING_CAPABILITY');
  expect(repair).not.toHaveBeenCalled();
  expect(s.host.undoStack).toHaveLength(0);
  record('R8', state, s.faults, runtime);
});
it.each([
  shape,
  blur,
  {
    id: 'kf',
    type: 'addKeyframe',
    target: { kind: 'result', actionId: 'shape' },
    property: 'position',
    time: 1,
    value: { x: 900, y: 500 },
  },
])('write then report error must STOP, never repeat $type', async (failed) => {
  const actions = failed === shape ? [shape] : [shape, failed],
    s = setup([{ actionId: failed.id, mode: 'after-write', times: 1 }]),
    repair = vi.fn(),
    runtime = new TaskRuntime(s.adapter, repair);
  const state = await runtime.run({ goal: 'post write safety', actions });
  expect(state.phase).toBe('FAILED');
  expect(state.errors.at(-1)!.code).toBe('REPLAY_FORBIDDEN');
  expect(s.faults.events[0]!.beforeVersion).not.toBe(
    s.faults.events[0]!.afterVersion,
  );
  expect(s.faults.executed.filter((id) => id === failed.id)).toHaveLength(1);
  expect(repair).not.toHaveBeenCalled();
  expect(s.host.undoStack).toHaveLength(0);
  expect(state.draftDisposition).toBe('UNSAFE');
  record('post-write-' + failed.id, state, s.faults, runtime);
});
it('invalid repair then valid local repair consumes only two repairs, never resets creation', async () => {
  const s = setup(),
    bad = {
      id: 'opacity',
      type: 'setProperty',
      target: { kind: 'result', actionId: 'shape' },
      property: 'opacity',
      value: { x: 1, y: 1 },
    };
  let n = 0;
  const repair = vi.fn(async () => ({
      action: { ...bad, value: ++n === 1 ? 2 : 0.5 },
    })),
    runtime = new TaskRuntime(s.adapter, repair);
  const state = await runtime.run({
    goal: 'fix scalar',
    actions: [shape, bad],
  });
  expect(state.phase).toBe('AWAITING_ACCEPTANCE');
  expect(state.recoveryAttempts).toBe(2);
  expect(state.steps[0]!.attempts).toBe(1);
  expect(state.recoveries.map((r) => r.outcome)).toEqual([
    'REJECTED',
    'SUCCEEDED',
  ]);
  record('invalid-then-valid', state, s.faults, runtime);
});
it('model cannot redirect repair to another target or alter dependencies', async () => {
  const s = setup(),
    bad = {
      id: 'opacity',
      type: 'setProperty',
      target: { kind: 'result', actionId: 'shape' },
      property: 'opacity',
      value: { x: 1, y: 1 },
    },
    repair = vi.fn(async () => ({
      action: {
        ...bad,
        target: { kind: 'existing', id: crypto.randomUUID() },
        value: 0.5,
      },
    })),
    runtime = new TaskRuntime(s.adapter, repair);
  const state = await runtime.run({
    goal: 'safe target',
    actions: [shape, bad],
  });
  expect(state.phase).toBe('FAILED');
  expect(state.errors.at(-1)!.code).toBe('COMMAND_REJECTION');
  expect(repair).toHaveBeenCalledTimes(1);
  expect(s.host.undoStack).toHaveLength(0);
  record('retarget', state, s.faults, runtime);
});
it('zero repair budget does not invoke model; valid prefix remains inspectable only', async () => {
  const s = setup(),
    repair = vi.fn(),
    runtime = new TaskRuntime(s.adapter, repair, { recoveries: 0 });
  const state = await runtime.run({
    goal: 'no repair',
    actions: [
      shape,
      {
        id: 'opacity',
        type: 'setProperty',
        target: { kind: 'result', actionId: 'shape' },
        property: 'opacity',
        value: { x: 1, y: 1 },
      },
    ],
  });
  expect(state.phase).toBe('FAILED');
  expect(state.errors.at(-1)!.code).toBe('BUDGET_EXCEEDED');
  expect(repair).not.toHaveBeenCalled();
  expect(state.draftDisposition).toBe('INSPECTABLE');
  expect(activeComposition(runtime.draftSnapshot()).layers).toHaveLength(1);
  record('budget-zero', state, s.faults, runtime);
});
it('task deadline aborts a stalled repair that ignores cancellation', async () => {
  const s = setup(),
    runtime = new TaskRuntime(s.adapter, async () => new Promise(() => {}), {
      durationMs: 15,
    });
  const state = await runtime.run({
    goal: 'deadline',
    actions: [
      shape,
      {
        id: 'bad',
        type: 'setProperty',
        target: { kind: 'result', actionId: 'shape' },
        property: 'opacity',
        value: { x: 1, y: 1 },
      },
    ],
  });
  expect(state.phase).toBe('FAILED');
  expect(state.errors.at(-1)!.code).toBe('BUDGET_EXCEEDED');
  expect(s.host.undoStack).toHaveLength(0);
  record('deadline', state, s.faults, runtime);
});
it('stable topological ordering and registered defaults remain deterministic without model repair', async () => {
  const s = setup(),
    runtime = new TaskRuntime(s.adapter, vi.fn());
  const intent = validateIntent({ goal: 'ordered', actions: [fill, shape] });
  expect(intent.actions.map((a) => a.id)).toEqual(['shape', 'fill']);
  const state = await runtime.run(intent);
  expect(state.phase).toBe('AWAITING_ACCEPTANCE');
  expect(state.recoveryAttempts).toBe(0);
  record('sort-defaults', state, s.faults, runtime);
});
it.each([
  'network',
  'timeout',
  '429',
  '503',
  '401',
  'invalid-json',
  'partial',
  'unsupported',
] as const)(
  'Provider %s classification and bounded opt-in retry',
  async (fault) => {
    const s = setup();
    let n = 0;
    const chat = vi.fn(async (request: ChatRequest) => {
      n++;
      if (n === 1) {
        if (fault === 'invalid-json')
          return { model: 'fixture', text: '{broken', toolCalls: [] };
        if (fault === 'partial')
          return {
            model: 'fixture',
            text: '',
            toolCalls: [
              { id: 'x', name: 'submitIntent', arguments: '{partial' },
            ],
          };
        if (fault === 'unsupported')
          throw new AIError('invalid_request', 'bad protocol', {
            kind: 'http',
            code: 'unsupported_tools',
            status: 400,
          });
        throw new AIError(
          fault === 'network'
            ? 'network'
            : fault === 'timeout'
              ? 'timeout'
              : fault === '429'
                ? 'rate_limit'
                : 'provider',
          'fixture',
          {
            kind: 'http',
            status: fault === '401' ? 401 : fault === '503' ? 503 : 429,
            retryAfterMs: 1,
          },
        );
      }
      return {
        model: 'fixture',
        text: '',
        toolCalls: [
          {
            id: 'x',
            name: request.toolChoice!,
            arguments: { goal: 'one rectangle', actions: [shape] },
          },
        ],
        usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
      };
    });
    const planner = new AgentPlanner(
        new ProviderBridge({ chat }, provider, 'fixture', 'tools'),
      ),
      runtime = new TaskRuntime(s.adapter, undefined, { providerRetries: 1 });
    const state = await runtime.planAndRun('one rectangle', planner);
    const transient = ['network', 'timeout', '429', '503'].includes(fault);
    const regenerated = fault === 'partial' || fault === 'invalid-json';
    expect(state.phase).toBe(
      transient || regenerated ? 'AWAITING_ACCEPTANCE' : 'FAILED',
    );
    expect(chat).toHaveBeenCalledTimes(transient || regenerated ? 2 : 1);
    expect(state.recoveryAttempts).toBe(regenerated ? 1 : 0);
    if (regenerated)
      expect(state.recoveries).toContainEqual(
        expect.objectContaining({
          method: 'PLAN_REGENERATE',
          outcome: 'REPAIRED',
        }),
      );
    expect(state.providerRetries).toBe(transient ? 1 : 0);
    expect(s.host.undoStack).toHaveLength(0);
    record('provider-' + fault, state, s.faults, runtime);
  },
);
it('retry-after longer than deadline terminates rather than silently ignoring limit', async () => {
  const s = setup(),
    chat = vi.fn(async () => {
      throw new AIError('rate_limit', 'fixture', {
        kind: 'http',
        status: 429,
        retryAfterMs: 60000,
      });
    });
  const planner = new AgentPlanner(
      new ProviderBridge({ chat }, provider, 'fixture', 'tools'),
    ),
    runtime = new TaskRuntime(s.adapter, undefined, {
      providerRetries: 1,
      durationMs: 1000,
    });
  const state = await runtime.planAndRun('shape', planner);
  expect(state.phase).toBe('FAILED');
  expect(state.errors.at(-1)!.code).toBe('BUDGET_EXCEEDED');
  expect(chat).toHaveBeenCalledTimes(1);
  record('rate-delay', state, s.faults, runtime);
});
it('input/output reservation blocks before transport, not after incurring cost', async () => {
  for (const budget of [{ inputTokens: 1 }, { outputTokens: 1 }]) {
    const s = setup(),
      chat = vi.fn(),
      planner = new AgentPlanner(
        new ProviderBridge({ chat }, provider, 'fixture', 'tools'),
      ),
      runtime = new TaskRuntime(s.adapter, undefined, budget);
    const state = await runtime.planAndRun('shape', planner);
    expect(state.phase).toBe('FAILED');
    expect(state.errors.at(-1)!.code).toBe('BUDGET_EXCEEDED');
    expect(chat).not.toHaveBeenCalled();
    expect(state.modelRequests).toBe(0);
    record('token-reserve-' + Object.keys(budget)[0], state, s.faults, runtime);
  }
});
