import { ThreeDRotationGizmo } from './ThreeDRotationGizmo';
import { useEffect, useRef } from 'react';
import type { EditorStore } from './editor-store';
import { evaluateProperty } from '../core/animation-engine';
import {
  activeComposition,
  findProperty,
  type Property,
} from '../core/project-model';
import type { AnimValue } from '../core/core-types';
import { point4, identity4, type Point3 } from '../core/perspective';
import { axisDragAmount } from '../core/spatial-view';
import type { RenderSnapshot } from '../core/renderer-core';
import { usePointerRelease } from './workspace/pointer-release';
import { useInteractionCancel } from './workspace/interaction';
export type SpatialGizmoMode = 'translate' | 'rotate';
export type SpatialProjector = (
  p: Point3,
) => { x: number; y: number; z: number } | null;
export function ThreeDGizmo({
  store,
  snapshot,
  project,
  width,
  height,
  unitsPerPixel = 1,
  mode = 'translate',
}: {
  store: EditorStore;
  snapshot: RenderSnapshot;
  project: SpatialProjector;
  width: number;
  height: number;
  unitsPerPixel?: number;
  mode?: SpatialGizmoMode;
}) {
  const drag = useRef<
    | {
        id: string;
        base: readonly number[];
        axis: number;
        x: number;
        y: number;
        dx: number;
        dy: number;
        units: number;
        next: readonly number[];
        revision: object;
      }
    | undefined
  >(undefined);
  const cancel = () => {
    drag.current = undefined;
    store.setPropertyPreview(undefined);
  };
  const sample = (x: number, y: number, slow = false) => {
    const d = drag.current;
    if (!d) return;
    const amount =
      axisDragAmount(x - d.x, y - d.y, d.dx, d.dy, d.units) * (slow ? 0.1 : 1);
    d.next = d.base.map((n, i) => n + (i === d.axis ? amount : 0));
    const p = activeComposition(store.getSnapshot().project)
      .layers.flatMap((l) => Object.values(l.editor?.properties ?? {}))
      .find((p) => p.id === d.id);
    if (p)
      store.setPropertyPreview({
        id: d.id,
        property: { ...p, baseValue: d.next, keyframes: [] },
      });
  };
  usePointerRelease({
    active: () => !!drag.current,
    move: (e) => sample(e.clientX, e.clientY, e.altKey),
    finish: (e) => {
      sample(e.clientX, e.clientY, e.altKey);
      const d = drag.current;
      if (!d) return;
      store.setPropertyPreview(undefined);
      drag.current = undefined;
      if (store.getSnapshot().project !== d.revision) return;
      if (d.next.some((n, i) => Math.abs(n - d.base[i]!) > 1e-8))
        store.run('移动三维图层', [store.valueCommand(d.id, d.next)]);
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
  useEffect(() => {
    if (drag.current) {
      drag.current = undefined;
      store.setPropertyPreview(undefined);
    }
  }, [mode, store]);
  if (mode === 'rotate')
    return (
      <ThreeDRotationGizmo
        store={store}
        snapshot={snapshot}
        project={project}
        width={width}
        height={height}
        unitsPerPixel={unitsPerPixel}
      />
    );
  const chosen = snapshot.layers.find(
    (l) =>
      store.getSnapshot().selection.includes(l.source.id) &&
      (l.source.editor?.is3D || l.source.type === 'camera') &&
      !l.source.locked,
  );
  if (!chosen?.world3D) return null;
  const property = chosen.source.editor!.properties[
      chosen.source.type === 'camera' ? 'cameraPosition' : 'position3D'
    ]! as Property<AnimValue>,
    origin = point4(chosen.world3D, [0, 0, 0]),
    o = project(origin);
  if (!o) return null;
  const parent =
    snapshot.layers.find((l) => l.source.id === chosen.source.editor?.parentId)
      ?.world3D ?? identity4;
  return (
    <svg
      className="three-d-gizmo"
      viewBox={`0 0 ${width} ${height}`}
      aria-label="三维 XYZ 操控手柄"
    >
      {[0, 1, 2].map((axis) => {
        const unit = [0, 0, 0];
        unit[axis] = 100;
        const p0 = point4(parent, [0, 0, 0]),
          p1 = point4(parent, unit as unknown as Point3),
          end = project(
            origin.map((n, i) => n + p1[i]! - p0[i]!) as unknown as Point3,
          );
        let dx = (end?.x ?? o.x) - o.x,
          dy = (end?.y ?? o.y) - o.y;
        let units = 100;
        const length = Math.hypot(dx, dy);
        // Preserve the continuous projection, including a foreshortened axis.
        // A point-on axis becomes a depth puck rather than flipping direction.
        if (length > 1e-8) {
          const ratio =
            (65 * unitsPerPixel) / Math.max(length, 20 * unitsPerPixel);
          dx *= ratio;
          dy *= ratio;
          units *= ratio;
        }
        return (
          <g key={axis} style={{ color: `var(--axis-${'xyz'[axis]})` }}>
            <title>{'XYZ'[axis]} 轴移动 · 拖动调整 · Alt 精细 · 箭头微调</title>
            <line
              x1={o.x}
              y1={o.y}
              x2={o.x + dx}
              y2={o.y + dy}
              stroke="currentColor"
              strokeWidth={2 * unitsPerPixel}
            />
            <circle
              cx={o.x + dx}
              cy={o.y + dy}
              r={4 * unitsPerPixel}
              fill="currentColor"
            />
            <text
              x={o.x + dx + 7 * unitsPerPixel}
              y={o.y + dy}
              fontSize={12 * unitsPerPixel}
              fill="currentColor"
            >
              {'XYZ'[axis]}
            </text>
            <line
              role="slider"
              aria-label={`移动三维 ${'XYZ'[axis]} 轴`}
              tabIndex={0}
              aria-valuenow={
                (
                  evaluateProperty(
                    findProperty(store.getSnapshot().project, property.id)
                      .property,
                    store.getSnapshot().time,
                  ) as readonly number[]
                )[axis]
              }
              x1={o.x + dx * 0.12}
              y1={o.y + dy * 0.12}
              x2={o.x + dx}
              y2={o.y + dy - (length < 1e-8 ? unitsPerPixel : 0)}
              stroke="transparent"
              strokeWidth={28 * unitsPerPixel}
              style={{ pointerEvents: 'stroke', cursor: 'move' }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancel();
                if (
                  ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(
                    e.key,
                  )
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  const base = evaluateProperty(
                    findProperty(store.getSnapshot().project, property.id)
                      .property,
                    store.getSnapshot().time,
                  ) as readonly number[];
                  store.run('微调三维位置', [
                    store.valueCommand(
                      property.id,
                      base.map(
                        (n, i) =>
                          n +
                          (i === axis
                            ? (['ArrowLeft', 'ArrowDown'].includes(e.key)
                                ? -1
                                : 1) * (e.shiftKey ? 10 : 1)
                            : 0),
                      ),
                    ),
                  ]);
                }
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                store.setPlaying(false);
                const r =
                    e.currentTarget.ownerSVGElement!.getBoundingClientRect(),
                  scale = width / r.width;
                const base = evaluateProperty(
                  property,
                  store.getSnapshot().time,
                ) as readonly number[];
                drag.current = {
                  id: property.id,
                  base,
                  axis,
                  x: e.clientX,
                  y: e.clientY,
                  dx: dx / scale,
                  dy: dy / scale,
                  units,
                  next: base,
                  revision: store.getSnapshot().project,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerUp={(e) => sample(e.clientX, e.clientY, e.altKey)}
            />
          </g>
        );
      })}
      <circle
        cx={o.x}
        cy={o.y}
        r={5 * unitsPerPixel}
        fill="var(--background-primary)"
        stroke="var(--text-primary)"
        strokeWidth={unitsPerPixel}
      />
    </svg>
  );
}
