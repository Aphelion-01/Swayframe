import { useEffect, useRef } from 'react';
import { evaluateProperty } from '../core/animation-engine';
import type { Vec2 } from '../core/core-types';
import type { Property } from '../core/project-model';
import type { RenderSnapshot } from '../core/renderer-core';
import { layerToWorld } from '../core/transform-geometry';
import { point4, projectPoint } from '../core/perspective';
import { screenPathDelta } from '../core/motion-path-projection';
import { movePathPoint, pathSvg } from '../core/shape-geometry';
import type { SpatialProjector } from './ThreeDGizmo';
import type { EditorStore } from './editor-store';
import { usePointerRelease } from './workspace/pointer-release';
import { useInteractionCancel } from './workspace/interaction';
/** Pen Tool's contextual direct manipulation; geometry commits through the shared command system. */
export function ShapePathOverlay({
  store,
  snapshot,
  width,
  height,
  unitsPerPixel = 1,
  project,
  editable = true,
}: {
  store: EditorStore;
  snapshot: RenderSnapshot;
  width: number;
  height: number;
  unitsPerPixel?: number;
  project?: SpatialProjector;
  editable?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<
    | {
        property: Property<readonly number[]>;
        index: number;
        handle: 0 | 1 | 2;
        data: readonly number[];
        next: readonly number[];
        screen: (p: Vec2) => Vec2 | null;
        x: number;
        y: number;
        origin: Vec2;
        display: Vec2;
        sx: number;
        sy: number;
        moved: boolean;
        revision: object;
        time: number;
      }
    | undefined
  >(undefined);
  const cancel = () => {
    if (drag.current) {
      drag.current = undefined;
      store.setPropertyPreview(undefined);
    }
  };
  const sample = (e: Pick<PointerEvent, 'clientX' | 'clientY'>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 2) return;
    d.moved = true;
    const target = {
      x: d.display.x + (e.clientX - d.x) * d.sx,
      y: d.display.y + (e.clientY - d.y) * d.sy,
    };
    let p = { ...d.origin };
    for (let i = 0; i < 8; i++) {
      const a = d.screen(p),
        x = d.screen({ x: p.x + 1, y: p.y }),
        y = d.screen({ x: p.x, y: p.y + 1 });
      if (!a || !x || !y) return;
      const dx = target.x - a.x,
        dy = target.y - a.y;
      if (Math.hypot(dx, dy) < 0.001) break;
      const delta = screenPathDelta(
        [
          { x: x.x - a.x, y: x.y - a.y },
          { x: y.x - a.x, y: y.y - a.y },
        ],
        dx,
        dy,
      );
      if (!delta) return;
      p = { x: p.x + delta[0]!, y: p.y + delta[1]! };
    }
    d.next = movePathPoint(d.data, d.index, p, d.handle);
    store.setPropertyPreview({
      id: d.property.id,
      property: { ...d.property, baseValue: d.next, keyframes: [] },
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
        d.revision === store.getSnapshot().project &&
        d.time === store.getSnapshot().time &&
        d.next.some((n, i) => n !== d.data[i])
      )
        store.run('编辑贝塞尔路径', [
          store.valueCommand(d.property.id, d.next),
        ]);
    },
    cancel,
  });
  useInteractionCancel(cancel);
  const revision = store.getSnapshot().project;
  useEffect(() => {
    if (
      drag.current &&
      (drag.current.revision !== revision ||
        drag.current.time !== snapshot.time)
    )
      cancel();
  }, [revision, snapshot.time]);
  useEffect(
    () => () => {
      if (drag.current) store.setPropertyPreview(undefined);
    },
    [store],
  );
  if (!editable) return null;
  return (
    <svg
      ref={svg}
      className="shape-path-overlay"
      viewBox={`0 0 ${width} ${height}`}
      aria-label="直接编辑贝塞尔路径"
    >
      {snapshot.layers
        .filter(
          (l) =>
            snapshot.selection.includes(l.source.id) &&
            l.source.type === 'shape' &&
            l.source.shapeKind === 'path' &&
            !l.source.locked &&
            l.active,
        )
        .map((l) => {
          const property = l.source.editor!.properties.path! as Property<
            readonly number[]
          >;
          const data = evaluateProperty(property, snapshot.time);
          const screen = (p: Vec2): Vec2 | null => {
            if (l.source.editor?.is3D && l.world3D) {
              const world = point4(l.world3D, [p.x, p.y, 0]);
              return project
                ? project(world)
                : snapshot.camera
                  ? projectPoint(world, snapshot.camera)
                  : null;
            }
            const world = layerToWorld(l, p);
            return project
              ? project([
                  world.x - snapshot.width / 2,
                  world.y - snapshot.height / 2,
                  0,
                ])
              : world;
          };
          const projected: number[] = [];
          for (let i = 0; i < data.length; i += 2) {
            const p = screen({ x: data[i]!, y: data[i + 1]! });
            if (!p) return null;
            projected.push(p.x, p.y);
          }
          return (
            <g key={l.source.id}>
              <path
                d={pathSvg(projected, l.source.editor!.pathClosed)}
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth={unitsPerPixel}
                pointerEvents="none"
              />
              {Array.from({ length: data.length / 6 }, (_, index) => {
                const start = index * 6,
                  anchor = { x: projected[start]!, y: projected[start + 1]! };
                return ([1, 2, 0] as const).map((handle) => {
                  const offset = start + handle * 2,
                    origin = { x: data[offset]!, y: data[offset + 1]! };
                  const collapsed =
                    handle !== 0 &&
                    data[offset] === data[start] &&
                    data[offset + 1] === data[start + 1];
                  const display = {
                    x:
                      projected[offset]! +
                      (collapsed
                        ? (handle === 1 ? -24 : 24) * unitsPerPixel
                        : 0),
                    y: projected[offset + 1]!,
                  };
                  return (
                    <g key={`${index}-${handle}`}>
                      <title>{`路径点 ${index + 1} · ${handle === 0 ? '锚点' : handle === 1 ? '入切线' : '出切线'} · 拖动 / 箭头微调 · Shift 10倍 · Alt 0.1倍`}</title>
                      {handle !== 0 && (
                        <line
                          x1={anchor.x}
                          y1={anchor.y}
                          x2={display.x}
                          y2={display.y}
                          stroke="var(--warning)"
                          strokeWidth={unitsPerPixel}
                          strokeDasharray={
                            collapsed
                              ? `${3 * unitsPerPixel} ${3 * unitsPerPixel}`
                              : undefined
                          }
                          pointerEvents="none"
                        />
                      )}
                      <circle
                        role="slider"
                        aria-label={`${l.source.name}路径点 ${index + 1} ${handle === 0 ? '锚点' : handle === 1 ? '入切线' : '出切线'}`}
                        aria-valuenow={origin.x}
                        tabIndex={0}
                        cx={display.x}
                        cy={display.y}
                        r={4 * unitsPerPixel}
                        fill={
                          handle === 0
                            ? 'var(--accent-primary)'
                            : 'var(--warning)'
                        }
                        stroke="transparent"
                        strokeWidth={18 * unitsPerPixel}
                        style={{
                          pointerEvents: 'all',
                          cursor: 'move',
                          touchAction: 'none',
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          e.currentTarget.focus();
                          store.setPlaying(false);
                          const r = svg.current!.getBoundingClientRect();
                          drag.current = {
                            property,
                            index,
                            handle,
                            data,
                            next: data,
                            screen,
                            x: e.clientX,
                            y: e.clientY,
                            origin,
                            display,
                            sx: width / Math.max(1, r.width),
                            sy: height / Math.max(1, r.height),
                            moved: false,
                            revision: store.getSnapshot().project,
                            time: snapshot.time,
                          };
                        }}
                        onKeyDown={(e) => {
                          if (
                            ![
                              'ArrowLeft',
                              'ArrowRight',
                              'ArrowUp',
                              'ArrowDown',
                            ].includes(e.key)
                          )
                            return;
                          e.preventDefault();
                          e.stopPropagation();
                          const step = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
                          store.run('微调贝塞尔路径', [
                            store.valueCommand(
                              property.id,
                              movePathPoint(
                                data,
                                index,
                                {
                                  x:
                                    origin.x +
                                    (e.key === 'ArrowLeft'
                                      ? -step
                                      : e.key === 'ArrowRight'
                                        ? step
                                        : 0),
                                  y:
                                    origin.y +
                                    (e.key === 'ArrowUp'
                                      ? -step
                                      : e.key === 'ArrowDown'
                                        ? step
                                        : 0),
                                },
                                handle,
                              ),
                            ),
                          ]);
                        }}
                      />
                    </g>
                  );
                });
              })}
            </g>
          );
        })}
    </svg>
  );
}
