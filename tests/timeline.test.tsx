import { createObject } from './creation-test-helpers';
// @vitest-environment jsdom
import { openTimelineLayers } from './timeline-test-helpers';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import { createDefaultProject, transformKeys } from '../src/core/project-model';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { advancePlayback } from '../src/ui/playback';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(cleanup);
describe('时间轴 integration', () => {
  it('四个 Transform 可创建关键帧；Spring 和删除操作可撤销', () => {
    const store = new EditorStore(createDefaultProject());
    render(<App store={store} />);
    openTimelineLayers();
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 矩形');
    openTimelineLayers();
    for (const key of transformKeys)
      fireEvent.click(
        screen.getByRole('button', {
          name: `添加 矩形 ${{ position: '位置', scale: '缩放', rotation: '旋转', opacity: '透明度' }[key]} 关键帧`,
        }),
      );
    fireEvent.change(screen.getByLabelText('当前时间（秒）'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('位置 X'), {
      target: { value: '1200' },
    });
    fireEvent.blur(screen.getByLabelText('位置 X'));
    const layer = store.getSnapshot().project.compositions[0]?.layers[0];
    expect(layer?.transform.position.keyframes).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('当前时间（秒）'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText('插值 矩形 位置'), {
      target: { value: 'spring' },
    });
    expect(
      store.getSnapshot().project.compositions[0]?.layers[0]?.transform.position
        .keyframes[0]?.interpolation.type,
    ).toBe('spring');
    const before = store.commands.getSnapshot();
    fireEvent.click(
      screen.getByRole('button', { name: '删除 矩形 位置 关键帧' }),
    );
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(store.commands.getSnapshot()).toEqual(before);
  });
  it('Position 与 Opacity 在相同时间由统一引擎求值', () => {
    const store = new EditorStore(createDefaultProject());
    render(<App store={store} />);
    openTimelineLayers();
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 矩形');
    openTimelineLayers();
    for (const [label, value] of [
      ['位置 X', '-120'],
      ['透明度（%）', '0'],
    ]) {
      fireEvent.change(screen.getByLabelText(label!), { target: { value } });
      fireEvent.blur(screen.getByLabelText(label!));
    }
    fireEvent.click(
      screen.getByRole('button', { name: '添加 矩形 位置 关键帧' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: '添加 矩形 透明度 关键帧' }),
    );
    fireEvent.change(screen.getByLabelText('当前时间（秒）'), {
      target: { value: '1' },
    });
    for (const [label, value] of [
      ['位置 X', '960'],
      ['透明度（%）', '100'],
    ]) {
      fireEvent.change(screen.getByLabelText(label!), { target: { value } });
      fireEvent.blur(screen.getByLabelText(label!));
    }
    const c = store.getSnapshot().project.compositions[0]!;
    const mid = createRenderSnapshot(c, 0.5, []).layers[0];
    expect(mid?.position.x).toBe(420);
    expect(mid?.opacity).toBe(0.5);
  });
  it('播放时钟按秒循环，帧率不影响求值', () => {
    expect(advancePlayback(4.9, 0.2, 5)).toBeCloseTo(0.1);
    expect(advancePlayback(0, 1 / 30, 5)).toBeCloseTo(1 / 30);
    expect(advancePlayback(1, 0, 5)).toBe(1);
  });
});
