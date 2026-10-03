import { expect, it, vi, afterEach } from 'vitest';
import {
  regularPath,
  pathSvg,
  movePathPoint,
  addPathPoint,
  removePathPoint,
} from '../src/core/shape-geometry';
import { drawContent } from '../src/renderers/draw-content';
import { createLayer } from '../src/core/project-model';
afterEach(() => vi.unstubAllGlobals());
it('多边形、星形、路径编辑保留切线；点操作可组合', () => {
  const p = regularPath(5, 200, 200);
  expect(p).toHaveLength(30);
  expect(regularPath(5, 200, 200, 0.4)).toHaveLength(60);
  const m = movePathPoint(p, 0, { x: 10, y: 20 });
  expect(m.slice(0, 6)).toEqual([10, 20, 10, 20, 10, 20]);
  expect(pathSvg(m, true)).toContain(' C ');
  expect(pathSvg(m, true).endsWith(' Z')).toBe(true);
  expect(pathSvg(m, false).endsWith(' Z')).toBe(false);
  expect(removePathPoint(addPathPoint(m, { x: 5, y: 6 }), 5)).toEqual(m);
});
it('文字 tracking、weight、lineHeight 与可动画颜色用于实际画字', () => {
  const base = createLayer('text');
  if (base.type !== 'text') throw new Error();
  const layer = {
    ...base,
    text: 'AB\nC',
    editor: {
      ...base.editor!,
      textAlign: 'center' as const,
      properties: {
        ...base.editor!.properties,
        tracking: { ...base.editor!.properties.tracking!, baseValue: 10 },
        fontWeight: { ...base.editor!.properties.fontWeight!, baseValue: 700 },
        fontSize: { ...base.editor!.properties.fontSize!, baseValue: 40 },
        fill: { ...base.editor!.properties.fill!, baseValue: [1, 0, 0, 1] },
      },
    },
  };
  const fillText = vi.fn(),
    ctx = {
      fillText,
      measureText: () => ({ width: 20 }),
    } as unknown as CanvasRenderingContext2D;
  drawContent(ctx, layer, 0);
  expect(ctx.fillStyle).toBe('rgba(255,0,0,1)');
  expect(ctx.font).toBe('700 40px sans-serif');
  expect(fillText.mock.calls).toEqual([
    ['A', -25, -24],
    ['B', 5, -24],
    ['C', -10, 24],
  ]);
});
