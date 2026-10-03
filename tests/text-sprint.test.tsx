// @vitest-environment jsdom
import { expect, it, vi, beforeAll, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import { saveProject, loadProject } from '../src/core/project-io';
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function setup() {
  const p = createDefaultProject(),
    layer = createLayer('text', {
      position: { x: 400, y: 200 },
      width: 400,
      height: 100,
    });
  const store = new EditorStore({
    ...p,
    compositions: p.compositions.map((c) => ({ ...c, layers: [layer] })),
  });
  render(<App store={store} />);
  const canvas = screen.getByTestId('canvas');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1920,
    bottom: 1080,
    width: 1920,
    height: 1080,
    toJSON: () => ({}),
  });
  fireEvent.doubleClick(canvas, { clientX: 400, clientY: 200 });
  return { store, editor: screen.getByLabelText('画布文字编辑') };
}
it('双击直接聚焦多行文字；输入隔离快捷键，提交一次 Undo、保存加载完整保留换行', () => {
  const { store, editor } = setup();
  expect(editor).toHaveFocus();
  expect(editor.tagName).toBe('TEXTAREA');
  const before = store.getSnapshot().project;
  fireEvent.change(editor, { target: { value: '第一行\n第二行' } });
  fireEvent.keyDown(editor, { key: 'Delete' });
  fireEvent.keyDown(editor, { key: 'd', ctrlKey: true });
  fireEvent.keyDown(editor, { key: 'Enter' });
  expect(store.getSnapshot().project).toBe(before);
  fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true });
  const project = store.getSnapshot().project;
  expect(activeComposition(project).layers).toHaveLength(1);
  expect(activeComposition(project).layers[0]).toMatchObject({
    text: '第一行\n第二行',
  });
  expect(store.commands.undoStack).toHaveLength(1);
  expect(loadProject(saveProject(project))).toEqual(project);
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it('中文选字阶段 Enter/Escape 不提交或退出；结束输入后 Escape 丢弃草稿无历史', () => {
  const { store, editor } = setup();
  const before = store.getSnapshot().project;
  fireEvent.change(editor, { target: { value: '输入中的草稿' } });
  fireEvent.keyDown(editor, { key: 'Enter', isComposing: true });
  fireEvent.keyDown(editor, { key: 'Escape', isComposing: true });
  expect(screen.getByLabelText('画布文字编辑')).toBeInTheDocument();
  expect(store.getSnapshot().project).toBe(before);
  fireEvent.keyDown(editor, { key: 'Escape' });
  expect(screen.queryByLabelText('画布文字编辑')).toBeNull();
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(0);
});
