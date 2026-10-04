// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import {
  activeComposition,
  createDefaultProject,
} from '../src/core/project-model';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(cleanup);
it('动画开关、属性筛选、图层快捷键和输入焦点隔离在真实 UI 中协同工作', () => {
  const store = new EditorStore(createDefaultProject());
  render(<App store={store} />);
  fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
  fireEvent.click(screen.getByRole('button', { name: '创建 矩形' }));
  fireEvent.click(screen.getByRole('button', { name: '开启 矩形 位置 动画' }));
  expect(
    screen
      .getByRole('button', { name: '关键帧 矩形 位置 0.000 秒' })
      .querySelector('.diamond-shape'),
  ).not.toBeNull();
  fireEvent.change(screen.getByLabelText('当前时间（秒）'), {
    target: { value: '1' },
  });
  fireEvent.change(screen.getByLabelText('位置 X'), {
    target: { value: '1200' },
  });
  fireEvent.blur(screen.getByLabelText('位置 X'));
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.transform.position
      .keyframes,
  ).toHaveLength(2);
  fireEvent.keyDown(window, { key: 'u' });
  expect(screen.queryByRole('group', { name: '矩形 缩放 轨道' })).toBeNull();
  fireEvent.change(screen.getByLabelText('时间轴属性筛选'), {
    target: { value: 'all' },
  });
  fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
  expect(activeComposition(store.getSnapshot().project).layers).toHaveLength(2);
  const name = screen.getByLabelText('图层名称');
  name.focus();
  fireEvent.keyDown(name, { key: 'Delete' });
  expect(activeComposition(store.getSnapshot().project).layers).toHaveLength(2);
  name.blur();
  fireEvent.keyDown(window, { key: 'Delete' });
  expect(activeComposition(store.getSnapshot().project).layers).toHaveLength(1);
  store.undo();
  expect(activeComposition(store.getSnapshot().project).layers).toHaveLength(2);
});
