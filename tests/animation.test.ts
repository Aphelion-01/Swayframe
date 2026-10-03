import { describe, expect, it } from 'vitest';
import {
  evaluateProperty,
  interpolationSchema,
} from '../src/core/animation-engine';
import { createProperty } from '../src/core/project-model';
import type { Interpolation, Property } from '../src/core/project-model';
import { newId } from '../src/core/core-types';

const linear: Interpolation = { type: 'linear' };
function scalar(interpolation = linear): Property<number> {
  return {
    ...createProperty(7),
    keyframes: [
      { id: newId(), time: 0, value: 0, interpolation },
      { id: newId(), time: 1, value: 100, interpolation: linear },
    ],
  };
}
describe('Animation Engine', () => {
  it('无关键帧返回 baseValue；单帧与区间外延使用最近端点', () => {
    expect(evaluateProperty(createProperty(7), 0)).toBe(7);
    const one = { ...scalar(), keyframes: [scalar().keyframes[1]!] };
    expect(evaluateProperty(one, -1)).toBe(100);
    expect(evaluateProperty(scalar(), -1)).toBe(0);
    expect(evaluateProperty(scalar(), 2)).toBe(100);
  });
  it('线性标量与 Vec2 中点正确', () => {
    expect(evaluateProperty(scalar(), 0.5)).toBe(50);
    const p = {
      ...createProperty({ x: 0, y: 0 }),
      keyframes: [
        { id: newId(), time: 0, value: { x: 0, y: 0 }, interpolation: linear },
        {
          id: newId(),
          time: 1,
          value: { x: 100, y: 200 },
          interpolation: linear,
        },
      ],
    };
    expect(evaluateProperty(p, 0.5)).toEqual({ x: 50, y: 100 });
  });
  it('乱序关键帧不改变求值、不修改输入', () => {
    const p = scalar();
    const unordered = { ...p, keyframes: [...p.keyframes].reverse() };
    const before = JSON.stringify(unordered);
    expect(evaluateProperty(unordered, 0.5)).toBe(50);
    expect(JSON.stringify(unordered)).toBe(before);
  });
  it('Bezier 反解 x，端点精确、连续且 ease-in 中点慢于 linear', () => {
    const p = scalar({
      type: 'bezier',
      out: { x: 0.42, y: 0 },
      in: { x: 1, y: 1 },
    });
    expect(evaluateProperty(p, 0)).toBe(0);
    expect(evaluateProperty(p, 1)).toBe(100);
    expect(evaluateProperty(p, 0.5)).toBeCloseTo(31.536, 2);
    expect(
      Math.abs(evaluateProperty(p, 0.501) - evaluateProperty(p, 0.5)),
    ).toBeLessThan(1);
  });
  it.each([18, 2 * Math.sqrt(170), 45])(
    'Spring damping=%s 有限且端点收敛',
    (damping) => {
      const p = scalar({ type: 'spring', stiffness: 170, damping, mass: 1 });
      for (let i = 0; i <= 100; i++)
        expect(Number.isFinite(evaluateProperty(p, i / 100))).toBe(true);
      expect(evaluateProperty(p, 1)).toBe(100);
      expect(evaluateProperty(p, 5)).toBe(100);
    },
  );
  it('欠阻尼 spring 可产生轻微过冲', () => {
    const p = scalar({ type: 'spring', stiffness: 170, damping: 18, mass: 1 });
    expect(
      Math.max(
        ...Array.from({ length: 100 }, (_, i) => evaluateProperty(p, i / 100)),
      ),
    ).toBeGreaterThan(100);
  });
  it('拒绝异常参数及无效时间，极短区间仍有限', () => {
    expect(
      interpolationSchema.safeParse({
        type: 'spring',
        stiffness: 0,
        damping: 1,
        mass: 0,
      }).success,
    ).toBe(false);
    expect(() => evaluateProperty(scalar(), NaN)).toThrow();
    const p = scalar({ type: 'spring', stiffness: 1, damping: 1, mass: 1000 });
    const short = {
      ...p,
      keyframes: [p.keyframes[0]!, { ...p.keyframes[1]!, time: 1e-9 }],
    };
    expect(Number.isFinite(evaluateProperty(short, 5e-10))).toBe(true);
  });
});
