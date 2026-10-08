import { evaluateProperty } from '../core/animation-engine';
import { apply2D } from '../core/matrix2d';
import { useEffect, useRef } from 'react';
import type { AnimValue, Vec2 } from '../core/core-types';
import type { Property } from '../core/project-model';
import { findProperty } from '../core/project-model';
import { command } from '../core/command-system';
import {
  spatialPoint,
  spatialPoint3,
  spatialControls,
  spatialControls3,
} from '../core/spatial-path';
import {
  motionPathPoint,
  screenPathDelta,
} from '../core/motion-path-projection';
import { projectPoint, point4 } from '../core/perspective';
import type { RenderSnapshot } from '../core/renderer-core';
import type { SpatialProjector } from './ThreeDGizmo';
import type { EditorStore } from './editor-store';
import { useEditorSlice } from './use-editor-slice';
import { usePointerRelease } from './workspace/pointer-release';
import { useInteractionCancel } from './workspace/interaction';
type Patch = {
  value?: AnimValue;
  spatialIncoming?: Vec2 | readonly number[];
  spatialOutgoing?: Vec2 | readonly number[];
};
type Drag = {
  property: Property<AnimValue>;
  key: string;
  field: keyof Patch;
  value: AnimValue;
  next: AnimValue;
  x: number;
  y: number;
  screen: (value: AnimValue) => { x: number; y: number } | null;
  sx: number;
  sy: number;
  revision: object;
  time: number;
};
const components = (value: AnimValue): number[] =>
  Array.isArray(value) ? [...value] : [(value as Vec2).x, (value as Vec2).y];
const fromComponents = (base: AnimValue, values: number[]): AnimValue =>
  Array.isArray(base) ? values : { x: values[0]!, y: values[1]! };
