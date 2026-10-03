import { it, expect } from 'vitest';
import {
  speedsFromControls,
  controlsFromSpeed,
  propertySpeed,
  propertySpeedUnit,
} from '../src/core/curve-model';
import { createProperty } from '../src/core/project-model';
import { newId } from '../src/core/core-types';
it('Ease Out 退化起点导数不错误显示为零，下降 Number 的速度为正', () => {
  const a = {
      id: newId(),
      time: 0,
      value: 100,
      interpolation: {
        type: 'bezier' as const,
        out: { x: 0, y: 0 },
        in: { x: 0.58, y: 1 },
      },
    },
    b = {
      id: newId(),
      time: 1,
      value: 0,
      interpolation: { type: 'linear' as const },
    };
  const speed = speedsFromControls(a, b);
  expect(speed.outSpeed).toBeGreaterThan(170);
  expect(speed.inSpeed).toBeLessThan(0.01);
  const p = { ...createProperty(100), keyframes: [a, b] };
  expect(propertySpeed(p, 0.1)).toBeGreaterThan(propertySpeed(p, 0.9));
  const ctrl = controlsFromSpeed(a, b, 40, 60, 25, 0);
  expect(ctrl.out.y).toBeCloseTo(0.1);
  expect(ctrl.in.y).toBe(1);
  expect(propertySpeedUnit('transform.opacity')).toEqual({
    label: '%/s',
    factor: 100,
  });
});
it('曲线路径速度依据空间导数，不以端点直线距离冒充路径速度', () => {
  const a = {
      id: newId(),
      time: 0,
      value: { x: 0, y: 0 },
      spatialOutgoing: { x: 0, y: 200 },
      interpolation: {
        type: 'bezier' as const,
        out: { x: 0.3, y: 0.3 },
        in: { x: 0.7, y: 0.7 },
      },
    },
    b = {
      id: newId(),
      time: 2,
      value: { x: 200, y: 0 },
      spatialIncoming: { x: 200, y: 200 },
      interpolation: { type: 'linear' as const },
    };
  const speed = speedsFromControls(a, b);
  expect(speed.outSpeed).toBeCloseTo(300);
  expect(speed.inSpeed).toBeCloseTo(300);
  const p = { ...createProperty(a.value), keyframes: [a, b] };
  expect(propertySpeed(p, 0)).toBeCloseTo(300, 1);
  const ctrl = controlsFromSpeed(a, b, 30, 30, 150, 60);
  const again = speedsFromControls(
    { ...a, outgoing: ctrl.out },
    { ...b, incoming: ctrl.in },
  );
  expect(again.outSpeed).toBeCloseTo(150);
  expect(again.inSpeed).toBeCloseTo(60);
});
