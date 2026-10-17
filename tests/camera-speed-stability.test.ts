import { expect, it } from 'vitest';
import { createProperty } from '../src/core/project-model';
import { sampleCurve } from '../src/core/curve-model';
it('camera velocity stays exact for a distant uniform position including endpoints', () => {
  const p = {
    ...createProperty([1e8, -1e8, 5000]),
    keyframes: [
      {
        id: 'a',
        time: 0,
        value: [1e8, -1e8, 5000],
        interpolation: { type: 'linear' as const },
      },
      {
        id: 'b',
        time: 1,
        value: [1e8 + 3, -1e8 + 4, 5000],
        interpolation: { type: 'linear' as const },
      },
    ],
  };
  expect(sampleCurve(p, 0, 1, 'speed').every((s) => s.value === 5)).toBe(true);
});
it('diagonal temporal Bezier has constant speed without finite difference noise', () => {
  const p = {
    ...createProperty([1e8, 0, 0]),
    keyframes: [
      {
        id: 'a',
        time: 0,
        value: [1e8, 0, 0],
        interpolation: {
          type: 'bezier' as const,
          out: { x: 0.42, y: 0.42 },
          in: { x: 0.58, y: 0.58 },
        },
      },
      {
        id: 'b',
        time: 1,
        value: [1e8 + 10, 0, 0],
        interpolation: { type: 'linear' as const },
      },
    ],
  };
  for (const s of sampleCurve(p, 0, 1, 'speed'))
    expect(s.value).toBeCloseTo(10, 10);
});
