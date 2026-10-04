// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { Tabs, Modal } from '../src/ui/workspace/primitives';
import { Workspace } from '../src/ui/workspace/layout';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import { createDefaultProject } from '../src/core/project-model';
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
it('页签支持方向键/Home/End，只有选中页签进入Tab顺序', () => {
  function Example() {
    const [value, setValue] = useState('图层');
    return (
      <Tabs
        items={['项目', '图层', '助手']}
        value={value}
        onChange={setValue}
      />
    );
  }
  render(<Example />);
  const layer = screen.getByRole('tab', { name: '图层' });
  layer.focus();
  fireEvent.keyDown(layer, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: '助手' })).toHaveFocus();
  expect(screen.getByRole('tab', { name: '助手' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(layer).toHaveAttribute('tabindex', '-1');
  fireEvent.keyDown(document.activeElement!, { key: 'Home' });
  expect(screen.getByRole('tab', { name: '项目' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'End' });
  expect(screen.getByRole('tab', { name: '助手' })).toHaveFocus();
});
it('对话框限制Tab焦点，Escape关闭并返回入口；不改工程', () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>入口</button>
        {open && (
          <Modal onClose={() => setOpen(false)}>
            <section role="dialog" aria-label="测试">
              <input aria-label="值" />
              <button onClick={() => setOpen(false)}>完成</button>
            </section>
          </Modal>
        )}
      </>
    );
  }
  render(<Example />);
  const opener = screen.getByRole('button', { name: '入口' });
  opener.focus();
  fireEvent.click(opener);
  expect(screen.getByLabelText('值')).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: '完成' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
  expect(screen.getByLabelText('值')).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(opener).toHaveFocus();
});
it('同批移动/松手保存最新面板宽度，窗口缩小不让时间轴压掉画布', () => {
  localStorage.setItem(
    'motion.workspace.v1',
    JSON.stringify({ left: 220, right: 280, bottom: 550 }),
  );
  render(
    <Workspace
      left={<aside>左侧</aside>}
      center={<section>画布</section>}
      right={<aside>右侧</aside>}
      bottom={<section>时间轴</section>}
    />,
  );
  const divider = screen.getByRole('separator', { name: '调整左面板大小' });
  fireEvent.pointerDown(divider, { button: 0, clientX: 220 });
  act(() => {
    fireEvent.pointerMove(divider, { clientX: 300 });
    fireEvent.pointerUp(divider);
  });
  expect(JSON.parse(localStorage.getItem('motion.workspace.v1')!).left).toBe(
    300,
  );
  const shell = document.querySelector('.workspace-shell') as HTMLElement;
  expect(
    parseInt(shell.style.getPropertyValue('--timeline-height')),
  ).toBeLessThanOrEqual(window.innerHeight - 320);
});
it('助手入口显示已折叠左面板，选区和Scene保持，面板尺寸只改变UI', () => {
  localStorage.setItem('motion.collapsed', JSON.stringify({ left: true }));
  const store = new EditorStore(createDefaultProject()),
    project = store.getSnapshot().project;
  render(<App store={store} />);
  fireEvent.click(screen.getByRole('button', { name: '创作助手' }));
  expect(screen.getByRole('tab', { name: '助手' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByRole('textbox', { name: 'Agent 需求' })).toBeVisible();
  expect(store.getSnapshot().project).toBe(project);
  expect(store.commands.undoStack).toHaveLength(0);
});
it('切换工作区保留助手草稿和待审建议，生成建议不修改Scene', async () => {
  const store = new EditorStore(createDefaultProject());
  render(<App store={store} />);
  fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
  fireEvent.click(screen.getByRole('button', { name: '创建 矩形' }));
  const before = store.getSnapshot().project;
  fireEvent.click(screen.getByRole('tab', { name: '助手' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Agent 需求' }), {
    target: { value: '保留的提示词' },
  });
  fireEvent.click(screen.getByRole('button', { name: '布局建议' }));
  await screen.findByRole('button', { name: '应用建议' });
  fireEvent.click(screen.getByRole('tab', { name: '图层' }));
  fireEvent.click(screen.getByRole('tab', { name: '助手' }));
  expect(screen.getByRole('textbox', { name: 'Agent 需求' })).toHaveValue(
    '保留的提示词',
  );
  expect(screen.getByRole('button', { name: '应用建议' })).toBeVisible();
  expect(store.getSnapshot().project).toBe(before);
});