export function MotionPathOverlay({
  store,
  snapshot,
  width,
  height,
  project,
  unitsPerPixel = 1,
  editable = true,
}: {
  store: EditorStore;
  snapshot: RenderSnapshot;
  width: number;
  height: number;
  project?: SpatialProjector;
  unitsPerPixel?: number;
  editable?: boolean;
}) {
  const view = useEditorSlice(store, [
    'selection',
    'showMotionPaths',
    'project',
    'selectedProperties',
  ]);
  const drag = useRef<Drag | undefined>(undefined);
  const cancel = () => {
    if (drag.current) {
      drag.current = undefined;
      store.setPropertyPreview(undefined);
    }
  };
  const sample = (e: Pick<PointerEvent, 'clientX' | 'clientY'>) => {
    const d = drag.current;
    if (!d) return;
    const start = d.screen(d.value);
    if (!start) return;
    const target = {
      x: start.x + (e.clientX - d.x) * d.sx,
      y: start.y + (e.clientY - d.y) * d.sy,
    };
    let values = components(d.value);
    // Re-project each correction so perspective handles remain under the pointer.
    for (let iteration = 0; iteration < 8; iteration++) {
      const p = d.screen(fromComponents(d.value, values));
      if (!p) return;
      const dx = target.x - p.x,
        dy = target.y - p.y;
      if (Math.hypot(dx, dy) < 0.001) break;
      const vectors = values.map((_, i) => {
        const q = d.screen(
          fromComponents(
            d.value,
            values.map((n, j) => n + (i === j ? 1 : 0)),
          ),
        );
        return q ? { x: q.x - p.x, y: q.y - p.y } : { x: 0, y: 0 };
      });
      const delta = screenPathDelta(vectors, dx, dy);
      if (!delta) return;
      values = values.map((n, i) => n + delta[i]!);
      if (!values.every((n) => Number.isFinite(n) && Math.abs(n) < 1e7)) return;
    }
    d.next = fromComponents(d.value, values);
    store.setPropertyPreview({
      id: d.property.id,
      property: {
        ...d.property,
        keyframes: d.property.keyframes.map((k) =>
          k.id === d.key ? { ...k, [d.field]: d.next } : k,
        ),
      },
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
        store.getSnapshot().time === d.time &&
        components(d.next).some(
          (n, i) => Math.abs(n - components(d.value)[i]!) > 1e-8,
        )
      )
        store.run('编辑运动路径', [
          command({
            type: 'keyframe.update',
            propertyId: d.property.id,
            keyframeId: d.key,
            patch: { [d.field]: d.next },
          }),
        ]);
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
    const d = drag.current;
    if (d && (view.project !== d.revision || snapshot.time !== d.time))
      cancel();
  }, [view.project, snapshot.time]);
  if (!view.showMotionPaths) return null;
  return (
    <svg
      className="motion-path-overlay"
      viewBox={`0 0 ${width} ${height}`}
      aria-label={project ? '三维空间运动路径' : '预览运动路径'}
    >
      {snapshot.layers
        .filter((frame) => view.selection.includes(frame.source.id))
        .map((frame) => {
          const source = frame.source,
            candidates =
              source.type === 'camera'
                ? [source.editor?.properties.cameraPosition]
                : source.editor?.is3D
                  ? [
                      source.editor.properties.position3D,
                      source.transform.position,
                    ]
                  : [source.transform.position];
          const property =
            candidates.find(
              (p) =>
                p &&
                view.selectedProperties.includes(p.id) &&
                p.keyframes.length > 1,
            ) ?? candidates.find((p) => p && p.keyframes.length > 1);
          if (!property) return null;
          const is3D = source.type === 'camera' || source.editor?.is3D;
          const screen = (v: AnimValue) => {
            let world = motionPathPoint(frame, property, v, snapshot);
            if (project) {
              if (!is3D)
                world = [
                  world[0] - snapshot.width / 2,
                  world[1] - snapshot.height / 2,
                  0,
                ];
              return project(world);
            }
            return is3D && snapshot.camera
              ? projectPoint(world, snapshot.camera)
              : { x: world[0], y: world[1], z: 0 };
          };
          const keys = [...property.keyframes].sort((a, b) => a.time - b.time),
            last = screen(keys[keys.length - 1]!.value),
            first = screen(keys[0]!.value);
          const currentValue = evaluateProperty(property, snapshot.time),
            origin = screen(currentValue);
          const ghost =
            last && origin
              ? (() => {
                  if (is3D && frame.world3D) {
                    const delta = motionPathPoint(
                      frame,
                      property,
                      keys[keys.length - 1]!.value,
                      snapshot,
                    ).map(
                      (n, i) =>
                        n -
                        motionPathPoint(
                          frame,
                          property,
                          currentValue,
                          snapshot,
                        )[i]!,
                    );
                    return [
                      [-1, -1],
                      [1, -1],
                      [1, 1],
                      [-1, 1],
                    ].map(([x, y]) => {
                      const q = point4(frame.world3D!, [
                        (x! * source.width) / 2,
                        (y! * source.height) / 2,
                        0,
                      ]).map(
                        (n, i) => n + delta[i]!,
                      ) as unknown as import('../core/perspective').Point3;
                      return project
                        ? project(q)
                        : snapshot.camera
                          ? projectPoint(q, snapshot.camera)
                          : null;
                    });
                  }
                  const corners = [
                    [-1, -1],
                    [1, -1],
                    [1, 1],
                    [-1, 1],
                  ].map(([x, y]) => {
                    const q = apply2D(frame.matrix!, {
                      x: (x! * source.width) / 2,
                      y: (y! * source.height) / 2,
                    });
                    const p = project
                      ? project([
                          q.x - snapshot.width / 2,
                          q.y - snapshot.height / 2,
                          0,
                        ])
                      : q;
                    return p
                      ? {
                          x: p.x + last.x - origin.x,
                          y: p.y + last.y - origin.y,
                        }
                      : null;
                  });
                  return corners;
                })()
              : undefined;
          const handle = (
            value: AnimValue,
            key: string,
            field: keyof Patch,
            label: string,
            kind: 'key' | 'control',
          ) => {
            const p = screen(value);
            if (!p) return null;
            const r = (kind === 'key' ? 4 : 3) * unitsPerPixel;
            return (
              <g key={key + field}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={
                    kind === 'key'
                      ? 'var(--accent-primary)'
                      : 'var(--background-primary)'
                  }
                  stroke="var(--accent-primary)"
                  strokeWidth={unitsPerPixel}
                />
                {editable && !source.locked && (
                  <circle
                    role="slider"
                    tabIndex={0}
                    aria-label={label}
                    aria-valuenow={components(value)[0]}
                    aria-valuetext={components(value)
                      .map((n) => n.toFixed(1))
                      .join(', ')}
                    cx={p.x}
                    cy={p.y}
                    r={12 * unitsPerPixel}
                    fill="transparent"
                    style={{ pointerEvents: 'all', cursor: 'grab' }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      e.stopPropagation();
                      store.setPlaying(false);
                      const rect =
                          e.currentTarget.ownerSVGElement!.getBoundingClientRect(),
                        base = components(value);
                      const vectors = base.map((_, i) => {
                        const v = fromComponents(
                            value,
                            base.map((n, j) => n + (i === j ? 1 : 0)),
                          ),
                          q = screen(v);
                        return q
                          ? { x: q.x - p.x, y: q.y - p.y }
                          : { x: 0, y: 0 };
                      });
                      if (!screenPathDelta(vectors, 1, 1)) {
                        store.setStatus(
                          '当前视角无法拖动路径，请旋转视角后重试',
                          true,
                        );
                        return;
                      }
                      const original = findProperty(
                        store.getSnapshot().project,
                        property.id,
                      ).property;
                      drag.current = {
                        property: original,
                        key,
                        field,
                        value,
                        next: value,
                        x: e.clientX,
                        y: e.clientY,
                        screen,
                        sx: width / (rect.width || width),
                        sy: height / (rect.height || height),
                        revision: store.getSnapshot().project,
                        time: store.getSnapshot().time,
                      };
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        cancel();
                      }
                      if (
                        [
                          'ArrowLeft',
                          'ArrowRight',
                          'ArrowUp',
                          'ArrowDown',
                        ].includes(e.key)
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        store.setPlaying(false);
                        const axis = ['ArrowUp', 'ArrowDown'].includes(e.key)
                            ? 1
                            : 0,
                          direction = ['ArrowLeft', 'ArrowUp'].includes(e.key)
                            ? -1
                            : 1;
                        const next = fromComponents(
                          value,
                          components(value).map(
                            (n, i) =>
                              n +
                              (i === axis
                                ? direction *
                                  (e.shiftKey ? 10 : e.altKey ? 0.1 : 1)
                                : 0),
                          ),
                        );
                        store.run('微调运动路径', [
                          command({
                            type: 'keyframe.update',
                            propertyId: property.id,
                            keyframeId: key,
                            patch: { [field]: next },
                          }),
                        ]);
                      }
                    }}
                  />
                )}
              </g>
            );
          };
          return (
            <g key={source.id}>
              {keys.slice(0, -1).map((left, i) => {
                const right = keys[i + 1]!,
                  vector = Array.isArray(left.value),
                  controls = vector
                    ? spatialControls3(left, right)
                    : spatialControls(left, right);
                const out = screen(controls.out),
                  incoming = screen(controls.in),
                  a = screen(left.value),
                  b = screen(right.value);
                const points = Array.from({ length: 41 }, (_, j) =>
                  screen(
                    vector
                      ? spatialPoint3(left, right, j / 40)
                      : spatialPoint(left, right, j / 40),
                  ),
                );
                return (
                  <g key={left.id}>
                    <path
                      d={points
                        .map((p, j) =>
                          p
                            ? `${j && points[j - 1] ? 'L' : 'M'}${p.x},${p.y}`
                            : '',
                        )
                        .join(' ')}
                      fill="none"
                      stroke="var(--accent-primary)"
                      strokeWidth={1.6 * unitsPerPixel}
                    />
                    <g
                      stroke="var(--accent-primary)"
                      strokeDasharray={`${3 * unitsPerPixel} ${3 * unitsPerPixel}`}
                      strokeWidth={unitsPerPixel}
                    >
                      {a && out && (
                        <line x1={a.x} y1={a.y} x2={out.x} y2={out.y} />
                      )}
                      {b && incoming && (
                        <line
                          x1={b.x}
                          y1={b.y}
                          x2={incoming.x}
                          y2={incoming.y}
                        />
                      )}
                    </g>
                    {handle(
                      controls.out,
                      left.id,
                      'spatialOutgoing',
                      `路径 K${i + 1} 出控制点`,
                      'control',
                    )}
                    {handle(
                      controls.in,
                      right.id,
                      'spatialIncoming',
                      `路径 K${i + 2} 入控制点`,
                      'control',
                    )}
                  </g>
                );
              })}
              {keys.map((k, i) =>
                handle(k.value, k.id, 'value', `路径关键帧 K${i + 1}`, 'key'),
              )}
              {first && (
                <text
                  x={first.x + 8 * unitsPerPixel}
                  y={first.y - 10 * unitsPerPixel}
                  fontSize={11 * unitsPerPixel}
                  fill="var(--accent-primary)"
                >
                  起点
                </text>
              )}
              {last && (
                <g
                  aria-label="最终位置"
                  stroke="var(--accent-primary)"
                  fill="none"
                  strokeWidth={unitsPerPixel}
                  strokeDasharray={`${5 * unitsPerPixel} ${4 * unitsPerPixel}`}
                >
                  {ghost?.every(Boolean) && source.type !== 'camera' && (
                    <polygon
                      points={ghost.map((p) => `${p!.x},${p!.y}`).join(' ')}
                    />
                  )}
                  <circle cx={last.x} cy={last.y} r={12 * unitsPerPixel} />
                  <g
                    transform={`translate(${Math.max(4 * unitsPerPixel, Math.min(width - 152 * unitsPerPixel, last.x + 16 * unitsPerPixel))},${Math.max(20 * unitsPerPixel, last.y - 24 * unitsPerPixel)})`}
                    stroke="none"
                  >
                    <rect
                      x={-4 * unitsPerPixel}
                      y={-13 * unitsPerPixel}
                      width={148 * unitsPerPixel}
                      height={19 * unitsPerPixel}
                      rx={3 * unitsPerPixel}
                      fill="var(--background-primary)"
                      fillOpacity="0.9"
                    />
                    <text
                      fontSize={11 * unitsPerPixel}
                      fill="var(--accent-primary)"
                    >
                      结束位置 · {keys[keys.length - 1]!.time.toFixed(2)} 秒
                    </text>
                  </g>
                </g>
              )}
            </g>
          );
        })}
    </svg>
  );
}
