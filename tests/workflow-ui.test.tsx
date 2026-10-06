// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function menu() {
  fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
}
function edit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
}
it('正常菜单新建工程清空旧数据和历史，命名合成自动激活，创建对象同步Selection', () => {
  const layer = createLayer('rectangle'),
    p = createDefaultProject(),
    store = new EditorStore({
      ...p,
      compositions: p.compositions.map((c) => ({ ...c, layers: [layer] })),
    });
  store.select(layer.id);
  store.nudge(20, 0);
  store.setTime(2);
  store.setPlaying(true);
  render(<App store={store} />);
  menu();
  fireEvent.click(screen.getByRole('button', { name: '新建工程' }));
  fireEvent.click(screen.getByRole('button', { name: '创建空白工程' }));
  expect(activeComposition(store.getSnapshot().project).layers).toHaveLength(0);
  expect(store.getSnapshot()).toMatchObject({
    selection: [],
    frames: [],
    time: 0,
    playing: false,
  });
  expect(store.commands.undoStack).toHaveLength(0);
  menu();
  fireEvent.click(screen.getByRole('button', { name: '新建合成' }));
  fireEvent.change(screen.getByLabelText('合成名称'), {
    target: { value: 'Logo A' },
  });
  fireEvent.click(screen.getByRole('button', { name: '创建合成' }));
  expect(activeComposition(store.getSnapshot().project)).toMatchObject({
    name: 'Logo A',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
  });
  menu();
  fireEvent.click(screen.getByRole('button', { name: '创建 椭圆' }));
  const created = activeComposition(store.getSnapshot().project).layers[0]!;
  expect(store.getSnapshot().selection).toEqual([created.id]);
  expect(screen.getByLabelText('图层名称')).toHaveValue('椭圆');
  expect(
    screen.getByRole('group', { name: '椭圆 缩放 轨道' }),
  ).toBeInTheDocument();
});
it('BENCH-A Inspector数值实际完成0→115→100；Scene、Timeline与Undo一致', () => {
  const store = new EditorStore(createDefaultProject());
  render(<App store={store} />);
  menu();
  fireEvent.click(screen.getByRole('button', { name: '创建 椭圆' }));
  edit('缩放 X（%）', '0');
  fireEvent.click(screen.getByRole('button', { name: '开启缩放动画' }));
  edit('当前时间（秒）', '0.5');
  edit('缩放 X（%）', '115');
  edit('当前时间（秒）', '1');
  edit('缩放 X（%）', '100');
  const after = store.getSnapshot().project,
    p = activeComposition(after).layers[0]!.transform.scale;
  expect(p.keyframes.map((k) => k.value)).toEqual([
    { x: 0, y: 0 },
    { x: 1.15, y: 1.15 },
    { x: 1, y: 1 },
  ]);
  expect(
    screen.getByRole('button', { name: '关键帧 椭圆 缩放 0.500 秒' }),
  ).toBeInTheDocument();
  act(() => store.undo());
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.transform.scale
      .keyframes,
  ).toHaveLength(2);
  act(() => store.redo());
  expect(store.getSnapshot().project).toEqual(after);
});
