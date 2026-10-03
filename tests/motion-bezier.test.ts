import { expect, it } from 'vitest';
import {
  cubicBezier,
  invertBezierX,
  bezierCoordinate,
} from '../src/core/cubic-bezier';
it('真正反解非对称 X，而不是直接 By(u)，支持退化导数', () => {
  for (const [a, b] of [
    [0.91, 0.12],
    [0, 0],
    [1, 1],
    [1, 0],
  ]) {
    for (const u of [1e-6, 0.03, 0.2, 0.5, 0.87, 0.999999])
      expect(bezierCoordinate(a!, b!, invertBezierX(a!, b!, u))).toBeCloseTo(
        u,
        9,
      );
  }
  expect(
    cubicBezier({ x1: 0.91, y1: 0, x2: 0.12, y2: 1 })(0.3),
  ).not.toBeCloseTo(bezierCoordinate(0, 1, 0.3), 2);
});
it('Linear、缓入、缓出与对称缓入缓出端点正确', () => {
  const make = (x1: number, y1: number, x2: number, y2: number) =>
    cubicBezier({ x1, y1, x2, y2 });
  expect(make(0, 0, 1, 1)(0.27)).toBeCloseTo(0.27, 10);
  expect(make(0.42, 0, 1, 1)(0.5)).toBeLessThan(0.5);
  expect(make(0, 0, 0.58, 1)(0.5)).toBeGreaterThan(0.5);
  expect(make(0.42, 0, 0.58, 1)(0.5)).toBeCloseTo(0.5);
  expect(make(0, 0, 1, 1)(-1)).toBe(0);
  expect(make(0, 0, 1, 1)(2)).toBe(1);
});
it('非单调 progress 真正产生预备和过冲并返回终点，拒绝非法输入', () => {
  const f = cubicBezier({ x1: 0.2, y1: -1, x2: 0.7, y2: 2 });
  expect(f(0.05)).toBeLessThan(0);
  expect(f(0.9)).toBeGreaterThan(1);
  expect(f(1)).toBe(1);
  expect(() => cubicBezier({ x1: -1, y1: 0, x2: 1, y2: 1 })).toThrow();
  expect(() => cubicBezier({ x1: 0, y1: Infinity, x2: 1, y2: 1 })).toThrow();
  expect(() => f(NaN)).toThrow();
});
