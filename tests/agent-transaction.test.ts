import { expect, it } from 'vitest';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { saveProject, loadProject } from '../src/core/project-io';
import { AgentTransaction } from '../src/agent/transaction';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import { registerReadTools } from '../src/agent/read-tools';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { motionSegments } from '../src/core/motion-curve';
function setup() {
  const base = createDefaultProject();
  const layer = createLayer('rectangle');
  const commands = new CommandSystem({
    ...base,
    compositions: [{ ...base.compositions[0]!, layers: [layer] }],
  });
  const registry = registerReadTools(
    registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
  );
  const initial = commands.getSnapshot();
  const draft = new AgentTransaction(commands, registry, initial, {
    time: 0,
    selection: [layer.id],
  });
  return {
    commands,
    layer,
    initial,
    draft,
    registry,
    signal: new AbortController().signal,
  };
}
it('one full entrance action gives one Undo, retains curves on save/load and works after Undo', async () => {
  const s = setup(),
    p = s.layer.transform.position;
  await s.draft.execute(
    'addKeyframe',
    { propertyId: p.id, time: 0, value: { x: -200, y: 540 } },
    s.signal,
  );
  await s.draft.execute(
    'addKeyframe',
    { propertyId: p.id, time: 1, value: { x: 960, y: 540 } },
    s.signal,
  );
  const segment = motionSegments(
    s.draft.getSnapshot().compositions[0]!.layers[0]!.transform.position,
  )[0]!;
  await s.draft.execute(
    'applyMotionCurve',
    {
      segmentIds: [segment.id],
      curve: { type: 'cubic-bezier', x1: 0.1, y1: 0.8, x2: 0.3, y2: 1 },
    },
    s.signal,
  );
  expect(s.commands.getSnapshot()).toBe(s.initial);
  expect(s.commands.undoStack).toHaveLength(0);
  const result = s.draft.commit('Agent入场');
  expect(result.transactionId).toBeTruthy();
  expect(s.commands.undoStack).toHaveLength(1);
  const saved = loadProject(saveProject(s.commands.getSnapshot()));
  expect(
    saved.compositions[0]!.layers[0]!.transform.position.keyframes,
  ).toHaveLength(2);
  expect(
    motionSegments(saved.compositions[0]!.layers[0]!.transform.position)[0]
      ?.curve,
  ).toMatchObject({ x1: 0.1 });
  s.commands.undo();
  expect(s.commands.getSnapshot()).toEqual(s.initial);
  const retry = new AgentTransaction(
    s.commands,
    s.registry,
    s.commands.getSnapshot(),
    { time: 0, selection: [s.layer.id] },
  );
  await retry.execute(
    'setPosition',
    { layerId: s.layer.id, value: { x: 100, y: 200 } },
    s.signal,
  );
  retry.commit('retry');
  expect(s.commands.undoStack).toHaveLength(1);
});
it('failure/discard, Stop and concurrent human edits do not publish partial changes', async () => {
  const s = setup();
  await s.draft.execute(
    'setPosition',
    { layerId: s.layer.id, value: { x: 1, y: 2 } },
    s.signal,
  );
  await expect(
    s.draft.execute(
      'addEffect',
      { layerId: crypto.randomUUID(), kind: 'gaussianBlur' },
      s.signal,
    ),
  ).rejects.toThrow();
  s.draft.discard();
  expect(s.commands.getSnapshot()).toBe(s.initial);
  expect(s.commands.undoStack).toHaveLength(0);
  await expect(
    s.draft.execute(
      'setOpacity',
      { layerId: s.layer.id, value: 0.5 },
      s.signal,
    ),
  ).rejects.toThrow('已结束');
  const t = setup();
  await t.draft.execute(
    'setOpacity',
    { layerId: t.layer.id, value: 0.5 },
    t.signal,
  );
  t.commands.executeTransaction(
    transaction('human', 'human', [
      command({
        type: 'layer.patch',
        compositionId: t.initial.activeCompositionId,
        layerId: t.layer.id,
        patch: { name: 'human edited' },
      }),
    ]),
  );
  expect(() => t.draft.commit('bad')).toThrow('工程已修改');
  expect(t.commands.undoStack).toHaveLength(1);
  expect(
    t.commands.getSnapshot().compositions[0]!.layers[0]!.transform.opacity
      .baseValue,
  ).toBe(1);
});
it('workspace pivot affects subsequent tools, commits only after success and stays outside Project', async () => {
  const s = setup();
  let pivot = 'anchor';
  const host = {
    getSnapshot: s.commands.getSnapshot,
    executeTransaction: s.commands.executeTransaction.bind(s.commands),
    applyWorkspace: (value: { pivotMode: string }) => {
      pivot = value.pivotMode;
    },
  };
  const draft = new AgentTransaction(host, s.registry, s.initial, {
    time: 0,
    selection: [s.layer.id],
  });
  await draft.execute(
    'setTransformPivot',
    { pivot: 'object-center' },
    s.signal,
  );
  await draft.execute(
    'setScale',
    { layerId: s.layer.id, value: { x: 2, y: 2 } },
    s.signal,
  );
  expect(pivot).toBe('anchor');
  draft.commit('scale');
  expect(pivot).toBe('object-center');
  expect(saveProject(s.commands.getSnapshot())).not.toContain('pivotMode');
  expect(s.commands.undoStack).toHaveLength(1);
});
