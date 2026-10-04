import { layerEffects } from '../src/core/compositing-migration';
// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
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
it('GUI 遮罩、羽化动画与效果排序均进入共享命令历史', () => {
  const store = new EditorStore(createDefaultProject());
  render(<App store={store} />);
  fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
  fireEvent.click(screen.getByRole('button', { name: '创建 矩形' }));
  fireEvent.click(screen.getByText('效果与遮罩'));
  fireEvent.click(screen.getByRole('button', { name: '添加椭圆遮罩' }));
  fireEvent.click(screen.getByRole('button', { name: '开启遮罩1羽化动画' }));
  act(() => store.setTime(1));
  fireEvent.change(screen.getByLabelText('遮罩1羽化'), {
    target: { value: '12' },
  });
  fireEvent.blur(screen.getByLabelText('遮罩1羽化'));
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.editor!.masks[0]!
      .feather.keyframes,
  ).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: '添加效果' }));
  fireEvent.change(screen.getByLabelText('添加效果类型'), {
    target: { value: 'gaussianBlur' },
  });
  fireEvent.click(screen.getByRole('button', { name: '添加效果' }));
  const before = store.commands.getSnapshot();
  fireEvent.click(screen.getByRole('button', { name: '上移效果2' }));
  expect(
    layerEffects(activeComposition(store.getSnapshot().project).layers[0]!)[0]!
      .kind,
  ).toBe('gaussianBlur');
  store.undo();
  expect(store.commands.getSnapshot()).toEqual(before);
});
