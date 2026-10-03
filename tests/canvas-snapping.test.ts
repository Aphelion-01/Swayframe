import { expect, it } from 'vitest';
import {
  canvasSnapContext,
  snapCanvasDelta,
} from '../src/core/canvas-snapping';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { createRenderSnapshot } from '../src/core/renderer-core';

it('最近的边缘/中心吸附，屏幕容差由调用方换算；Shift 只锁定主轴', () => {
  const p = createDefaultProject(),
    c = p.compositions[0]!,
    layer = createLayer('rectangle', {
      position: { x: 400, y: 200 },
      width: 100,
      height: 100,
    });
  const context = canvasSnapContext(
    createRenderSnapshot(
      { ...c, width: 960, height: 540, layers: [layer] },
      0,
      [],
    ),
    [layer.id],
  );
  expect(snapCanvasDelta(context, { x: 76, y: 68 }, 6)).toEqual({
    delta: { x: 80, y: 70 },
    guides: [
      { axis: 'x', value: 480 },
      { axis: 'y', value: 270 },
    ],
  });
  expect(snapCanvasDelta(context, { x: 70, y: 60 }, 6).guides).toEqual([]);
  expect(snapCanvasDelta(context, { x: 76, y: 68 }, -1).delta).toEqual({
    x: 76,
    y: 68,
  });
  expect(snapCanvasDelta(context, { x: 76, y: 68 }, 6, 'x').delta).toEqual({
    x: 80,
    y: 0,
  });
});
it('旋转后的世界包围框、多选整体边界，排除随选中父级移动的子层和不可见层', () => {
  const c = createDefaultProject().compositions[0]!,
    parent = createLayer('rectangle', {
      position: { x: 400, y: 200 },
      width: 200,
      height: 100,
    }),
    child = createLayer('rectangle', {
      position: { x: 10, y: 0 },
      width: 20,
      height: 20,
    }),
    hidden = createLayer('rectangle', {
      position: { x: 700, y: 400 },
      width: 20,
      height: 20,
    });
  const rotated = {
    ...parent,
    transform: {
      ...parent.transform,
      rotation: { ...parent.transform.rotation, baseValue: 90 },
    },
  };
  const nested = {
    ...child,
    editor: { ...child.editor!, parentId: parent.id },
  };
  const context = canvasSnapContext(
    createRenderSnapshot(
      { ...c, layers: [rotated, nested, { ...hidden, visible: false }] },
      0,
      [],
    ),
    [parent.id],
  );
  expect(context.moving.x[0]).toBeCloseTo(350);
  expect(context.moving.x[2]).toBeCloseTo(450);
  expect(context.targets.x).toEqual([0, c.width / 2, c.width]);
  const multi = canvasSnapContext(
    createRenderSnapshot({ ...c, layers: [parent, hidden] }, 0, []),
    [parent.id, hidden.id],
  );
  expect(multi.moving.x).toEqual([300, 505, 710]);
});
