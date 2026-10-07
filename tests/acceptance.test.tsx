import { createObject } from './creation-test-helpers';
import { bridgeFor } from '../src/ui/agent-controller';
import { DEMO_PROMPT } from '../src/core/agent-contracts';
// @vitest-environment jsdom
import { openTimelineLayers } from './timeline-test-helpers';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import { loadProject } from '../src/core/project-io';
import { createRenderSnapshot } from '../src/core/renderer-core';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.getBoundingClientRect = () =>
    new DOMRect(0, 0, 960, 540);
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 64, height: 64, close: vi.fn() })),
  );
});
afterEach(cleanup);
const edit = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.blur(screen.getByLabelText(label));
};
const start = () => {
  const store = new EditorStore(createDefaultProject());
  render(<App store={store} />);
  openTimelineLayers();
  return store;
};

describe('A-01～A-09 用户流程集成验收', () => {
  it('A-01 / A-02 / A-05：新建合成、Canvas 拖动、属性面板 编辑和逐步 Undo/Redo', () => {
    const store = start();
    store.setAutoKeyframes(true);
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '新建合成' }));
    fireEvent.click(screen.getByRole('button', { name: '创建合成' }));
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 矩形');
    openTimelineLayers();
    expect(activeComposition(store.getSnapshot().project)).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 5,
    });
    const before = store.commands.getSnapshot();
    const count = store.commands.undoStack.length;
    const canvas = screen.getByTestId('canvas');
    fireEvent.pointerDown(canvas, { clientX: 480, clientY: 270, button: 0 });
    fireEvent.pointerMove(canvas, { clientX: 540, clientY: 300 });
    expect(store.commands.getSnapshot()).toBe(before);
    fireEvent.pointerUp(canvas);
    expect(store.commands.undoStack).toHaveLength(count + 1);
    expect(
      activeComposition(store.getSnapshot().project)?.layers[0]?.transform
        .position.keyframes[0]?.value,
    ).toEqual({ x: 1080, y: 600 });
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(store.commands.getSnapshot()).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: '重做' }));
    edit('缩放 X（%）', '120');
    edit('旋转（°）', '45');
    edit('透明度（%）', '80');
    const edited = store.commands.getSnapshot();
    for (let i = 0; i < 4; i++)
      fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(store.commands.getSnapshot()).toEqual(before);
    for (let i = 0; i < 4; i++)
      fireEvent.click(screen.getByRole('button', { name: '重做' }));
    expect(store.commands.getSnapshot()).toEqual(edited);
  });
  it('A-03 / A-04：手动 Spring 入场淡入，四类图层与文件在关闭重开后保持一致', async () => {
    const store = start();
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 矩形');
    openTimelineLayers();
    edit('位置 X', '-120');
    edit('透明度（%）', '0');
    fireEvent.click(
      screen.getByRole('button', { name: '添加 矩形 位置 关键帧' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: '添加 矩形 透明度 关键帧' }),
    );
    fireEvent.change(screen.getByLabelText('当前时间（秒）'), {
      target: { value: '1' },
    });
    edit('位置 X', '960');
    edit('透明度（%）', '100');
    fireEvent.change(screen.getByLabelText('当前时间（秒）'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText('插值 矩形 位置'), {
      target: { value: 'spring' },
    });
    const c = activeComposition(store.getSnapshot().project)!;
    expect(createRenderSnapshot(c, 0.5, []).layers[0]?.opacity).toBe(0.5);
    expect(createRenderSnapshot(c, 1, []).layers[0]?.position.x).toBe(960);
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 椭圆');
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 文字');
    const bytes = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
      ),
      (ch) => ch.charCodeAt(0),
    );
    fireEvent.change(screen.getByLabelText('导入图片文件'), {
      target: {
        files: [new File([bytes], 'pixel.png', { type: 'image/png' })],
      },
    });
    await waitFor(() =>
      expect(store.getSnapshot().project.assets).toHaveLength(1),
    );
    act(() => window.dispatchEvent(new Event('motion:show-project')));
    fireEvent.click(screen.getByRole('button', { name: '添加素材 pixel.png' }));
    await waitFor(() =>
      expect(store.getSnapshot().project.compositions[0]?.layers).toHaveLength(
        4,
      ),
    );
    const saved = store.save();
    const before = store.commands.getSnapshot();
    cleanup();
    const reopened = new EditorStore(loadProject(saved));
    render(<App store={reopened} />);
    openTimelineLayers();
    expect(reopened.commands.getSnapshot()).toEqual(before);
    expect(reopened.commands.undoStack).toHaveLength(0);
    expect(reopened.save()).toBe(saved);
  });
  it('A-06 / A-07：既有Agent Bridge仍保留一项历史、整体撤销、重做后可手改', () => {
    const store = start();
    const before = store.commands.getSnapshot();
    fireEvent.click(screen.getByRole('tab', { name: '助手' }));
    act(() => {
      const result = bridgeFor(store).runDemo(DEMO_PROMPT);
      if (!result.ok) throw new Error(result.error);
      store.select(result.layerId!);
      store.setTime(1);
    });
    expect(store.commands.undoStack).toHaveLength(1);
    expect(screen.getByLabelText('位置 X')).toHaveValue(960);
    const generated = store.commands.getSnapshot();
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(store.commands.getSnapshot()).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: '重做' }));
    expect(store.commands.getSnapshot()).toEqual(generated);
    fireEvent.click(screen.getByRole('tab', { name: '图层' }));
    fireEvent.click(screen.getByRole('button', { name: '选择 蓝色方块入场' }));
    edit('旋转（°）', '15');
    expect(
      store.commands.getSnapshot().compositions[0]?.layers[0]?.transform
        .rotation.baseValue,
    ).toBe(15);
  });
  it('A-08：Provider 输出建议时不修改工程；应用后可撤销', async () => {
    const store = start();
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 矩形');
    openTimelineLayers();
    edit('位置 X', '100');
    const before = store.commands.getSnapshot();
    fireEvent.click(screen.getByRole('tab', { name: '助手' }));
    fireEvent.click(screen.getByRole('button', { name: '布局建议' }));
    await screen.findByRole('button', { name: '应用建议' });
    expect(store.commands.getSnapshot()).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: '应用建议' }));
    expect(
      store.commands.getSnapshot().compositions[0]?.layers[0]?.transform
        .position.baseValue,
    ).toEqual({ x: 960, y: 540 });
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(store.commands.getSnapshot()).toEqual(before);
  });
  it('A-09：真实文件输入拒绝非法 JSON 和未知版本，当前工程不部分变化', async () => {
    const store = start();
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 矩形');
    openTimelineLayers();
    const before = store.commands.getSnapshot();
    const count = store.commands.undoStack.length;
    for (const [data, message] of [
      ['{broken', 'JSON 语法错误'],
      ['{"schemaVersion":"9.0.0"}', '不支持工程版本'],
    ]) {
      fireEvent.change(screen.getByLabelText('打开工程文件'), {
        target: {
          files: [new File([data!], 'bad.json', { type: 'application/json' })],
        },
      });
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(message!),
      );
      expect(store.commands.getSnapshot()).toBe(before);
      expect(store.commands.undoStack).toHaveLength(count);
    }
  });
});
