/** Timing solver: invert Bx before evaluating By. No scene or property units. */
export interface BezierCoordinates {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}
const cache = new Map<string, (u: number) => number>();
export function validateBezier(c: BezierCoordinates): void {
  if (
    ![c.x1, c.y1, c.x2, c.y2].every(Number.isFinite) ||
    c.x1 < 0 ||
    c.x1 > 1 ||
    c.x2 < 0 ||
    c.x2 > 1
  )
    throw new Error('曲线 X 必须在 0～1，所有坐标必须有限');
}
export const bezierCoordinate = (a: number, b: number, t: number): number =>
  ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
export function invertBezierX(x1: number, x2: number, u: number): number {
  validateBezier({ x1, x2, y1: 0, y2: 1 });
  if (!Number.isFinite(u)) throw new Error('时间必须有限');
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  let t = u;
  for (let i = 0; i < 8; i++) {
    const error = bezierCoordinate(x1, x2, t) - u;
    if (Math.abs(error) < 1e-12) return t;
    const slope =
      3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
    if (Math.abs(slope) < 1e-8) break;
    const next = t - error / slope;
    if (next <= 0 || next >= 1) break;
    t = next;
  }
  let low = 0,
    high = 1;
  for (let i = 0; i < 48; i++) {
    t = (low + high) / 2;
    if (bezierCoordinate(x1, x2, t) < u) low = t;
    else high = t;
  }
  return (low + high) / 2;
}
export function cubicBezier(c: BezierCoordinates): (u: number) => number {
  validateBezier(c);
  const key = `${c.x1},${c.y1},${c.x2},${c.y2}`;
  const found = cache.get(key);
  if (found) return found;
  const { x1, x2, y1, y2 } = c;
  const solve = (u: number) =>
    bezierCoordinate(y1, y2, invertBezierX(x1, x2, u));
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  cache.set(key, solve);
  return solve;
}
