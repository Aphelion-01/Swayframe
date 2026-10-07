import { expect, it } from 'vitest';
import {
  snapTimeDelta,
  layerTimeDragDelta,
} from '../src/core/timeline-snapping';
it('关键帧批量移动保持间距、帧网格与合成边界，最近目标吸附可临时关闭', () => {
  expect(snapTimeDelta([1, 2], 10, 5, 30).delta).toBe(3);
  expect(snapTimeDelta([1, 2], -10, 5, 30).delta).toBe(-1);
  const snapped = snapTimeDelta([1, 2], 0.99, 5, 30, [3.05], 0.08);
  expect(snapped.delta).toBeCloseTo(32 / 30);
  expect(snapped.snapTime).toBe(92 / 30);
  expect(snapTimeDelta([1, 2], 0.99, 5, 30, [3.05], -1).delta).toBe(1);
  expect(snapTimeDelta([1, 2], 3, 5, 30, [5.1], 1).delta).toBe(3);
  expect(snapTimeDelta([], 2, 5, 30).delta).toBe(0);
});
it('图层时间条预览先夹到范围；移动保持时长，入出点不能翻转且至少一帧', () => {
  expect(layerTimeDragDelta(1, 3, 100, 'move', 5, 30)).toBe(2);
  expect(layerTimeDragDelta(1, 3, -100, 'move', 5, 30)).toBe(-1);
  expect(layerTimeDragDelta(1, 3, 100, 'start', 5, 30)).toBeCloseTo(2 - 1 / 30);
  expect(layerTimeDragDelta(1, 3, -100, 'end', 5, 30)).toBeCloseTo(-2 + 1 / 30);
});
