import type { Vec2 } from './core-types';
export type Matrix2D = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
];
export const identity2D: Matrix2D = [1, 0, 0, 1, 0, 0];
export function multiply2D(a: Matrix2D, b: Matrix2D): Matrix2D {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
export function apply2D(m: Matrix2D, p: Vec2): Vec2 {
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5],
  };
}
export function inverse2D(m: Matrix2D): Matrix2D | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}
export function transform2D(
  position: Vec2,
  scale: Vec2,
  rotation: number,
  anchor: Vec2,
): Matrix2D {
  const r = (rotation * Math.PI) / 180,
    a = Math.cos(r) * scale.x,
    b = Math.sin(r) * scale.x,
    c = -Math.sin(r) * scale.y,
    d = Math.cos(r) * scale.y;
  return [
    a,
    b,
    c,
    d,
    position.x - a * anchor.x - c * anchor.y,
    position.y - b * anchor.x - d * anchor.y,
  ];
}
