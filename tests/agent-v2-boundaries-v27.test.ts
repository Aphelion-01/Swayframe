// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { AgentSnapshotRenderer } from '../src/agent/vision';
import { EditorAdapter } from '../src/agent-v2/editor-adapter';
import { problem } from '../src/agent-v2/errors';
import { activeComposition, createLayer } from '../src/core/project-model';
import { command } from '../src/core/command-system';
import { saveProject } from '../src/core/project-io';
import { coreExecutionTools } from '../src/agent-v2/editor-adapter';
import {
  sessionFixture,
  existing,
  rgb,
} from './helpers/agent-v2-session-fixture';
afterEach(() => vi.restoreAllMocks());
async function setup() {
  vi.spyOn(AgentSnapshotRenderer.prototype, 'render').mockResolvedValue({
    image: 'data:image/png;base64,YQ==',
    pixelEvidence: { width: 10, height: 10, foregroundPixels: 1 },
  } as Awaited<ReturnType<AgentSnapshotRenderer['render']>>);
  return sessionFixture();
}
const layers = (s: Awaited<ReturnType<typeof setup>>) =>
  activeComposition(s.store.commands.getSnapshot()).layers;
it('recovery after an earlier committed turn retries only the failed action and preserves prior identity/history', async () => {
  const s = await setup();
  await s.turn('创建矩形', [
    { id: 'r', type: 'createShape', shape: 'rectangle' },
  ]);
  const id = layers(s)[0]!.id;
  const original = EditorAdapter.prototype.execute;
  let faults = 0;
  vi.spyOn(EditorAdapter.prototype, 'execute').mockImplementation(function (
    this: EditorAdapter,
    a,
    t,
    k,
    signal,
  ) {
    if (a.id === 'f' && !faults++)
      throw problem('COMMAND_REJECTION', 'Injected reject before write', {
        recoverable: true,
        strategy: 'RETRY_ACTION',
      });
    return original.call(this, a, t, k, signal);
  });
  await s.turn('把刚才的矩形改为蓝色', [
    { id: 'f', type: 'setFill', target: existing(id), color: rgb(0, 0, 1) },
  ]);
  expect(s.core.state?.deterministicRecoveries).toBe(1);
  expect(s.core.state?.modelRequests).toBe(1);
  expect(layers(s)).toHaveLength(1);
  expect(layers(s)[0]!.id).toBe(id);
  expect(s.store.commands.undoStack).toHaveLength(2);
  s.store.undo();
  expect(layers(s)[0]!.id).toBe(id);
  expect(s.store.commands.undoStack).toHaveLength(1);
});
it('one bounded local model repair after a prior commit keeps completed work and exports accurate per-turn accounting', async () => {
  const s = await setup();
  await s.turn('创建矩形', [
    { id: 'r', type: 'createShape', shape: 'rectangle' },
  ]);
  const id = layers(s)[0]!.id;
  const invalid = {
    id: 'o',
    type: 'setProperty' as const,
    target: existing(id),
    property: 'opacity' as const,
    value: 2,
  };
  s.enqueue([invalid]);
  s.queued.push(async (r) => ({
    model: 'fixture',
    text: '',
    toolCalls: [
      {
        id: 'repair',
        name: r.toolChoice!,
        arguments: { ...invalid, dependsOn: [], value: 0.5 },
      },
    ],
    usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
  }));
  await s.core.run('把刚才的矩形透明度改成0.5');
  expect(s.core.pending).toBe(true);
  expect(layers(s)[0]!.transform.opacity.baseValue).toBe(1);
  s.core.accept();
  expect(s.core.state?.recoveryAttempts).toBe(1);
  expect(s.core.state?.modelRequests).toBe(2);
  expect(layers(s)[0]!.id).toBe(id);
  const report = JSON.parse(s.core.diagnostic());
  expect(report.turns).toHaveLength(2);
  expect(
    report.turns.reduce(
      (n: number, t: { modelRequests: number }) => n + t.modelRequests,
      0,
    ),
  ).toBe(3);
  expect(report.turns[1].usage).toEqual([
    { inputTokens: 100, outputTokens: 50 },
    { inputTokens: 30, outputTokens: 10 },
  ]);
});
it('different EditorStore sessions never share committed references, engine choice, drafts or request budget', async () => {
  const a = await setup(),
    b = await setup();
  await a.turn('创建矩形', [
    { id: 'r', type: 'createShape', shape: 'rectangle' },
  ]);
  expect(b.core.session.references).toHaveLength(0);
  await expect(b.core.run('把刚才的矩形改成蓝色')).rejects.toThrow();
  expect(b.calls).toHaveLength(0);
  b.core.select('legacy-v1');
  expect(a.core.session.id).not.toBe(b.core.session.id);
  expect(layers(a)).toHaveLength(1);
  expect(layers(b)).toHaveLength(0);
  const before = a.core.session.id;
  a.core.newSession();
  expect(a.core.session.id).not.toBe(before);
  expect(JSON.parse(a.core.diagnostic()).turns).toEqual([]);
});
it('preflight failure cannot mislabel a previous completed task or overwrite its turn trace', async () => {
  const s = await setup();
  await s.turn('创建矩形', [
    { id: 'r', type: 'createShape', shape: 'rectangle' },
  ]);
  const old = JSON.parse(s.core.diagnostic()).turns[0];
  s.store.undo();
  await expect(s.core.run('把刚才的矩形改为蓝色')).rejects.toThrow();
  expect(s.core.state).toBeNull();
  expect(JSON.parse(s.core.diagnostic()).turns[0]).toEqual(old);
});
it('matched offline V1/V2 subset uses the same initial Scene/goals/provider/settings and protects non-target layers', async () => {
  const records: unknown[] = [];
  for (const task of ['fill', 'dimensions', 'font'] as const) {
    const first = await setup(),
      target = createLayer(task === 'font' ? 'text' : 'rectangle'),
      protectedLayer = createLayer('ellipse');
    const comp = first.store.commands.getSnapshot().activeCompositionId;
    first.store.run('fixture baseline', [
      command({ type: 'layer.create', compositionId: comp, layer: target }),
      command({
        type: 'layer.create',
        compositionId: comp,
        layer: protectedLayer,
      }),
    ]);
    const baseline = saveProject(first.store.commands.getSnapshot());
    for (const runtime of ['legacy-v1', 'core-v2'] as const) {
      const s = await setup();
      s.store.load(baseline);
      s.store.select(target.id);
      s.core.select(runtime);
      const goal =
        task === 'fill'
          ? '把当前选中图层改为蓝色'
          : task === 'dimensions'
            ? '修改当前选中图层宽高'
            : '修改当前选中文字字体';
      if (runtime === 'core-v2')
        await s.turn(
          goal,
          task === 'fill'
            ? [
                {
                  id: 'edit',
                  type: 'setFill',
                  target: existing(target.id),
                  color: rgb(0, 0, 1),
                },
              ]
            : task === 'dimensions'
              ? [
                  {
                    id: 'edit',
                    type: 'setDimensions',
                    target: existing(target.id),
                    width: 300,
                    height: 180,
                  },
                ]
              : [
                  {
                    id: 'edit',
                    type: 'setFont',
                    target: existing(target.id),
                    fontFamily: 'serif',
                  },
                ],
        );
      else {
        const catalog = s.native.registry.catalog.bind(s.native.registry);
        s.native.registry.catalog = () =>
          catalog().filter(
            (t) =>
              t.permission === 'READ' ||
              (coreExecutionTools as readonly string[]).includes(t.name),
          );
        const begin = s.native.runtime.begin.bind(s.native.runtime);
        s.native.runtime.begin = (...args) => {
          const tx = begin(...args),
            execute = tx.execute.bind(tx);
          tx.execute = (name, ...rest) => {
            if (!(coreExecutionTools as readonly string[]).includes(name))
              throw Error('Matched subset write denied');
            return execute(name, ...rest);
          };
          return tx;
        };
        s.queued.push(async () => ({
          model: 'fixture',
          text: '',
          toolCalls: [
            {
              id: 'fixture',
              name: 'submitPlan',
              arguments: {
                id: 'matched',
                goal,
                risk: 'low',
                steps: [
                  {
                    id: 'edit',
                    label: 'Offline edit',
                    tool:
                      task === 'fill'
                        ? 'setFill'
                        : task === 'dimensions'
                          ? 'setLayerDimensions'
                          : 'setFont',
                    arguments: {
                      layerId: target.id,
                      ...(task === 'fill'
                        ? { color: rgb(0, 0, 1) }
                        : task === 'dimensions'
                          ? { width: 300, height: 180 }
                          : { fontFamily: 'serif' }),
                    },
                  },
                ],
              },
            },
          ],
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        }));
        await s.native.agent.run(goal);
        let state = s.native.agent.getSnapshot();
        if (state.pendingConfirmation && state.currentPlan) {
          await s.native.agent.preview(state.currentPlan.id);
          state = s.native.agent.getSnapshot();
          if (state.pendingConfirmation && state.currentPlan)
            await s.native.agent.apply(state.currentPlan.id);
        }
        expect(
          s.native.agent.getSnapshot().status,
          task + ': ' + (s.native.agent.getSnapshot().error ?? 'V1 status'),
        ).toBe('completed');
      }
      expect(layers(s).find((l) => l.id === protectedLayer.id)).toEqual(
        protectedLayer,
      );
      expect(layers(s)).toHaveLength(2);
      expect(s.calls).toHaveLength(1);
      const edited = layers(s).find((l) => l.id === target.id)!;
      if (task === 'fill')
        expect(edited.editor?.properties.fill?.baseValue).toEqual([0, 0, 1, 1]);
      else if (task === 'dimensions')
        expect([edited.width, edited.height]).toEqual([300, 180]);
      else expect(edited.type === 'text' && edited.fontFamily).toBe('serif');
      records.push({
        task,
        runtime,
        pass: true,
        fixtureRequests: s.calls.length,
        syntheticUsage: s.calls.length * 150,
        inputSerializedBytes: JSON.stringify(s.calls[0]).length,
        realModelTokens: null,
      });
    }
  }
  fs.mkdirSync('outputs/agent-v2-7', { recursive: true });
  fs.writeFileSync(
    'outputs/agent-v2-7/matched-offline.json',
    JSON.stringify(
      {
        scope:
          'OFFLINE matched 13 WRITE tools; real native V1 and editor V2, jsdom rendering mocked; no LLM quality or cost inference',
        records,
      },
      null,
      2,
    ),
  );
});

