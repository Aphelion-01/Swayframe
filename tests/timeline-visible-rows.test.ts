import { expect, it } from 'vitest';
import { createLayer } from '../src/core/project-model';
import { timelineVisibleRows } from '../src/ui/timeline-visible-rows';
it('collapsed defaults and groups use continuous visible row indices after filtering', () => {
  const a = createLayer('rectangle'),
    b = createLayer('text');
  const indices = (rows: ReturnType<typeof timelineVisibleRows>) =>
    rows.flatMap((r) => [
      r.headerIndex,
      ...r.propertyGroups.flatMap((g) => [
        g.rowIndex,
        ...g.properties.map((p) => p.rowIndex),
      ]),
    ]);
  expect(
    indices(timelineVisibleRows([a, b], [a.id], {}, {}, 'all', [])),
  ).toEqual([0, 1]);
  const rows = timelineVisibleRows(
    [a, b],
    [a.id],
    { [a.id]: true },
    {},
    'all',
    [],
  );
  expect(rows[0]!.open).toBe(false);
  expect(rows[1]!.propertyGroups.map((g) => g.label)).toEqual([
    '变换',
    '外观 / 图形',
  ]);
  const visible = indices(rows);
  expect(visible).toEqual(Array.from({ length: visible.length }, (_, i) => i));
  const filtered = timelineVisibleRows([a, b], [], {}, {}, 'position', []);
  expect(filtered.flatMap((r) => r.properties)).toHaveLength(2);
  expect(indices(filtered)).toEqual([0, 1, 2, 3, 4, 5]);
  const collapsed = timelineVisibleRows(
    [a, b],
    [],
    { [a.id]: true },
    { [`${a.id}:transform`]: false },
    'all',
    [],
  );
  expect(collapsed[1]!.propertyGroups[0]!.properties).toHaveLength(0);
});
