import type { Vec2 } from './core-types';
export function regularPath(
  sides: number,
  width: number,
  height: number,
  innerRadius?: number,
): readonly number[] {
  const n = Math.max(3, Math.min(100, Math.round(sides))),
    count = innerRadius === undefined ? n : n * 2;
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / count,
      r = innerRadius !== undefined && i % 2 ? innerRadius : 1,
      x = ((Math.cos(angle) * width) / 2) * r,
      y = ((Math.sin(angle) * height) / 2) * r;
    return [x, y, x, y, x, y];
  }).flat();
}
export function pathSvg(path: readonly number[], closed: boolean): string {
  if (path.length < 6) return '';
  const points = Array.from({ length: path.length / 6 }, (_, i) =>
    path.slice(i * 6, i * 6 + 6),
  );
  let d = `M ${points[0]![0]} ${points[0]![1]}`;
  for (let i = 1; i < points.length + (closed ? 1 : 0); i++) {
    const a = points[(i - 1) % points.length]!,
      b = points[i % points.length]!;
    d += ` C ${a[4]} ${a[5]} ${b[2]} ${b[3]} ${b[0]} ${b[1]}`;
  }
  return d + (closed ? ' Z' : '');
}
export function movePathPoint(
  path: readonly number[],
  index: number,
  point: Vec2,
  handle: 0 | 1 | 2 = 0,
): readonly number[] {
  if (index < 0 || index >= path.length / 6) throw new Error('路径点不存在');
  const offset = index * 6,
    dx = point.x - path[offset + handle * 2]!,
    dy = point.y - path[offset + handle * 2 + 1]!;
  return path.map((v, i) =>
    Math.floor(i / 6) === index &&
    (handle === 0 || Math.floor((i % 6) / 2) === handle)
      ? v + (i % 2 ? dy : dx)
      : v,
  );
}
export function addPathPoint(
  path: readonly number[],
  point: Vec2,
): readonly number[] {
  return [
    ...path,
    point.x,
    point.y,
    point.x - 30,
    point.y,
    point.x + 30,
    point.y,
  ];
}
export function removePathPoint(
  path: readonly number[],
  index: number,
): readonly number[] {
  if (path.length <= 6) throw new Error('路径至少保留一个点');
  return path.filter((_, i) => Math.floor(i / 6) !== index);
}
