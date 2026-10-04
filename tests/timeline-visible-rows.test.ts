import { expect, it } from 'vitest';
import { createLayer } from '../src/core/project-model';
import { timelineVisibleRows } from '../src/ui/timeline-visible-rows';
it('条纹只根据真实可见行计数，折叠和筛选后连续排列', () => {
  const a = createLayer('rectangle'),
    b = createLayer('text');
  const indices = (rows: ReturnType<typeof timelineVisibleRows>) =>
    rows.flatMap((r) => [
      r.headerIndex,
      ...(r.groupIndex === undefined ? [] : [r.groupIndex]),
      ...r.properties.map((p) => p.rowIndex),
    ]);
  const rows = timelineVisibleRows([a, b], [a.id], {}, {}, 'all', []);
  expect(indices(rows)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(rows[0]!.open).toBe(false);
  expect(
    indices(timelineVisibleRows([a, b], [a.id], {}, {}, 'position', [])),
  ).toEqual([0, 1, 2, 3]);
  expect(
    indices(
      timelineVisibleRows([a, b], [a.id], {}, { [a.id]: false }, 'all', []),
    ),
  ).toEqual([0, 1, 2]);
  expect(indices(timelineVisibleRows([a, b], [], {}, {}, 'all', []))).toEqual([
    0, 1,
  ]);
});
