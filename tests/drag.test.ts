import { describe, expect, it } from 'vitest';
import { EditorStore } from '../src/ui/editor-store';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { command } from '../src/core/command-system';

describe('Canvas drag controller', () => {
  it('连续拖动只有临时预览，松手一个 Transaction，一次 Undo 恢复', () => {
    const p = createDefaultProject();
    const layer = createLayer('rectangle');
    const store = new EditorStore(p);
    store.run('Create', [
      command({
        type: 'layer.create',
        compositionId: p.activeCompositionId,
        layer,
      }),
    ]);
    const before = store.commands.getSnapshot();
    const count = store.commands.undoStack.length;
    store.beginDrag(layer.id, { x: 960, y: 540 });
    for (let i = 0; i < 100; i++) store.moveDrag({ x: 960 + i, y: 600 });
    expect(store.commands.getSnapshot()).toBe(before);
    expect(store.commands.undoStack).toHaveLength(count);
    store.endDrag();
    expect(store.commands.undoStack).toHaveLength(count + 1);
    expect(
      store.getSnapshot().project.compositions[0]?.layers[0]?.transform.position
        .keyframes[0]?.value,
    ).toEqual({ x: 1059, y: 600 });
    store.undo();
    expect(store.commands.getSnapshot()).toEqual(before);
  });
  it('取消或原地松手不增加历史；锁定图层不拖动', () => {
    const p = createDefaultProject();
    const layer = createLayer('rectangle');
    const store = new EditorStore(p);
    store.run('Create', [
      command({
        type: 'layer.create',
        compositionId: p.activeCompositionId,
        layer,
      }),
    ]);
    const count = store.commands.undoStack.length;
    store.beginDrag(layer.id, { x: 0, y: 0 });
    store.moveDrag({ x: 50, y: 50 });
    store.cancelDrag();
    store.beginDrag(layer.id, { x: 0, y: 0 });
    store.endDrag();
    expect(store.commands.undoStack).toHaveLength(count);
  });
});
