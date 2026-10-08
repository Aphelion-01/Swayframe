import type { Vec2 } from './core-types';
import type { RenderLayer } from './renderer-core';
import { evaluateProperty } from './animation-engine';
import { layerToWorld } from './transform-geometry';
import { regularPath } from './shape-geometry';
import { layoutText, textValue } from './text-geometry';
import type { TextMeasure } from './text-geometry';
export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}
export const boundsCenter = (b: Bounds): Vec2 => ({
  x: (b.minX + b.maxX) / 2,
  y: (b.minY + b.maxY) / 2,
});
export function boundsFromPoints(points: readonly Vec2[]): Bounds {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}
export const boundsCorners = (b: Bounds): Vec2[] => [
  { x: b.minX, y: b.minY },
  { x: b.maxX, y: b.minY },
  { x: b.maxX, y: b.maxY },
  { x: b.minX, y: b.maxY },
];
export const unionBounds = (bounds: readonly Bounds[]): Bounds =>
  bounds.length
    ? boundsFromPoints(bounds.flatMap(boundsCorners))
    : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
function cubic(a: number, b: number, c: number, d: number, t: number) {
  return (
    (1 - t) ** 3 * a +
    3 * (1 - t) ** 2 * t * b +
    3 * (1 - t) * t * t * c +
    t ** 3 * d
  );
}
function extrema(a: number, b: number, c: number, d: number): number[] {
  const A = -a + 3 * b - 3 * c + d,
    B = 2 * (a - 2 * b + c),
    C = b - a;
  if (Math.abs(A) < 1e-12)
    return Math.abs(B) < 1e-12 ? [] : [-C / B].filter((t) => t > 0 && t < 1);
  const disc = B * B - 4 * A * C;
  return disc < 0
    ? []
    : [
        (-B + Math.sqrt(disc)) / (2 * A),
        (-B - Math.sqrt(disc)) / (2 * A),
      ].filter((t) => t > 0 && t < 1);
}
function pathPoints(
  item: RenderLayer,
  time: number,
  map: (p: Vec2) => Vec2,
): Vec2[] | undefined {
  const layer = item.source;
  if (
    layer.type !== 'shape' ||
    ['rectangle', 'ellipse'].includes(layer.shapeKind)
  )
    return;
  const value = (key: string, fallback: number) =>
    layer.editor?.properties[key]
      ? (evaluateProperty(layer.editor.properties[key]!, time) as number)
      : fallback;
  const path =
    layer.shapeKind === 'path'
      ? (evaluateProperty(
          layer.editor!.properties.path!,
          time,
        ) as readonly number[])
      : regularPath(
          value('sides', 5),
          layer.width,
          layer.height,
          layer.shapeKind === 'star' ? value('innerRadius', 0.45) : undefined,
        );
  const points = Array.from({ length: path.length / 6 }, (_, i) => [
    map({ x: path[i * 6]!, y: path[i * 6 + 1]! }),
    map({ x: path[i * 6 + 2]!, y: path[i * 6 + 3]! }),
    map({ x: path[i * 6 + 4]!, y: path[i * 6 + 5]! }),
  ]);
  const result: Vec2[] = points.map((p) => p[0]!);
  const closed =
    layer.shapeKind !== 'path' || layer.editor?.pathClosed !== false;
  for (let i = 1; i < points.length + (closed ? 1 : 0); i++) {
    const a = points[(i - 1) % points.length]!,
      b = points[i % points.length]!,
      p = [a[0]!, a[2]!, b[1]!, b[0]!];
    for (const t of new Set([
      ...extrema(p[0]!.x, p[1]!.x, p[2]!.x, p[3]!.x),
      ...extrema(p[0]!.y, p[1]!.y, p[2]!.y, p[3]!.y),
    ]))
      result.push({
        x: cubic(p[0]!.x, p[1]!.x, p[2]!.x, p[3]!.x, t),
        y: cubic(p[0]!.y, p[1]!.y, p[2]!.y, p[3]!.y, t),
      });
  }
  return result;
}
export function getLocalBounds(
  item: RenderLayer,
  time: number,
  measure?: TextMeasure,
): Bounds {
  const l = item.source,
    path = pathPoints(item, time, (p) => p);
  let b = path?.length
    ? boundsFromPoints(path)
    : {
        minX: -l.width / 2,
        minY: -l.height / 2,
        maxX: l.width / 2,
        maxY: l.height / 2,
      };
  if (l.type === 'text' && measure) {
    const size = textValue(l, 'fontSize', time, l.fontSize);
    const glyphs = layoutText(l, time, measure);
    if (glyphs.length)
      b = unionBounds(
        glyphs.map(({ x, y, scale, rotation, metrics: m }) => {
          const angle = (rotation * Math.PI) / 180,
            cos = Math.cos(angle) * scale,
            sin = Math.sin(angle) * scale;
          const points = [
            [-(m.left ?? 0), -(m.ascent ?? size / 2)],
            [m.right ?? m.width, -(m.ascent ?? size / 2)],
            [-(m.left ?? 0), m.descent ?? size / 2],
            [m.right ?? m.width, m.descent ?? size / 2],
          ].map(([px, py]) => ({
            x: x + px! * cos - py! * sin,
            y: y + px! * sin + py! * cos,
          }));
          return {
            minX: Math.min(...points.map((p) => p.x)),
            maxX: Math.max(...points.map((p) => p.x)),
            minY: Math.min(...points.map((p) => p.y)),
            maxY: Math.max(...points.map((p) => p.y)),
          };
        }),
      );
  }
  const sw =
    l.type === 'shape' && l.editor?.properties.strokeWidth
      ? Math.max(
          0,
          evaluateProperty(l.editor.properties.strokeWidth, time) as number,
        ) / 2
      : 0;
  return {
    minX: b.minX - sw,
    minY: b.minY - sw,
    maxX: b.maxX + sw,
    maxY: b.maxY + sw,
  };
}
/** Shared content bounds: projected planes, measured text, exact cubic extrema and layer frames. Effects halos are excluded. */
export function getWorldBounds(
  item: RenderLayer,
  time: number,
  measure?: TextMeasure,
): Bounds {
  if (item.quad) return boundsFromPoints(item.quad);
  const path = pathPoints(item, time, (p) => layerToWorld(item, p));
  let b = path?.length
    ? boundsFromPoints(path)
    : boundsFromPoints(
        boundsCorners(getLocalBounds(item, time, measure)).map((p) =>
          layerToWorld(item, p),
        ),
      );
  const l = item.source,
    m = item.matrix;
  if (l.type === 'shape' && l.shapeKind === 'ellipse' && m) {
    const center = layerToWorld(item, { x: 0, y: 0 }),
      sw = l.editor?.properties.strokeWidth
        ? Math.max(
            0,
            evaluateProperty(l.editor.properties.strokeWidth, time) as number,
          ) / 2
        : 0;
    const rx = l.width / 2 + sw,
      ry = l.height / 2 + sw,
      x = Math.hypot(m[0] * rx, m[2] * ry),
      y = Math.hypot(m[1] * rx, m[3] * ry);
    b = {
      minX: center.x - x,
      minY: center.y - y,
      maxX: center.x + x,
      maxY: center.y + y,
    };
  } else if (path?.length && m) {
    const sw = l.editor?.properties.strokeWidth
        ? Math.max(
            0,
            evaluateProperty(l.editor.properties.strokeWidth, time) as number,
          ) / 2
        : 0,
      x = sw * Math.hypot(m[0], m[2]),
      y = sw * Math.hypot(m[1], m[3]);
    b = {
      minX: b.minX - x,
      minY: b.minY - y,
      maxX: b.maxX + x,
      maxY: b.maxY + y,
    };
  }
  return b;
}
