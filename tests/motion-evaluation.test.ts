import { it, expect } from 'vitest';
import type { Property } from '../src/core/project-model';
import { createProperty } from '../src/core/project-model';
import type { AnimValue } from '../src/core/core-types';
import { newId } from '../src/core/core-types';
import { evaluateProperty } from '../src/core/animation-engine';
import {
  evaluateMotionCurve,
  curveInterpolation,
} from '../src/core/motion-curve';
import { spatialPoint } from '../src/core/spatial-path';
it('Number Vec2 Vec3 Color 使用同一时间曲线，Scale 过冲回落', () => {
  const curve = {
      type: 'cubic-bezier' as const,
      x1: 0.2,
      y1: -0.4,
      x2: 0.6,
      y2: 1.8,
    },
    u = 0.8,
    progress = evaluateMotionCurve(curve, u);
  expect(progress).toBeGreaterThan(1);
  const pairs: [AnimValue, AnimValue][] = [
    [0, 100],
    [
      { x: 0, y: 0 },
      { x: 100, y: 200 },
    ],
    [
      [0, 0, 0],
      [10, 20, 30],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
    ],
  ];
  for (const [a, b] of pairs) {
    const p: Property<AnimValue> = {
      ...createProperty(a),
      keyframes: [
        {
          id: newId(),
          time: 0,
          value: a,
          interpolation: curveInterpolation(curve),
        },
        {
          id: newId(),
          time: 1,
          value: b,
          interpolation: { type: 'linear' as const },
        },
      ],
    };
    const v = evaluateProperty(p, u);
    if (typeof v === 'number') expect(v).toBeCloseTo(100 * progress);
    else if (Array.isArray(v))
      expect(v[0]).toBeCloseTo((b as number[])[0]! * progress);
    else expect((v as { x: number }).x).toBeCloseTo(100 * progress);
    expect(evaluateProperty(p, 1)).toEqual(b);
  }
});
it('空间曲线路径与时间曲线独立，修改 timing 不改几何控制点', () => {
  const from = {
      id: newId(),
      time: 0,
      value: { x: 0, y: 0 },
      spatialOutgoing: { x: 0, y: 200 },
      interpolation: { type: 'linear' as const },
    },
    to = {
      id: newId(),
      time: 1,
      value: { x: 200, y: 0 },
      spatialIncoming: { x: 200, y: 200 },
      interpolation: { type: 'linear' as const },
    };
  const curve = {
    type: 'cubic-bezier' as const,
    x1: 0,
    y1: 0,
    x2: 0.58,
    y2: 1,
  };
  const p: Property<AnimValue> = {
    ...createProperty(from.value),
    keyframes: [{ ...from, interpolation: curveInterpolation(curve) }, to],
  };
  expect(evaluateProperty(p, 0.5)).toEqual(
    spatialPoint(from, to, evaluateMotionCurve(curve, 0.5)),
  );
  expect(spatialPoint(from, to, 0.5)).toEqual({ x: 100, y: 150 });
  expect(p.keyframes[0]!.spatialOutgoing).toEqual({ x: 0, y: 200 });
});
