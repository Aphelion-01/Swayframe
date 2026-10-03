import { expect, it } from 'vitest';
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import {
  parentCommands,
  precomposeCommands,
  splitLayerCommands,
  moveLayerInTime,
} from '../src/core/composition-editing';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { saveProject, loadProject } from '../src/core/project-io';
it('Null 继承旋转/缩放，设置父级保留当前位置，循环被拒绝', () => {
  const p = createDefaultProject(),
    parent = createLayer('null', { position: { x: 0, y: 0 } }),
    child = createLayer('rectangle', { position: { x: 100, y: 0 } }),
    system = new CommandSystem(p);
  system.executeTransaction(
    transaction(
      '创建',
      'human',
      [parent, child].map((layer) =>
        command({
          type: 'layer.create',
          compositionId: p.activeCompositionId,
          layer,
        }),
      ),
    ),
  );
  expect(
    system.executeTransaction(
      transaction(
        '父级',
        'human',
        parentCommands(system.getSnapshot(), child.id, parent.id, 0),
      ),
    ).ok,
  ).toBe(true);
  const composition = () => activeComposition(system.getSnapshot());
  expect(createRenderSnapshot(composition(), 0, []).layers[1]!.position.x).toBe(
    100,
  );
  system.executeTransaction(
    transaction('旋转', 'human', [
      command({
        type: 'property.setBase',
        propertyId: parent.transform.rotation.id,
        value: 90,
      }),
    ]),
  );
  const point = createRenderSnapshot(composition(), 0, []).layers[1]!.position;
  expect(point.x).toBeCloseTo(0);
  expect(point.y).toBeCloseTo(100);
  const before = system.getSnapshot();
  expect(
    system.executeTransaction(
      transaction(
        '循环',
        'human',
        parentCommands(before, parent.id, child.id, 0),
      ),
    ).ok,
  ).toBe(false);
  expect(system.getSnapshot()).toBe(before);
});
it('预合成保持实体和动画，嵌套保存，拆分与移动时间可整体撤销', () => {
  const p = createDefaultProject(),
    a = createLayer('rectangle'),
    b = createLayer('text'),
    system = new CommandSystem(p);
  system.executeTransaction(
    transaction(
      '创建',
      'human',
      [a, b].map((layer) =>
        command({
          type: 'layer.create',
          compositionId: p.activeCompositionId,
          layer,
        }),
      ),
    ),
  );
  const before = system.getSnapshot(),
    pre = precomposeCommands(before, [a.id, b.id]);
  expect(
    system.executeTransaction(transaction('预合成', 'human', pre.commands)).ok,
  ).toBe(true);
  const grouped = system.getSnapshot();
  expect(grouped.compositions).toHaveLength(2);
  expect(activeComposition(grouped).layers[0]!.type).toBe('precomp');
  expect(grouped.compositions[1]!.layers.map((l) => l.id)).toEqual([
    a.id,
    b.id,
  ]);
  expect(loadProject(saveProject(grouped))).toEqual(grouped);
  system.undo();
  expect(system.getSnapshot()).toEqual(before);
  system.redo();
  expect(system.getSnapshot()).toEqual(grouped);
  system.undo();
  expect(
    system.executeTransaction(
      transaction(
        '拆分',
        'human',
        splitLayerCommands(system.getSnapshot(), a.id, 2),
      ),
    ).ok,
  ).toBe(true);
  const split = activeComposition(system.getSnapshot());
  expect(split.layers[0]!.editor!.outPoint).toBe(2);
  expect(split.layers[1]!.editor!.inPoint).toBe(2);
  expect(createRenderSnapshot(split, 3, []).layers[0]!.active).toBe(false);
  system.undo();
  expect(system.getSnapshot()).toEqual(before);
  const trimmed = { ...a, editor: { ...a.editor!, inPoint: 0, outPoint: 2 } };
  system.executeTransaction(
    transaction('剪裁', 'human', [
      command({
        type: 'layer.replace',
        compositionId: p.activeCompositionId,
        layer: trimmed,
      }),
    ]),
  );
  expect(
    system.executeTransaction(
      transaction(
        '移动时间',
        'human',
        moveLayerInTime(system.getSnapshot(), trimmed, 1),
      ),
    ).ok,
  ).toBe(true);
  expect(
    activeComposition(system.getSnapshot()).layers[0]!.editor!.startTime,
  ).toBe(1);
});
