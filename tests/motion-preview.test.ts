import { expect, it } from 'vitest';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import { command } from '../src/core/command-system';
import { newId } from '../src/core/core-types';
import { previewMotionCurve } from '../src/core/motion-curve-commands';
import { motionSegments } from '../src/core/motion-curve';
import { evaluateProperty } from '../src/core/animation-engine';
it('拖动预览影响真实渲染输入，未提交不写工程/历史，保留无关图层引用', () => {
  const store = new EditorStore(createDefaultProject()),
    layer = createLayer('rectangle'),
    other = createLayer('ellipse');
  store.run('准备', [
    ...[layer, other].map((l) =>
      command({
        type: 'layer.create',
        compositionId: store.getSnapshot().project.activeCompositionId,
        layer: l,
      }),
    ),
    ...[0, 1].map((t) =>
      command({
        type: 'keyframe.add',
        propertyId: layer.transform.position.id,
        keyframe: {
          id: newId(),
          time: t,
          value: { x: t * 100, y: 0 },
          interpolation: { type: 'linear' },
        },
      }),
    ),
  ]);
  const before = store.getSnapshot().project,
    history = store.commands.undoStack.length,
    prop = activeComposition(before).layers[0]!.transform.position;
  store.setPropertyPreviews(
    previewMotionCurve(before, [motionSegments(prop)[0]!.id], {
      type: 'cubic-bezier',
      x1: 0,
      y1: 0,
      x2: 0.58,
      y2: 1,
    }),
  );
  expect(
    evaluateProperty(
      activeComposition(store.getRenderProject()).layers[0]!.transform.position,
      0.5,
    ).x,
  ).toBeGreaterThan(50);
  expect(store.getRenderProject()).toBe(store.getRenderProject());
  expect(activeComposition(store.getRenderProject()).layers[1]).toBe(
    activeComposition(before).layers[1],
  );
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack.length).toBe(history);
  store.setPropertyPreviews(undefined);
  expect(store.getRenderProject()).toBe(before);
});
