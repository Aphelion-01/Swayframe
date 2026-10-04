import { expect, it } from 'vitest';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import { CommandSystem, transaction } from '../src/core/command-system';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { motionSegments } from '../src/core/motion-curve';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { boundsCenter, getWorldBounds } from '../src/core/layer-bounds';
function setup() {
  const base = createDefaultProject();
  const a = createLayer('rectangle', { position: { x: 300, y: 300 } }),
    b = createLayer('rectangle', { position: { x: 900, y: 300 } }),
    text = createLayer('text', { position: { x: 500, y: 500 } });
  const commands = new CommandSystem({
    ...base,
    compositions: [{ ...base.compositions[0]!, layers: [a, b, text] }],
  });
  const registry = registerAnimationTools(
    registerCoreWriteTools(new AgentToolRegistry()),
  );
  const run = (name: string, args: unknown, confirmed = false) => {
    const context = {
      project: commands.getSnapshot(),
      time: 0,
      selection: [a.id, b.id],
    };
    const result = commands.executeTransaction(
      transaction(
        name,
        'agent',
        registry.compile(name, args, context, confirmed),
      ),
    );
    if (!result.ok) throw Error(result.error);
    return result;
  };
  return { a, b, text, commands, registry, run };
}
it('real animation/curve/text/effect commands mutate persisted state and undo cleanly', () => {
  const s = setup(),
    p = s.a.transform.position;
  const base = s.commands.getSnapshot();
  s.run('addKeyframe', {
    propertyId: p.id,
    time: 0,
    value: { x: -200, y: 300 },
  });
  s.run('addKeyframe', {
    propertyId: p.id,
    time: 1,
    value: { x: 300, y: 300 },
  });
  const segment = motionSegments(
    s.commands.getSnapshot().compositions[0]!.layers[0]!.transform.position,
  )[0]!;
  s.run('applyMotionCurve', {
    segmentIds: [segment.id],
    curve: { type: 'cubic-bezier', x1: 0.1, y1: 0.8, x2: 0.3, y2: 1 },
  });
  expect(
    motionSegments(
      s.commands.getSnapshot().compositions[0]!.layers[0]!.transform.position,
    )[0]!.curve,
  ).toMatchObject({ x1: 0.1, y1: 0.8 });
  s.run('setFontSize', { layerId: s.text.id, value: 80 });
  s.run('setTracking', { layerId: s.text.id, value: 8 });
  s.run('setTextContent', { layerId: s.text.id, content: 'HELLO SWAYFRAME' });
  const effectId = crypto.randomUUID();
  s.run('addEffect', { layerId: s.b.id, kind: 'gaussianBlur', effectId });
  s.run('setEffectParameter', {
    layerId: s.b.id,
    effectId,
    key: 'radius',
    value: 8,
  });
  const layer = s.commands.getSnapshot().compositions[0]!.layers[1]!;
  expect(
    layer.editor!.graph!.nodes.find((n) => n.id === effectId)?.params.radius
      ?.baseValue,
  ).toBe(8);
  while (s.commands.undoStack.length) s.commands.undo();
  expect(s.commands.getSnapshot()).toEqual(base);
});
it('shared selection-center scaling doubles spacing without moving center, and respects lock and destructive permissions', () => {
  const s = setup();
  s.run('transformSelection', {
    layerIds: [s.a.id, s.b.id],
    operation: { kind: 'scale', factor: { x: 2, y: 2 } },
    pivot: 'selection-center',
    orientation: 'global',
  });
  const p = s.commands.getSnapshot(),
    snapshot = createRenderSnapshot(p.compositions[0]!, 0, [], undefined, p);
  const centers = snapshot.layers
    .slice(0, 2)
    .map((l) => boundsCenter(getWorldBounds(l, 0)));
  expect(centers[1]!.x - centers[0]!.x).toBeCloseTo(1200);
  expect((centers[0]!.x + centers[1]!.x) / 2).toBeCloseTo(600);
  expect(() => s.run('deleteLayer', { layerId: s.a.id })).toThrow('确认');
  expect(() =>
    s.run('setPosition', { layerId: s.a.id, value: { x: NaN, y: 0 } }),
  ).toThrow('参数');
  const current = s.commands.getSnapshot();
  const locked = new CommandSystem({
    ...current,
    compositions: [
      {
        ...current.compositions[0]!,
        layers: current.compositions[0]!.layers.map((l) => ({
          ...l,
          locked: true,
        })),
      },
    ],
  });
  expect(() =>
    s.registry.compile(
      'renameLayer',
      { layerId: s.a.id, name: 'bad' },
      { project: locked.getSnapshot(), time: 0, selection: [] },
    ),
  ).toThrow('锁定');
});
it('creation IDs, path control points and workspace pivot remain structured and validated', () => {
  const s = setup(),
    id = crypto.randomUUID();
  s.run('createText', { layerId: id, content: 'HELLO SWAYFRAME' });
  const created = s.commands.getSnapshot().compositions[0]!.layers.at(-1)!;
  expect(created.id).toBe(id);
  expect(created.editor!.graph!.owner.id).toBe(id);
  expect(created.transform.position.baseValue).toEqual({ x: 960, y: 540 });
  const context = { project: s.commands.getSnapshot(), time: 0, selection: [] };
  expect(
    s.registry.workspacePatch(
      'setTransformPivot',
      { pivot: 'selection-center' },
      context,
    ),
  ).toEqual({ pivotMode: 'selection-center' });
  expect(
    s.registry.compile(
      'setTransformPivot',
      { pivot: 'selection-center' },
      context,
    ),
  ).toEqual([]);
  expect(() =>
    s.registry.compile('createPath', { points: [1, 2] }, context),
  ).toThrow('参数');
  expect(() =>
    s.registry.compile(
      'createLayer',
      { kind: 'image', assetId: crypto.randomUUID() },
      context,
    ),
  ).toThrow('已导入');
});
