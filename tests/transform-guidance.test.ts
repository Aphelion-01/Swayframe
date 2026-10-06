import { command } from '../src/core/command-system';
import { expect, it } from 'vitest';
import {
  createLayer,
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { createTransformContext } from '../src/core/transform-resolvers';
import {
  createTransformGuideModel,
  hitTransformRotationGuide,
} from '../src/core/transform-guidance';
import { transformItems } from '../src/core/transform-operations';
import { layerToWorld } from '../src/core/transform-geometry';
import { EditorStore } from '../src/ui/editor-store';
import type { TransformPivotMode } from '../src/core/transform-context';
function fixture(
  pivotMode: TransformPivotMode = 'object-center',
  rotation = 0,
) {
  const l = createLayer('rectangle', {
    position: { x: 400, y: 300 },
    width: 200,
    height: 100,
  });
  const layer = {
    ...l,
    transform: {
      ...l.transform,
      rotation: { ...l.transform.rotation, baseValue: rotation },
    },
  };
  const c = { ...activeComposition(createDefaultProject()), layers: [layer] };
  const snapshot = createRenderSnapshot(c, 0, [layer.id]);
  const context = createTransformContext(snapshot, [layer.id], {
    orientation: 'local',
    pivotMode,
  });
  return { context, snapshot, layer };
}
it('CASE 1/2: center expands symmetrically, bottom stays fixed in actual engine and ghost', () => {
  const center = fixture();
  const a = createTransformGuideModel(
    center.context,
    center.snapshot,
    { property: 'scale', phase: 'hover' },
    1,
    true,
  );
  expect(a.scaleDirections).toHaveLength(4);
  expect(a.scaleDirections.filter((d) => d.end.x > d.start.x)).toHaveLength(2);
  expect(a.scaleDirections.filter((d) => d.end.y > d.start.y)).toHaveLength(2);
  const f = fixture('bottom');
  expect(f.context.pivot).toEqual({ x: 400, y: 350 });
  const b = createTransformGuideModel(
    f.context,
    f.snapshot,
    { property: 'scale', phase: 'hover' },
    1,
    true,
  );
  expect(b.ghostPreview[0]![2]!.y).toBeCloseTo(350);
  expect(b.ghostPreview[0]![3]!.y).toBeCloseTo(350);
  expect(b.scaleDirections.every((d) => d.end.y <= d.start.y)).toBe(true);
  const next = transformItems(f.context, {
    kind: 'scale',
    factor: { x: 2, y: 2 },
  })[0]!;
  expect(layerToWorld(next, { x: 0, y: 50 })).toEqual(f.context.pivot);
});
it('CASE 3/4/5: arc center and coordinate basis match the real transform; external pivot has connection', () => {
  const f = fixture('top-left', 45);
  const arc = createTransformGuideModel(f.context, f.snapshot, {
    property: 'rotation',
    phase: 'hover',
  }).rotationArcs[0]!;
  expect(arc.pivot).toEqual(f.context.pivot);
  const arcModel = createTransformGuideModel(f.context, f.snapshot, {
    property: 'rotation',
    phase: 'hover',
  });
  expect(
    hitTransformRotationGuide(
      arcModel,
      { x: arc.pivot.x, y: arc.pivot.y - arc.radius },
      2,
    ),
  ).toBe(true);
  expect(
    hitTransformRotationGuide(
      arcModel,
      { x: arc.pivot.x, y: arc.pivot.y + arc.radius },
      2,
    ),
  ).toBe(false);

  const global = createTransformContext(f.snapshot, [f.layer.id], {
    orientation: 'global',
    pivotMode: 'object-center',
  });
  const local = createTransformGuideModel(f.context, f.snapshot).axes[0]!;
  const world = createTransformGuideModel(global, f.snapshot).axes[0]!;
  expect(world.end.y).toBe(world.start.y);
  expect(local.end.y - local.start.y).toBeCloseTo(40 * Math.SQRT1_2);
  const custom = createTransformContext(f.snapshot, [f.layer.id], {
    orientation: 'global',
    pivotMode: 'custom',
    customPivot: { x: 50, y: 50 },
  });
  const model = createTransformGuideModel(
    custom,
    f.snapshot,
    { property: 'rotation', phase: 'hover' },
    1,
    true,
  );
  expect(model.connectionLines[0]!.end).toEqual({ x: 50, y: 50 });
  expect(model.rotationArcs[0]!.pivot).toEqual({ x: 50, y: 50 });
});
it('CASE 7/8: X-only has no Y expansion; active scale keeps initial fixed pivot while bounds change', () => {
  const f = fixture('bottom');
  const model = createTransformGuideModel(
    f.context,
    f.snapshot,
    { property: 'scale', axis: 'x', phase: 'active' },
    1,
    true,
  );
  expect(model.scaleDirections.every((d) => d.start.y === d.end.y)).toBe(true);
  expect(model.ghostPreview[0]![0]!.y).toEqual(250);
  const live = {
    ...f.snapshot,
    layers: transformItems(f.context, {
      kind: 'scale',
      factor: { x: 1.8, y: 1.8 },
    }),
  };
  expect(
    createTransformGuideModel(f.context, live, {
      property: 'scale',
      phase: 'active',
    }).fixedPoints,
  ).toEqual([f.context.pivot]);
});
it('reference commands share Scene undo order while keeping Project and animation data untouched', () => {
  const store = new EditorStore(createDefaultProject());
  const before = store.commands.getSnapshot();
  store.commitTransformReference({ pivotMode: 'bottom' });
  expect(store.commands.getSnapshot()).toBe(before);
  store.commitTransformReference({
    pivotMode: 'custom',
    customPivot: { x: 10, y: 20 },
  });
  expect(store.commands.undoStack).toHaveLength(2);
  store.undo();
  expect(store.getSnapshot().transformSettings.pivotMode).toBe('bottom');
  store.undo();
  expect(store.commands.getSnapshot()).toBe(before);
  store.redo();
  expect(store.getSnapshot().transformSettings.pivotMode).toBe('bottom');
});
it('workspace reference and Scene commands Undo/Redo in one chronological stack', () => {
  const store = new EditorStore(createDefaultProject());
  const before = store.getSnapshot().transformSettings;
  const c = activeComposition(store.commands.getSnapshot());
  store.commitTransformReference({ pivotMode: 'bottom' });
  const layer = createLayer('rectangle');
  store.run('创建图层', [
    command({ type: 'layer.create', compositionId: c.id, layer }),
  ]);
  const scene = store.commands.getSnapshot();
  store.commitTransformReference({ pivotMode: 'top-left' });
  store.undo();
  expect(store.commands.getSnapshot()).toBe(scene);
  expect(store.getSnapshot().transformSettings.pivotMode).toBe('bottom');
  store.undo();
  expect(activeComposition(store.commands.getSnapshot()).layers).toHaveLength(
    0,
  );
  store.undo();
  expect(store.getSnapshot().transformSettings).toEqual(before);
  store.redo();
  store.redo();
  store.redo();
  expect(activeComposition(store.commands.getSnapshot()).layers[0]!.id).toBe(
    layer.id,
  );
  expect(store.getSnapshot().transformSettings.pivotMode).toBe('top-left');
});
