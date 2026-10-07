// @vitest-environment jsdom
import { openTimelineLayers } from './timeline-test-helpers';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import { evaluateProperty } from '../src/core/animation-engine';
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(cleanup);
it('曲线面板缓出与速度输入真实修改动画，撤销恢复', () => {
  const store = new EditorStore(createDefaultProject());
  render(<App store={store} />);
  openTimelineLayers();
  fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
  fireEvent.click(screen.getByRole('button', { name: '创建 矩形' }));
  openTimelineLayers();
  fireEvent.click(screen.getByRole('button', { name: '开启 矩形 位置 动画' }));
  store.setTime(1);
  const prop = activeComposition(store.getSnapshot().project).layers[0]!
    .transform.position;
  store.run('位置', [store.valueCommand(prop.id, { x: 1260, y: 540 })]);
  const before = store.commands.getSnapshot();
  fireEvent.click(screen.getByRole('tab', { name: '曲线编辑器' }));
  for (const line of screen
    .getByRole('img', { name: '动画值曲线' })
    .querySelectorAll('line'))
    expect(line).toHaveAttribute('pointer-events', 'none');
  fireEvent.click(screen.getByRole('button', { name: '缓出' }));
  const p = activeComposition(store.getSnapshot().project).layers[0]!.transform
    .position;
  expect(evaluateProperty(p, 0.5).x).toBeGreaterThan(1110);
  fireEvent.change(screen.getByLabelText('曲线模式'), {
    target: { value: 'speed' },
  });
  expect(screen.getByRole('img', { name: '动画速度曲线' })).toBeInTheDocument();
  const input = screen.getByLabelText('出影响比例（%）');
  fireEvent.change(input, { target: { value: '40' } });
  fireEvent.blur(input);
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.transform.position
      .keyframes[0]!.outgoing?.x,
  ).toBeCloseTo(0.4);
  store.undo();
  store.undo();
  expect(store.commands.getSnapshot()).toEqual(before);
});