it('bounded session index retains original ordinal identity and never silently renumbers after 100 creations', async () => {
  const s = await setup();
  await s.turn(
    '创建100个矩形',
    Array.from({ length: 100 }, (_, i) => ({
      id: 'r' + i,
      type: 'createShape' as const,
      shape: 'rectangle' as const,
    })),
  );
  const first = layers(s)[0]!.id;
  await s.turn('再创建矩形', [
    { id: 'r', type: 'createShape', shape: 'rectangle' },
  ]);
  expect(s.core.session.references).toHaveLength(100);
  expect(s.core.session.references[0]!.id).toBe(first);
  expect(() =>
    s.core.session.resolveRequest(
      '修改第十一个矩形宽高',
      s.store.commands.getSnapshot(),
      [],
    ),
  ).toThrow('中文序号');
  expect(
    s.core.session.resolveRequest(
      '修改第11个矩形宽高',
      s.store.commands.getSnapshot(),
      [],
    ).ids,
  ).toEqual([layers(s)[10]!.id]);
  expect(
    s.core.session.resolveRequest(
      '修改第一个矩形宽高',
      s.store.commands.getSnapshot(),
      [],
    ).ids,
  ).toEqual([first]);
  await expect(s.core.run('修改第101个矩形宽高')).rejects.toThrow('序号');
  expect(s.calls).toHaveLength(2);
});

