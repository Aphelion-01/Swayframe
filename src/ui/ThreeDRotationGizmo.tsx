import { useEffect, useRef } from 'react';
import { findProperty } from '../core/project-model';
import { evaluateProperty } from '../core/animation-engine';
import {
  point4,
  identity4,
  multiply4,
  transform4,
  type Point3,
} from '../core/perspective';
import { unwrapAngle } from '../core/spatial-view';
import type { RenderSnapshot } from '../core/renderer-core';
import type { EditorStore } from './editor-store';
import type { SpatialProjector } from './ThreeDGizmo';
import { useInteractionCancel } from './workspace/interaction';
import { usePointerRelease } from './workspace/pointer-release';
type ScreenPoint = { x: number; y: number };
type RingDrag = {
  id: string;
  axis: number;
  base: readonly number[];
  next: readonly number[];
  revision: object;
  x: number;
  y: number;
  center: ScreenPoint;
  u: ScreenPoint;
  v: ScreenPoint;
  last: number;
  angle: number;
  edge: boolean;
  tx: number;
  ty: number;
};
function ringAngle(
  p: ScreenPoint,
  c: ScreenPoint,
  u: ScreenPoint,
  v: ScreenPoint,
) {
  const det = u.x * v.y - u.y * v.x;
  return Math.atan2(
    ((p.y - c.y) * u.x - (p.x - c.x) * u.y) / det,
    ((p.x - c.x) * v.y - (p.y - c.y) * v.x) / det,
  );
}
export function ThreeDRotationGizmo({
  store,
  snapshot,
  project,
  width,
  height,
  unitsPerPixel = 1,
}: {
  store: EditorStore;
  snapshot: RenderSnapshot;
  project: SpatialProjector;
  width: number;
  height: number;
  unitsPerPixel?: number;
}) {
  const drag = useRef<RingDrag | undefined>(undefined);
  const cancel = () => {
    if (drag.current) {
      drag.current = undefined;
      store.setPropertyPreview(undefined);
    }
  };
  const sample = (
    e: Pick<PointerEvent, 'clientX' | 'clientY' | 'altKey' | 'shiftKey'>,
  ) => {
    const d = drag.current;
    if (!d) return;
    if (d.edge)
      d.angle =
        (((e.clientX - d.x) * d.tx + (e.clientY - d.y) * d.ty) * Math.PI) / 120;
    else {
      const next = ringAngle(
        { x: e.clientX, y: e.clientY },
        d.center,
        d.u,
        d.v,
      );
      d.angle += unwrapAngle(next, d.last);
      d.last = next;
    }
    let degrees = ((d.angle * 180) / Math.PI) * (e.altKey ? 0.1 : 1);
    if (e.shiftKey) degrees = Math.round(degrees / 15) * 15;
    d.next = d.base.map((n, i) => n + (i === d.axis ? degrees : 0));
    const property = snapshot.layers.find((l) =>
      Object.values(l.source.editor?.properties ?? {}).some(
        (p) => p.id === d.id,
      ),
    )?.source.editor?.properties;
    const current =
      property && Object.values(property).find((p) => p.id === d.id);
    if (current)
      store.setPropertyPreview({
        id: d.id,
        property: { ...current, baseValue: d.next, keyframes: [] },
      });
  };
  usePointerRelease({
    active: () => !!drag.current,
    move: sample,
    finish: (e) => {
      sample(e);
      const d = drag.current;
      if (!d) return;
      drag.current = undefined;
      store.setPropertyPreview(undefined);
      if (
        store.getSnapshot().project === d.revision &&
        d.next.some((n, i) => Math.abs(n - d.base[i]!) > 1e-8)
      )
        store.run('旋转三维图层', [store.valueCommand(d.id, d.next)]);
    },
    cancel,
  });
  useInteractionCancel(cancel);
  useEffect(
    () => () => {
      if (drag.current) {
        drag.current = undefined;
        store.setPropertyPreview(undefined);
      }
    },
    [store],
  );
  const layer = snapshot.layers.find(
    (l) =>
      store.getSnapshot().selection.includes(l.source.id) &&
      (l.source.editor?.is3D || l.source.type === 'camera') &&
      !l.source.locked,
  );
  if (!layer?.world3D) return null;
  const property =
      layer.source.editor!.properties[
        layer.source.type === 'camera' ? 'cameraRotation' : 'rotation3D'
      ]!,
    time = store.getSnapshot().time;
  const values = evaluateProperty(property, time) as readonly number[];
  const anchor3 = evaluateProperty(
    layer.source.editor!.properties.anchor3D!,
    time,
  ) as readonly number[];
  const origin = point4(
    layer.world3D,
    layer.source.type === 'camera'
      ? [0, 0, 0]
      : [
          (layer.anchor?.x ?? 0) + anchor3[0]!,
          (layer.anchor?.y ?? 0) + anchor3[1]!,
          anchor3[2]!,
        ],
  );
  const center = project(origin);
  if (!center) return null;
  const parent =
    snapshot.layers.find((l) => l.source.id === layer.source.editor?.parentId)
      ?.world3D ?? identity4;
  return (
    <svg
      className="three-d-gizmo"
      viewBox={`0 0 ${width} ${height}`}
      aria-label="三维 XYZ 操控手柄"
    >
      {[0, 1, 2].map((axis) => {
        // Euler Rz*Ry*Rx: changing X is about Rz*Ry.X, Y about Rz.Y, Z about parent.Z.
        const frame = multiply4(
          parent,
          transform4(
            [0, 0, 0],
            [
              0,
              axis === 0 ? values[1]! : 0,
              axis < 2 ? values[2]! + layer.rotation : 0,
            ],
          ),
        );
        const p0 = point4(frame, [0, 0, 0]);
        const world = (angle: number, radius: number) => {
          const p = [0, 0, 0];
          p[(axis + 1) % 3] = Math.cos(angle) * radius;
          p[(axis + 2) % 3] = Math.sin(angle) * radius;
          const q = point4(frame, p as unknown as Point3);
          return origin.map((n, i) => n + q[i]! - p0[i]!) as unknown as Point3;
        };
        const initial = Array.from({ length: 96 }, (_, i) =>
          project(world((i * Math.PI) / 48, 100)),
        );
        const extent = Math.max(
          ...initial
            .filter((p) => !!p)
            .map((p) => Math.hypot(p.x - center.x, p.y - center.y)),
          1,
        );
        const radius = (100 * (54 + axis * 6) * unitsPerPixel) / extent;
        const points = Array.from({ length: 97 }, (_, i) =>
          project(world((i * Math.PI) / 48, radius)),
        );
        const u0 = points[0],
          v0 = points[24];
        if (!u0 || !v0) return null;
        const u = { x: u0.x - center.x, y: u0.y - center.y },
          v = { x: v0.x - center.x, y: v0.y - center.y };
        const edge =
          Math.abs(u.x * v.y - u.y * v.x) <
          Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) * 0.06;
        const path = points
          .map((p, i) =>
            p ? `${i && points[i - 1] ? 'L' : 'M'}${p.x},${p.y}` : '',
          )
          .join(' ');
        const label = points[(axis * 19 + 7) % 96] ?? u0;
        return (
          <g key={axis} style={{ color: `var(--axis-${'xyz'[axis]})` }}>
            <title>{'XYZ'[axis]} 轴旋转 · 拖动圆环 · Alt 精细 · 箭头微调</title>
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8 * unitsPerPixel}
            />
            <text
              x={label.x + 5 * unitsPerPixel}
              y={label.y - 4 * unitsPerPixel}
              fill="currentColor"
              fontSize={12 * unitsPerPixel}
            >
              {'XYZ'[axis]}
            </text>
            <path
              role="slider"
              aria-label={`旋转三维 ${'XYZ'[axis]} 轴`}
              aria-valuenow={values[axis]}
              aria-valuetext={`${values[axis]?.toFixed(1)} 度`}
              tabIndex={0}
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={26 * unitsPerPixel}
              style={{ pointerEvents: 'stroke', cursor: 'grab' }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                store.setPlaying(false);
                const r =
                    e.currentTarget.ownerSVGElement!.getBoundingClientRect(),
                  scale = r.width / width;
                const c = {
                    x: r.left + center.x * scale,
                    y: r.top + center.y * scale,
                  },
                  su = { x: u.x * scale, y: u.y * scale },
                  sv = { x: v.x * scale, y: v.y * scale };
                const tangent =
                    Math.hypot(su.x, su.y) > Math.hypot(sv.x, sv.y) ? su : sv,
                  norm = Math.hypot(tangent.x, tangent.y) || 1;
                const base = evaluateProperty(
                  findProperty(store.getSnapshot().project, property.id)
                    .property,
                  store.getSnapshot().time,
                ) as readonly number[];
                drag.current = {
                  id: property.id,
                  axis,
                  base,
                  next: base,
                  revision: store.getSnapshot().project,
                  x: e.clientX,
                  y: e.clientY,
                  center: c,
                  u: su,
                  v: sv,
                  last: edge
                    ? 0
                    : ringAngle({ x: e.clientX, y: e.clientY }, c, su, sv),
                  angle: 0,
                  edge,
                  tx: tangent.x / norm,
                  ty: tangent.y / norm,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  cancel();
                }
                if (
                  ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(
                    e.key,
                  )
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  store.setPlaying(false);
                  const base = evaluateProperty(
                    findProperty(store.getSnapshot().project, property.id)
                      .property,
                    store.getSnapshot().time,
                  ) as readonly number[];
                  store.run('微调三维旋转', [
                    store.valueCommand(
                      property.id,
                      base.map(
                        (n, i) =>
                          n +
                          (i === axis
                            ? (['ArrowLeft', 'ArrowDown'].includes(e.key)
                                ? -1
                                : 1) * (e.altKey ? 0.1 : e.shiftKey ? 10 : 1)
                            : 0),
                      ),
                    ),
                  ]);
                }
              }}
            />
          </g>
        );
      })}
      <circle
        cx={center.x}
        cy={center.y}
        r={4 * unitsPerPixel}
        fill="var(--background-primary)"
        stroke="var(--text-primary)"
        strokeWidth={unitsPerPixel}
      />
      <text
        x={center.x}
        y={center.y + 84 * unitsPerPixel}
        textAnchor="middle"
        fontSize={10 * unitsPerPixel}
        fill="var(--text-primary)"
      >
        {values.map((n, i) => `${'XYZ'[i]} ${n.toFixed(1)}°`).join('  ')}
      </text>
    </svg>
  );
}
