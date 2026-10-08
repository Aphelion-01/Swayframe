import { CameraSpaceOverlay } from './CameraSpaceOverlay';
import { MotionPathOverlay } from './MotionPathOverlay';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EditorStore } from './editor-store';
import { useEditorSlice } from './use-editor-slice';
import { activeComposition } from '../core/project-model';
import { createRenderSnapshot } from '../core/renderer-core';
import {
  point4,
  projectPoint as cameraProjectPoint,
  type Point3,
} from '../core/perspective';
import {
  defaultSpatialView,
  spatialBasis,
  spatialProject,
  spatialSegment,
  spatialCamera,
  navigateSpatialWheel,
  orbitSpatialView,
  type SpatialView,
} from '../core/spatial-view';
import { Canvas2DRenderer } from '../renderers/canvas2d';
import { ThreeDGizmo, type SpatialGizmoMode } from './ThreeDGizmo';
import { usePointerRelease } from './workspace/pointer-release';
import { useInteractionCancel } from './workspace/interaction';
export function SpatialViewport({
  store,
  onClose,
  gizmoMode = 'translate',
}: {
  store: EditorStore;
  onClose: () => void;
  gizmoMode?: SpatialGizmoMode;
}) {
  const v = useEditorSlice(store, [
    'project',
    'time',
    'selection',
    'propertyPreview',
    'propertyPreviews',
  ]);
  const image = useRef<HTMLCanvasElement>(null);
  const [renderer] = useState(() => new Canvas2DRenderer());
  useEffect(() => () => renderer.dispose(), [renderer]);
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [view, setView] = useState<SpatialView>(defaultSpatialView);
  useEffect(() => {
    const element = root.current;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const bounds = element!.getBoundingClientRect();
      setView((s) =>
        navigateSpatialWheel(
          s,
          event,
          bounds.width || 600,
          bounds.height || 400,
        ),
      );
    };
    element?.addEventListener('wheel', wheel, { passive: false });
    return () => element?.removeEventListener('wheel', wheel);
  }, []);

  const drag = useRef<
    { x: number; y: number; view: SpatialView; pan: boolean } | undefined
  >(undefined);
  useEffect(() => {
    if (!root.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: Math.max(1, entry.contentRect.width),
          height: Math.max(1, entry.contentRect.height),
        });
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const project = store.getRenderProject(),
    c = activeComposition(project),
    snapshot = createRenderSnapshot(c, v.time, v.selection, undefined, project);
  const spatialFrame = useMemo(() => {
    const camera = spatialCamera(view, size.width, size.height);
    return {
      ...snapshot,
      camera,
      width: size.width,
      height: size.height,
      backgroundColor: { r: 0, g: 0, b: 0, a: 0 },
      selection: [],
      layers: snapshot.layers
        .filter((l) => l.source.editor?.is3D && l.world3D)
        .map((l) => {
          const quad = (
            [
              [-l.source.width / 2, -l.source.height / 2, 0],
              [l.source.width / 2, -l.source.height / 2, 0],
              [l.source.width / 2, l.source.height / 2, 0],
              [-l.source.width / 2, l.source.height / 2, 0],
            ] as Point3[]
          ).map((p) => cameraProjectPoint(point4(l.world3D!, p), camera));
          return {
            ...l,
            quad: quad.every(Boolean)
              ? (quad as NonNullable<typeof l.quad>)
              : undefined,
            active:
              v.time >= (l.source.editor?.inPoint ?? 0) &&
              v.time < (l.source.editor?.outPoint ?? c.duration) &&
              (l.source.type === 'model' || quad.every(Boolean)),
          };
        })
        .sort((a, b) => (b.quad?.[0]?.z ?? 0) - (a.quad?.[0]?.z ?? 0)),
    };
  }, [snapshot, view, size, v.time, c.duration]);
  const latestFrame = useRef(spatialFrame);
  latestFrame.current = spatialFrame;
  useEffect(() => {
    if (image.current) renderer.render(spatialFrame, image.current, 1, false);
  }, [renderer, spatialFrame]);
  useEffect(() => {
    let cancelled = false;
    void renderer
      .syncAssets(project.assets)
      .then(() => {
        if (!cancelled && image.current)
          renderer.render(latestFrame.current, image.current, 1, false);
      })
      .catch(() => {
        /* Main preview reports media failures. */
      });
    return () => {
      cancelled = true;
    };
  }, [renderer, project.assets]);
  const projectPoint = (p: Point3) =>
    spatialProject(p, view, size.width, size.height);
  const cancel = () => {
    if (drag.current) setView(drag.current.view);
    drag.current = undefined;
  };
  const moveView = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (d.pan) {
      const b = spatialBasis(d.view),
        scale = d.view.distance / (Math.min(size.width, size.height) * 1.25);
      setView({
        ...d.view,
        target: d.view.target.map(
          (n, i) => n - (dx * b.right[i]! + dy * b.down[i]!) * scale,
        ) as unknown as Point3,
      });
    } else setView(orbitSpatialView(d.view, dx * 0.006, dy * 0.006));
  };
  usePointerRelease({
    active: () => !!drag.current,
    move: moveView,
    finish: (e) => {
      moveView(e);
      drag.current = undefined;
    },
    cancel,
  });
  useInteractionCancel(cancel);
  const focus = () => {
    const selected = snapshot.layers.filter(
      (l) => v.selection.includes(l.source.id) && l.world3D,
    );
    const p = selected[0]?.world3D;
    setView((s) => ({
      ...s,
      target: p ? point4(p, [0, 0, 0]) : [0, 0, 0],
      orbitOrigin: p ? point4(p, [0, 0, 0]) : [0, 0, 0],
      distance: selected.length
        ? Math.max(
            400,
            ...selected.map(
              (l) => Math.max(l.source.width, l.source.height) * 3,
            ),
          )
        : 2200,
    }));
  };
  const line = (
    a: Point3,
    b: Point3,
    key: string,
    color: string,
    major = false,
  ) => {
    const segment = spatialSegment(a, b, view, size.width, size.height);
    if (!segment) return null;
    const [p, q] = segment;
    return (
      <line
        key={key}
        x1={p.x}
        y1={p.y}
        x2={q.x}
        y2={q.y}
        stroke={color}
        strokeWidth={major ? 1.2 : 0.6}
      />
    );
  };
  const span = 5000,
    step = 100;
  return (
    <section className="spatial-viewport" aria-label="三维空间预览">
      <header>
        <strong>3D 空间</strong>
        <button onClick={focus}>聚焦选区</button>
        <select
          aria-label="空间查看方向"
          value=""
          onChange={(e) => {
            const dir = e.target.value;
            setView((s) => ({
              ...s,
              yaw: dir === 'right' ? Math.PI / 2 : 0,
              pitch: dir === 'top' ? Math.PI / 2 - 0.001 : 0,
              orthographic: true,
            }));
          }}
        >
          <option value="" disabled>
            视图
          </option>
          <option value="front">正视 · 1</option>
          <option value="right">右视 · 3</option>
          <option value="top">顶视 · 7</option>
        </select>
        <button
          aria-pressed={view.orthographic}
          onClick={() =>
            setView((s) => ({ ...s, orthographic: !s.orthographic }))
          }
        >
          {view.orthographic ? '正交' : '透视'}
        </button>
        <button aria-label="关闭三维空间预览" onClick={onClose}>
          ×
        </button>
      </header>
      <div
        className="spatial-viewport-stage"
        ref={root}
        tabIndex={0}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.target as Element).closest('input,select,button')) return;
          if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            focus();
          }
          if (['1', '3', '7', '5'].includes(e.key)) {
            e.preventDefault();
            setView((s) =>
              e.key === '5'
                ? { ...s, orthographic: !s.orthographic }
                : {
                    ...s,
                    yaw: e.key === '3' ? Math.PI / 2 : 0,
                    pitch: e.key === '7' ? Math.PI / 2 - 0.001 : 0,
                    orthographic: true,
                  },
            );
          }
        }}
        onPointerDown={(e) => {
          if (e.button !== 1 && !(e.altKey && [0, 2].includes(e.button)))
            return;
          e.preventDefault();
          e.currentTarget.focus();
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            view,
            pan: e.shiftKey || e.button === 2,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
      >
        <svg
          viewBox={`0 0 ${size.width} ${size.height}`}
          aria-label="三维坐标轴网格"
          className="spatial-grid"
        >
          {Array.from({ length: 101 }, (_, i) => {
            const n = (i - 50) * step;
            return (
              <g key={i}>
                {line(
                  [n, 0, -span],
                  [n, 0, span],
                  `x${i}`,
                  'var(--border-subtle)',
                  i % 5 === 0,
                )}
                {line(
                  [-span, 0, n],
                  [span, 0, n],
                  `z${i}`,
                  'var(--border-subtle)',
                  i % 5 === 0,
                )}
              </g>
            );
          })}
          {line([-span, 0, 0], [span, 0, 0], 'X', 'var(--axis-x)', true)}
          {line([0, -span, 0], [0, span, 0], 'Y', 'var(--axis-y)', true)}
          {line([0, 0, -span], [0, 0, span], 'Z', 'var(--axis-z)', true)}
        </svg>
        <canvas
          ref={image}
          className="spatial-content"
          aria-label="三维图层渲染预览"
        />
        <svg
          className="spatial-scene"
          viewBox={`0 0 ${size.width} ${size.height}`}
          aria-label="三维图层选区"
        >
          {snapshot.layers
            .filter(
              (l) =>
                l.world3D &&
                l.source.editor?.is3D &&
                l.source.visible &&
                v.time >= (l.source.editor?.inPoint ?? 0) &&
                v.time < (l.source.editor?.outPoint ?? c.duration) &&
                l.source.type !== 'null' &&
                l.source.type !== 'camera',
            )
            .sort(
              (a, b) =>
                (projectPoint(point4(b.world3D!, [0, 0, 0]))?.z ?? 0) -
                (projectPoint(point4(a.world3D!, [0, 0, 0]))?.z ?? 0),
            )
            .map((l) => {
              const p = (
                [
                  [-l.source.width / 2, -l.source.height / 2, 0],
                  [l.source.width / 2, -l.source.height / 2, 0],
                  [l.source.width / 2, l.source.height / 2, 0],
                  [-l.source.width / 2, l.source.height / 2, 0],
                ] as Point3[]
              ).map((p) => projectPoint(point4(l.world3D!, p)));
              if (p.some((p) => !p)) return null;
              return (
                <g key={l.source.id}>
                  <polygon
                    role="button"
                    tabIndex={0}
                    aria-label={`空间选择 ${l.source.name}`}
                    points={p.map((p) => `${p!.x},${p!.y}`).join(' ')}
                    fill="transparent"
                    stroke={
                      v.selection.includes(l.source.id)
                        ? 'var(--accent-primary)'
                        : 'var(--text-muted)'
                    }
                    strokeWidth={v.selection.includes(l.source.id) ? 2 : 1}
                    onPointerDown={(e) => {
                      if (e.button === 0 && !e.altKey) {
                        e.stopPropagation();
                        store.select(l.source.id, e.shiftKey);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        store.select(l.source.id, e.shiftKey);
                    }}
                  />
                  <text
                    x={p[0]!.x}
                    y={p[0]!.y - 8}
                    fill="var(--text-secondary)"
                    fontSize="11"
                  >
                    {l.source.name}
                  </text>
                </g>
              );
            })}
        </svg>
        <CameraSpaceOverlay
          store={store}
          snapshot={snapshot}
          project={projectPoint}
          width={size.width}
          height={size.height}
        />
        <MotionPathOverlay
          store={store}
          snapshot={snapshot}
          project={projectPoint}
          width={size.width}
          height={size.height}
        />
        <ThreeDGizmo
          store={store}
          mode={gizmoMode}
          snapshot={snapshot}
          project={projectPoint}
          width={size.width}
          height={size.height}
        />
        <div className="spatial-axis-compass" aria-label="空间轴向">
          {['X', 'Y', 'Z'].map((axis, i) => {
            const origin = spatialProject(
                [0, 0, 0],
                { ...view, distance: 2200, target: [0, 0, 0] },
                80,
                80,
              )!,
              p = spatialProject(
                [i === 0 ? 500 : 0, i === 1 ? 500 : 0, i === 2 ? 500 : 0],
                { ...view, distance: 2200, target: [0, 0, 0] },
                80,
                80,
              )!;
            return (
              <svg key={axis} viewBox="0 0 80 80">
                <line
                  x1="40"
                  y1="40"
                  x2={40 + (p.x - origin.x)}
                  y2={40 + (p.y - origin.y)}
                  stroke={`var(--axis-${axis.toLowerCase()})`}
                />
                <text
                  x={40 + (p.x - origin.x)}
                  y={40 + (p.y - origin.y)}
                  fill={`var(--axis-${axis.toLowerCase()})`}
                >
                  {axis}
                </text>
              </svg>
            );
          })}
        </div>
      </div>
      <footer>
        双指绕转 · Shift 双指平移 · 捏合缩放 · 中键绕转 · F 聚焦 · 1/3/7 视图 ·
        5 正交/透视 · 网格 100 px
      </footer>
    </section>
  );
}
