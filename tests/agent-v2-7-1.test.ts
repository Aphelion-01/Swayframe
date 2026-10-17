import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from '../src/ai/openai-provider';
import { ProviderBridge } from '../src/agent-v2/provider';
import {
  AgentPlanner,
  creationContract,
  validateIntent,
} from '../src/agent-v2/planner';
import { TaskRuntime } from '../src/agent-v2/runtime';
import { EditorAdapter } from '../src/agent-v2/editor-adapter';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { registerReadTools } from '../src/agent/read-tools';
import { registerSemanticActions } from '../src/agent/semantic-actions';
import { CommandSystem } from '../src/core/command-system';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
import { saveProject, loadProject } from '../src/core/project-io';
import type { ProviderConfig } from '../src/ai/contracts';
const captured = (index: number) =>
  JSON.parse(readFileSync(`docs/qa/agent-v2-7-1/call-${index}.json`, 'utf8'));
const rawIntent = (index: number) =>
  JSON.parse(
    captured(index).response.choices[0].message.tool_calls[0].function
      .arguments,
  );
const goal = (index: number): string =>
  captured(index).body.messages.at(-1).content;
const config: ProviderConfig = {
  id: '00000000-0000-4000-8000-000000000111',
  name: 'Offline replay',
  type: 'openai-compatible',
  baseUrl: 'https://offline.invalid/v1',
  enabled: true,
  defaultModel: 'deepseek-v4-flash',
  models: [
    { id: 'deepseek-v4-flash', name: 'Offline', capabilities: ['text'] },
  ],
};
function setup(
  responses: unknown[],
  existing?: ReturnType<typeof createLayer>,
  budget = {},
) {
  let project = createDefaultProject();
  if (existing)
    project = {
      ...project,
      compositions: project.compositions.map((c) => ({
        ...c,
        layers: [existing],
      })),
    };
  const host = new CommandSystem(project);
  const reg = registerReadTools(
    registerSemanticActions(
      registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
    ),
  );
  const adapter = new EditorAdapter(
    host,
    reg,
    {
      compositionId: project.activeCompositionId,
      existingLayerIds: existing ? [existing.id] : [],
      allowCreate: !existing,
    },
    existing ? [existing.id] : [],
  );
  let index = 0;
  const fetcher = vi.fn<typeof fetch>(async () => {
    if (index >= responses.length)
      throw new Error('Offline response exhausted; network forbidden');
    return new Response(JSON.stringify(responses[index++]), { status: 200 });
  });
  const transport = new OpenAICompatibleProvider(
    config,
    async () => ({ apiKey: 'offline-fixture', headers: {} }),
    fetcher,
  );
  const planner = new AgentPlanner(
    new ProviderBridge(transport, config, config.defaultModel, 'tools'),
  );
  return {
    host,
    adapter,
    runtime: new TaskRuntime(adapter, undefined, budget),
    planner,
    fetcher,
  };
}
function response(intent: unknown) {
  const raw = structuredClone(captured(30).response);
  raw.choices[0].message.tool_calls[0].function.arguments =
    JSON.stringify(intent);
  return raw;
}
it.each([29, 30])(
  'exact original response %s fails before draft writes and preserves Scene/history',
  async (index) => {
    const s = setup([captured(index).response], undefined, { recoveries: 0 });
    const before = saveProject(s.host.getSnapshot());
    const state = await s.runtime.planAndRun(goal(index), s.planner);
    expect(state.phase).toBe('FAILED');
    expect(state.actionAttempts).toBe(0);
    expect(state.errors[0]?.field).toBe(
      index === 29 ? 'actions.id' : 'actions.creation',
    );
    expect(saveProject(s.host.getSnapshot())).toBe(before);
    expect(saveProject(s.adapter.snapshot())).toBe(before);
    expect(s.host.undoStack).toHaveLength(0);
    expect(() => s.runtime.accept('invalid')).toThrow();
  },
);
it('production response normalizer preserves the four A1 actions exactly once', async () => {
  const s = setup([captured(29).response]);
  const result = await s.planner.plan(
    goal(29),
    {},
    [],
    new AbortController().signal,
  );
  expect(result.rawIntent).toEqual(rawIntent(29));
  expect((result.rawIntent as { actions: unknown[] }).actions).toHaveLength(4);
  expect(s.fetcher).toHaveBeenCalledTimes(1);
});
it.each([29, 30])(
  'one rejected plan %s gets one audited replan, never silent deletion',
  async (index) => {
    const original = rawIntent(index);
    const fixed =
      index === 30
        ? { goal: 'model rewrites the goal', actions: [original.actions[1]] }
        : {
            goal: 'model rewrites the goal',
            actions: [0, 1, 2].flatMap((n) => [
              {
                id: `shape${n}`,
                type: 'createShape',
                shape: 'rectangle',
                width: 240,
                height: 200,
                position: { x: 400 + 400 * n, y: 540 },
              },
              {
                id: `fill${n}`,
                type: 'setFill',
                target: { kind: 'result', actionId: `shape${n}` },
                color: {
                  r: Number(n === 0),
                  g: Number(n === 1),
                  b: Number(n === 2),
                  a: 1,
                },
              },
            ]),
          };
    // Hand-authored second response is a fixture, never a new Live success.
    const s = setup([captured(index).response, response(fixed)]);
    const before = saveProject(s.host.getSnapshot());
    const state = await s.runtime.planAndRun(goal(index), s.planner);
    expect(state.phase).toBe('AWAITING_ACCEPTANCE');
    expect(state.modelRequests).toBe(2);
    expect(state.recoveryAttempts).toBe(1);
    expect(state.errors).toHaveLength(1);
    expect(state.errors[0]?.actual).toHaveProperty('rejectedIntent', original);
    expect(state.recoveries.map((r) => r.outcome)).toEqual([
      'REJECTED',
      'REPAIRED',
    ]);
    expect(state.goal).toBe(goal(index));
    expect(saveProject(s.host.getSnapshot())).toBe(before);
    const second = JSON.parse(String(s.fetcher.mock.calls[1]![1]!.body));
    expect(second.messages[0].content).toContain('rejectedPlan');
    s.runtime.accept(state.proposalId!);
    const layers = activeComposition(s.host.getSnapshot()).layers;
    expect(layers).toHaveLength(index === 29 ? 3 : 1);
    if (index === 30)
      expect(layers[0]).toMatchObject({ type: 'text', text: 'Cubic' });
    else
      for (const [n, l] of layers.entries()) {
        expect(l.width).toBe(240);
        expect(l.height).toBe(200);
        expect(l.transform.position.baseValue).toEqual({
          x: 400 + n * 400,
          y: 540,
        });
        expect(l.editor?.properties.fill?.baseValue).toEqual([
          Number(n === 0),
          Number(n === 1),
          Number(n === 2),
          1,
        ]);
      }
    expect(s.host.undoStack).toHaveLength(1);
    expect(
      activeComposition(loadProject(saveProject(s.host.getSnapshot()))).layers,
    ).toHaveLength(layers.length);
    s.host.undo();
    expect(saveProject(s.host.getSnapshot())).toBe(before);
    s.host.redo();
    expect(activeComposition(s.host.getSnapshot()).layers).toHaveLength(
      layers.length,
    );
  },
);
it('second invalid plan stops rather than looping or changing action identities', async () => {
  const s = setup([captured(29).response, captured(29).response]);
  const state = await s.runtime.planAndRun(goal(29), s.planner);
  expect(state.phase).toBe('FAILED');
  expect(state.modelRequests).toBe(2);
  expect(state.errors).toHaveLength(2);
  expect(state.recoveries.map((r) => r.outcome)).toEqual([
    'REJECTED',
    'REJECTED',
  ]);
  expect(state.actionAttempts).toBe(0);
  expect(s.host.undoStack).toHaveLength(0);
});
it('request cap blocks replan before transport', async () => {
  const s = setup([captured(29).response], undefined, { modelRequests: 1 });
  const state = await s.runtime.planAndRun(goal(29), s.planner);
  expect(state.phase).toBe('FAILED');
  expect(s.fetcher).toHaveBeenCalledTimes(1);
  expect(state.errors.at(-1)?.code).toBe('BUDGET_EXCEEDED');
});
it.each([
  '创建两个椭圆',
  '只创建一个文本，内容为Orbit，不要添加其他图层。',
  '创建2个矩形，添加一个标题',
])('generic count/type constraints: %s', (request) => {
  const expected = creationContract(request)!;
  expect(expected).not.toBeNull();
  expect(() =>
    validateIntent(
      {
        goal: 'untrusted',
        actions: [{ id: 'a', type: 'createShape', shape: 'rectangle' }],
      },
      request,
    ),
  ).toThrow();
});
it('ambiguous/quoted creation language is not guessed', () => {
  expect(creationContract('创建一些文字')).toBeNull();
  expect(creationContract('创建一个矩形，再创建若干椭圆')).toBeNull();
  expect(creationContract('创建一个文字，内容为创建三个矩形')).toBeNull();
});
it('identical objects with distinct IDs and legitimate repeated edits are retained', () => {
  const actions = [
    { id: 'a', type: 'createShape', shape: 'rectangle' },
    { id: 'b', type: 'createShape', shape: 'rectangle' },
    {
      id: 'move1',
      type: 'setProperty',
      target: { kind: 'result', actionId: 'a' },
      property: 'position',
      value: { x: 1, y: 2 },
      time: 0,
    },
    {
      id: 'move2',
      type: 'setProperty',
      target: { kind: 'result', actionId: 'a' },
      property: 'position',
      value: { x: 1, y: 2 },
      time: 1,
    },
  ];
  expect(
    validateIntent({ goal: '创建两个矩形', actions }, '创建两个矩形').actions,
  ).toHaveLength(4);
});
it.each([31, 32, 34, 37, 39])(
  'captured historical PASS response %s remains executable (offline)',
  async (index) => {
    const text = index === 39;
    let layer =
      index === 31 ? undefined : createLayer(text ? 'text' : 'rectangle');
    if (layer && index === 37) {
      const id = rawIntent(37).actions[0].target.id;
      layer = {
        ...layer,
        id,
        editor: {
          ...layer.editor!,
          graph: { ...layer.editor!.graph!, owner: { type: 'layer', id } },
        },
      };
    }
    const s = setup([captured(index).response], layer);
    const state = await s.runtime.planAndRun(goal(index), s.planner);
    expect(state.phase).toBe('AWAITING_ACCEPTANCE');
    expect(state.modelRequests).toBe(1);
    s.runtime.accept(state.proposalId!);
    const result = activeComposition(s.host.getSnapshot()).layers[0]!;
    if (index === 31) expect(result.editor?.gradient).toBe('radial');
    if (index === 32)
      expect(result.transform.position.baseValue).toEqual({ x: 600, y: 80 });
    if (index === 34)
      expect(result.editor?.properties.fill?.baseValue).toEqual([0, 0, 1, 1]);
    if (index === 37) expect(result).toMatchObject({ width: 300, height: 180 });
    if (index === 39) expect(result).toMatchObject({ fontFamily: 'serif' });
  },
);
it('actual draft extra-object injection is rejected even after valid planning', async () => {
  const intent = {
    goal: '创建一个文字',
    actions: [{ id: 'text', type: 'createText', content: 'Orbit' }],
  };
  const s = setup([response(intent)]);
  const execute = s.adapter.execute.bind(s.adapter);
  vi.spyOn(s.adapter, 'execute').mockImplementation(async (...args) => {
    const result = await execute(...args);
    await execute(
      {
        id: 'injected',
        type: 'createShape',
        shape: 'rectangle',
        dependsOn: [],
      },
      undefined,
      undefined,
      args[3],
    );
    return result;
  });
  const before = saveProject(s.host.getSnapshot());
  const state = await s.runtime.planAndRun('创建一个文字', s.planner);
  expect(state.phase).toBe('FAILED');
  expect(state.errors.at(-1)?.field).toBe('scene.creation');
  expect(saveProject(s.host.getSnapshot())).toBe(before);
  expect(s.host.undoStack).toHaveLength(0);
});
it('cancelled replan cannot execute a late corrected response', async () => {
  const s = setup([captured(29).response]);
  let release!: (value: Response) => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  s.fetcher.mockImplementationOnce(
    async () => new Response(JSON.stringify(captured(29).response)),
  );
  s.fetcher.mockImplementationOnce(() => {
    entered();
    return new Promise<Response>((resolve) => {
      release = resolve;
    });
  });
  const pending = s.runtime.planAndRun(goal(29), s.planner);
  await started;
  s.runtime.cancel();
  release(
    new Response(
      JSON.stringify(
        response({ goal: 'ignored', actions: [rawIntent(30).actions[1]] }),
      ),
    ),
  );
  const state = await pending;
  expect(state.phase).toBe('CANCELLED');
  expect(state.actionAttempts).toBe(0);
  expect(s.host.undoStack).toHaveLength(0);
  expect(activeComposition(s.host.getSnapshot()).layers).toHaveLength(0);
});
