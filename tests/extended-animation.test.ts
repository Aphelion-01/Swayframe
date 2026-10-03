import { expect, it } from 'vitest';
import { evaluateProperty } from '../src/core/animation-engine';
import {
  createProperty,
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import { newId } from '../src/core/core-types';
import { EditorStore } from '../src/ui/editor-store';
import { command } from '../src/core/command-system';
it('Hold、同拓扑路径和不同拓扑路径有确定性时间边界', () => {
  const p = {
    ...createProperty<readonly number[]>([0, 0]),
    keyframes: [
      {
        id: newId(),
        time: 0,
        value: [0, 0],
        interpolation: { type: 'hold' as const },
      },
      {
        id: newId(),
        time: 1,
        value: [10, 20],
        interpolation: { type: 'linear' as const },
      },
    ],
  };
  expect(evaluateProperty(p, 0.99)).toEqual([0, 0]);
  expect(evaluateProperty(p, 1)).toEqual([10, 20]);
  const linear = {
    ...p,
    keyframes: p.keyframes.map((k) => ({
      ...k,
      interpolation: { type: 'linear' as const },
    })),
  };
  expect(evaluateProperty(linear, 0.5)).toEqual([5, 10]);
  expect(
    evaluateProperty(
      {
        ...linear,
        keyframes: [
          linear.keyframes[0]!,
          { ...linear.keyframes[1]!, value: [10, 20, 30] },
        ],
      },
      0.5,
    ),
  ).toEqual([0, 0]);
});
it('新增颜色属性支持导航、批量复制、删除和一次撤销', () => {
  const p = createDefaultProject(),
    store = new EditorStore(p),
    layer = createLayer('rectangle');
  store.run('图层', [
    command({
      type: 'layer.create',
      compositionId: p.activeCompositionId,
      layer,
    }),
  ]);
  store.select(layer.id);
  const prop = layer.editor!.properties.fill!;
  store.togglePropertyAnimation(prop.id);
  store.setTime(1);
  store.run('颜色', [store.valueCommand(prop.id, [1, 0, 0, 1])]);
  store.setTime(0.5);
  store.jumpFrame(1);
  expect(store.getSnapshot().time).toBe(1);
  const before = store.commands.getSnapshot();
  store.selectFrame({
    propertyId: prop.id,
    keyframeId:
      activeComposition(before).layers[0]!.editor!.properties.fill!
        .keyframes[0]!.id,
  });
  store.duplicateSelection();
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.editor!.properties
      .fill!.keyframes,
  ).toHaveLength(3);
  store.undo();
  expect(store.commands.getSnapshot()).toEqual(before);
});
