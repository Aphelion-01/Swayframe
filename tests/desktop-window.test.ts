import { it, expect } from 'vitest';
import { visibleWindow } from '../apps/desktop/electron/window-state';
import { primaryModifier } from '../src/desktop/platform';
it('moves restored windows on removed monitors back into visible work area', () => {
  const screen = { x: 0, y: 0, width: 1440, height: 900 };
  const state = visibleWindow(
    { x: 5000, y: -900, width: 1200, height: 800, maximized: true },
    [screen],
  );
  expect(state.x).toBeGreaterThanOrEqual(0);
  expect(state.y).toBeGreaterThanOrEqual(0);
  expect(state.x + state.width).toBeLessThanOrEqual(1440);
  expect(state.maximized).toBe(true);
});
it('supports negative monitor coordinates and rejects nonfinite bounds', () => {
  const screens = [
    { x: -1920, y: 0, width: 1920, height: 1080 },
    { x: 0, y: 0, width: 1440, height: 900 },
  ];
  expect(
    visibleWindow({ x: -1800, y: 50, width: 1000, height: 800 }, screens).x,
  ).toBe(-1800);
  expect(
    Number.isFinite(visibleWindow({ x: NaN, width: Infinity }, screens).x),
  ).toBe(true);
});
it('maps primary modifiers centrally', () => {
  expect(primaryModifier('darwin')).toBe('Meta');
  expect(primaryModifier('win32')).toBe('Control');
});