it.each(['rectangle', 'camera'] as const)(
  '3D %s supports the same native position path without bypassing draft acceptance',
  async (kind) => {
    const s = await setup(),
      layer = createLayer(kind);
    const created = { ...layer, editor: { ...layer.editor!, is3D: true } };
    s.store.run('GUI create3D', [
      command({
        type: 'layer.create',
        compositionId: s.store.commands.getSnapshot().activeCompositionId,
        layer: created,
      }),
    ]);
    s.store.select(layer.id);
    const baseline = saveProject(s.store.commands.getSnapshot());
    s.enqueue([
      {
        id: 'position',
        type: 'setProperty',
        target: existing(layer.id),
        property: 'position',
        value: { x: 100, y: 100 },
      },
    ]);
    await s.core.run('修改当前选中图层位置');
    expect(s.core.pending).toBe(true);
    expect(s.calls).toHaveLength(1);
    expect(saveProject(s.store.commands.getSnapshot())).toBe(baseline);
    s.core.accept();
    expect(layers(s)[0]!.transform.position.baseValue).toEqual({
      x: 100,
      y: 100,
    });
    s.store.undo();
    expect(saveProject(s.store.commands.getSnapshot())).toBe(baseline);
  },
);

it('actual playhead time is used for property edits, semantic verification and preview; explicit action time still wins', async () => {
  const s = await setup();
  await s.turn('创建矩形', [
    { id: 'r', type: 'createShape', shape: 'rectangle' },
  ]);
  const id = layers(s)[0]!.id;
  await s.turn(
    '给矩形添加位置动画',
    [0, 2].map((time) => ({
      id: 'k' + time,
      type: 'addKeyframe',
      target: existing(id),
      property: 'position',
      time,
      value: { x: 100 + 250 * time, y: 200 },
    })),
  );
  s.store.setTime(2);
  await s.turn('修改矩形位置', [
    {
      id: 'p',
      type: 'setProperty',
      target: existing(id),
      property: 'position',
      value: { x: 700, y: 250 },
    },
  ]);
  expect(
    layers(s)[0]!.transform.position.keyframes.find((k) => k.time === 2)!.value,
  ).toEqual({ x: 700, y: 250 });
  expect(
    layers(s)[0]!.transform.position.keyframes.find((k) => k.time === 0)!.value,
  ).toEqual({ x: 100, y: 200 });
  expect(
    vi.mocked(AgentSnapshotRenderer.prototype.render).mock.calls.at(-1)![1],
  ).toBe(2);
  await s.turn('修改矩形零秒位置', [
    {
      id: 'p',
      type: 'setProperty',
      target: existing(id),
      property: 'position',
      time: 0,
      value: { x: 50, y: 50 },
    },
  ]);
  expect(
    layers(s)[0]!.transform.position.keyframes.find((k) => k.time === 0)!.value,
  ).toEqual({ x: 50, y: 50 });
  expect(
    layers(s)[0]!.transform.position.keyframes.find((k) => k.time === 2)!.value,
  ).toEqual({ x: 700, y: 250 });
});
