import { evaluateProperty } from './animation-engine';
import type { Mask } from './project-model';
import type { Vec2 } from './core-types';
function polygonContains(points: readonly Vec2[], p: Vec2): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!,
      b = points[j]!;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
/** Hit selection follows vector mask geometry. Feather halo is a soft selectable margin. */
export function maskHit(
  masks: readonly Mask[],
  p: Vec2,
  time: number,
): boolean {
  const active = masks.filter((m) => m.enabled);
  if (!active.length) return true;
  let alpha = active[0]!.mode === 'add' ? 0 : 1;
  for (const m of active) {
    const path = evaluateProperty(m.path, time),
      opacity = evaluateProperty(m.opacity, time);
    const anchors = Array.from({ length: path.length / 6 }, (_, i) => ({
      x: path[i * 6]!,
      y: path[i * 6 + 1]!,
    }));
    if (!anchors.length) continue;
    const minX = Math.min(...anchors.map((p) => p.x)),
      maxX = Math.max(...anchors.map((p) => p.x));
    const minY = Math.min(...anchors.map((p) => p.y)),
      maxY = Math.max(...anchors.map((p) => p.y));
    const margin =
      evaluateProperty(m.expansion, time) +
      Math.max(0, evaluateProperty(m.feather, time)) * 2;
    let inside = false;
    if (m.kind === 'rectangle')
      inside =
        p.x >= minX - margin &&
        p.x <= maxX + margin &&
        p.y >= minY - margin &&
        p.y <= maxY + margin;
    else if (m.kind === 'ellipse') {
      const rx = (maxX - minX) / 2 + margin,
        ry = (maxY - minY) / 2 + margin;
      inside =
        rx > 0 &&
        ry > 0 &&
        ((p.x - (minX + maxX) / 2) / rx) ** 2 +
          ((p.y - (minY + maxY) / 2) / ry) ** 2 <=
          1;
    } else {
      const points: Vec2[] = [];
      for (let i = 0; i < anchors.length; i++) {
        const j = (i + 1) % anchors.length,
          a = anchors[i]!,
          b = anchors[j]!;
        for (let n = 0; n < 16; n++) {
          const t = n / 16,
            u = 1 - t;
          points.push({
            x:
              u ** 3 * a.x +
              3 * u * u * t * path[i * 6 + 4]! +
              3 * u * t * t * path[j * 6 + 2]! +
              t ** 3 * b.x,
            y:
              u ** 3 * a.y +
              3 * u * u * t * path[i * 6 + 5]! +
              3 * u * t * t * path[j * 6 + 3]! +
              t ** 3 * b.y,
          });
        }
      }
      inside = polygonContains(points, p);
    }
    const coverage = inside ? opacity : 0;
    alpha =
      m.mode === 'subtract'
        ? alpha * (1 - coverage)
        : m.mode === 'intersect'
          ? alpha * coverage
          : coverage + alpha * (1 - coverage);
  }
  return alpha > 0.001;
}
