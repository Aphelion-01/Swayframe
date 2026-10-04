// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { EditorStore } from '../src/ui/editor-store';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { command } from '../src/core/command-system';
import { useEditorSlice } from '../src/ui/use-editor-slice';
afterEach(cleanup);
it('只显示工程和选择的面板不响应播放头/预览/状态，Scene和选区更新仍同步', () => {
  const store = new EditorStore(createDefaultProject());
  let renders = 0;
  function Subject() {
    const view = useEditorSlice(store, ['project', 'selection']);
    renders++;
    return (
      <span>
        {view.project.compositions[0]!.layers.length}:{view.selection.length}
      </span>
    );
  }
  render(<Subject />);
  for (let i = 0; i < 50; i++)
    act(() => {
      store.setTime(i / 30);
      store.setStatus(String(i));
      store.selectFrames([]);
    });
  expect(renders).toBe(1);
  const layer = createLayer('rectangle');
  act(() =>
    store.run('新增', [
      command({
        type: 'layer.create',
        compositionId: store.getSnapshot().project.activeCompositionId,
        layer,
      }),
    ]),
  );
  expect(screen.getByText('1:0')).toBeTruthy();
  act(() => store.select(layer.id));
  expect(screen.getByText('1:1')).toBeTruthy();
  act(() => store.undo());
  expect(screen.getByText('0:0')).toBeTruthy();
});
