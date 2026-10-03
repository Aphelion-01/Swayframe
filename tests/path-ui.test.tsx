// @vitest-environment jsdom
import { afterEach, beforeAll, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(cleanup);
it('路径和文字样式有可操作入口，修改经同一历史', () => {
  const store = new EditorStore(createDefaultProject());
  render(<App store={store} />);
  fireEvent.click(screen.getByText('动效 ▾'));
  fireEvent.click(screen.getByRole('button', { name: '创建 路径' }));
  const before = store.commands.getSnapshot();
  fireEvent.click(screen.getByRole('button', { name: '编辑贝塞尔路径' }));
  fireEvent.click(screen.getByRole('button', { name: '添加路径点' }));
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.editor!.properties
      .path!.baseValue as readonly number[],
  ).toHaveLength(30);
  store.undo();
  expect(store.commands.getSnapshot()).toEqual(before);
  fireEvent.click(screen.getByRole('button', { name: '关闭路径编辑器' }));
  fireEvent.click(screen.getByText('动效 ▾'));
  fireEvent.click(screen.getByRole('button', { name: '创建 文字' }));
  fireEvent.change(screen.getByLabelText('字距'), { target: { value: '12' } });
  fireEvent.blur(screen.getByLabelText('字距'));
  expect(
    activeComposition(store.getSnapshot().project).layers[1]!.editor!.properties
      .tracking!.baseValue,
  ).toBe(12);
});
