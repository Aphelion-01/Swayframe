import { TransformOverlay } from './TransformOverlay';
import { TransformControls } from './TransformControls';
import { createTextMeasurer } from '../renderers/content-bounds';
import { createTransformContext } from '../core/transform-resolvers';
import { transformGizmo } from '../core/transform-gizmo';
import {
  pointerTransformOperation,
  transformItems,
} from '../core/transform-operations';
import { constrainedMove } from '../core/transform-gizmo';
import type { TransformContext } from '../core/transform-context';
import { Icon } from './workspace/icons';
import { sameVisualProject } from '../core/render-invalidation';
import type { Project } from '../core/project-model';
import { readAxisLink } from './axis-link';
import { canvasSnapContext, snapCanvasDelta } from '../core/canvas-snapping';
import type { CanvasSnapContext, SnapGuide } from '../core/canvas-snapping';
import { useInteractionCancel } from './workspace/interaction';
import { ContextMenu } from './workspace/primitives';
import { layerActions } from './workspace/layer-actions';
import { PathEditor } from './PathEditor';
import { TextField } from './fields';
import { layerToWorld } from '../core/transform-geometry';
import { useTools } from './workspace/tools';
import { createLayer } from '../core/project-model';
import { command } from '../core/command-system';
import {
  transformPreviewComposition,
  transformEditCommands,
} from '../core/transform-editing';
import {
  hitTransformHandle,
  worldToLayer,
  transformHandles,
} from '../core/transform-geometry';
import type { HandleKind } from '../core/transform-geometry';
import type { Vec2 } from '../core/core-types';
import type { RenderLayer } from '../core/renderer-core';
import { displayName } from './labels';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { activeComposition } from '../core/project-model';
import { createRenderSnapshot, hitTest } from '../core/renderer-core';
import { Canvas2DRenderer } from '../renderers/canvas2d';
import type { EditorStore } from './editor-store';

export function Canvas({ store }: { store: EditorStore }) {
  const { tool, setTool, space, setSpace } = useTools();
  const penPoints = useRef<Vec2[]>([]);
  const [penPreview, setPenPreview] = useState<readonly Vec2[]>([]);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [menu, setMenu] = useState<{ x: number; y: number }>();
  const [internal, setInternal] = useState<string>();
  const marquee = useRef<
    | {
        start: Vec2;
        end: Vec2;
        selection: readonly string[];
        additive: boolean;
      }
    | undefined
  >(undefined);
  const [marqueeBox, setMarqueeBox] = useState<{ start: Vec2; end: Vec2 }>();
  const drawing = useRef<
    { start: Vec2; end: Vec2; project: unknown } | undefined
  >(undefined);
  const [drawBox, setDrawBox] = useState<{ start: Vec2; end: Vec2 }>();
  const zoomAnchor = useRef<
    { x: number; y: number; u: number; v: number } | undefined
  >(undefined);
  const [anchorMode, setAnchorMode] = useState(false);
  const [snapping, setSnapping] = useState(() => {
    try {
      return localStorage.getItem('motion.canvas-snap') !== 'false';
    } catch {
      return true;
    }
  });
  const [snapGuides, setSnapGuides] = useState<readonly SnapGuide[]>([]);
  const moveSnap = useRef<
    | {
        context: CanvasSnapContext;
        transform: TransformContext;
        axis?: 'x' | 'y';
        start: Vec2;
        project: unknown;
        time: number;
      }
    | undefined
  >(undefined);
  const gesture = useRef<
    | {
        kind: HandleKind;
        context?: TransformContext;
        settings: unknown;
        point: Vec2;
        items: readonly RenderLayer[];
        project: unknown;
        time: number;
        direction?: Vec2;
        linked: boolean;
        moved?: boolean;
      }
    | undefined
  >(undefined);
  const [transformPreview, updateTransformPreview] = useState<
    readonly RenderLayer[] | undefined
  >();
  const latestTransformPreview = useRef<readonly RenderLayer[] | undefined>(
    undefined,
  );
  const setTransformPreview = (items: readonly RenderLayer[] | undefined) => {
    latestTransformPreview.current = items;
    updateTransformPreview(items);
  };
  const [measureVersion, setMeasureVersion] = useState(0);
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const c = activeComposition(view.project);
  const ref = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    store.textMeasure = createTextMeasurer(
      ref.current?.getContext('2d') ?? null,
    );
    setMeasureVersion((version) => version + 1);
    return () => {
      store.textMeasure = undefined;
    };
  }, [store]);
  const pan = useRef<
    | {
        x: number;
        y: number;
        left: number;
        top: number;
        offset: { x: number; y: number };
      }
    | undefined
  >(undefined);
  const [fitWidth, setFitWidth] = useState(0);
  const renderer = useRef(new Canvas2DRenderer());
  useEffect(() => {
    const adapter = renderer.current;
    return () => adapter.dispose();
  }, []);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const rect = container.getBoundingClientRect();
        const canvas = ref.current?.getBoundingClientRect();
        if (canvas)
          zoomAnchor.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            u: (event.clientX - canvas.left) / canvas.width,
            v: (event.clientY - canvas.top) / canvas.height,
          };
        store.setZoom(
          store.getSnapshot().zoom * Math.exp(-event.deltaY * 0.002),
        );
      }
    };
    container.addEventListener('wheel', wheel, { passive: false });
    return () => container.removeEventListener('wheel', wheel);
  }, [store]);
  useLayoutEffect(() => {
    const a = zoomAnchor.current,
      el = containerRef.current;
    if (a && el && ref.current) {
      const rect = ref.current.getBoundingClientRect(),
        container = el.getBoundingClientRect();
      const dx = rect.left - container.left + a.u * rect.width - a.x,
        dy = rect.top - container.top + a.v * rect.height - a.y;
      const previousLeft = el.scrollLeft,
        previousTop = el.scrollTop;
      el.scrollLeft += dx;
      el.scrollTop += dy;
      const residualX = dx - (el.scrollLeft - previousLeft),
        residualY = dy - (el.scrollTop - previousTop);
      if (Math.abs(residualX) > 0.1 || Math.abs(residualY) > 0.1)
        setOffset((previous) => ({
          x: previous.x - residualX,
          y: previous.y - residualY,
        }));
      zoomAnchor.current = undefined;
    }
  }, [view.zoom]);
  useInteractionCancel(() => {
    penPoints.current = [];
    setPenPreview([]);
    setInternal(undefined);
    setMenu(undefined);
    marquee.current = undefined;
    setMarqueeBox(undefined);
    drawing.current = undefined;
    setDrawBox(undefined);
    gesture.current = undefined;
    setTransformPreview(undefined);
    store.cancelDrag();
    moveSnap.current = undefined;
    setSnapGuides([]);
    if (pan.current) setOffset(pan.current.offset);
    pan.current = undefined;
    setSpace(false);
  });
  const finishPen = () => {
    const points = penPoints.current;
    if (points.length < 2) {
      penPoints.current = [];
      setPenPreview([]);
      return;
    }
    const left = Math.min(...points.map((p) => p.x)),
      right = Math.max(...points.map((p) => p.x)),
      top = Math.min(...points.map((p) => p.y)),
      bottom = Math.max(...points.map((p) => p.y)),
      center = { x: (left + right) / 2, y: (top + bottom) / 2 };
    const layer = createLayer('path', {
      position: center,
      width: Math.max(2, right - left),
      height: Math.max(2, bottom - top),
    });
    const editor = layer.editor!;
    const path = editor.properties.path!,
      stroke = editor.properties.strokeWidth!;
    const created = {
      ...layer,
      editor: {
        ...editor,
        pathClosed: false,
        properties: {
          ...editor.properties,
          path: {
            ...path,
            baseValue: points.flatMap((p) => [
              p.x - center.x,
              p.y - center.y,
              p.x - center.x,
              p.y - center.y,
              p.x - center.x,
              p.y - center.y,
            ]),
          },
          strokeWidth: { ...stroke, baseValue: 2 },
        },
      },
    };
    if (
      store.run('钢笔绘制路径', [
        command({ type: 'layer.create', compositionId: c.id, layer: created }),
      ]).ok
    )
      store.select(created.id);
    penPoints.current = [];
    setPenPreview([]);
    setTool('select');
  };
  useEffect(() => {
    const finish = () => finishPen();
    window.addEventListener('motion:finish-path', finish);
    const fit = () => {
      setOffset({ x: 0, y: 0 });
      store.setZoom(1);
      if (containerRef.current) {
        containerRef.current.scrollLeft = 0;
        containerRef.current.scrollTop = 0;
      }
    };
    const actual = () => {
      store.setZoom(c.width / Math.max(1, fitWidth));
    };
    window.addEventListener('motion:actual-size', actual);
    window.addEventListener('motion:fit', fit);
    return () => {
      window.removeEventListener('motion:finish-path', finish);
      window.removeEventListener('motion:fit', fit);
      window.removeEventListener('motion:actual-size', actual);
    };
  });
  const rawRenderProject = store.getRenderProject();
  const lastVisualProject = useRef<Project | undefined>(undefined);
  const renderProject = useMemo(() => {
    const previous = lastVisualProject.current;
    if (
      rawRenderProject === view.project &&
      previous &&
      sameVisualProject(previous, rawRenderProject)
    )
      return previous;
    lastVisualProject.current = rawRenderProject;
    return rawRenderProject;
  }, [rawRenderProject, view.project]);
  const evaluated = useMemo(
    () =>
      createRenderSnapshot(
        activeComposition(renderProject),
        view.time,
        view.selection,
        view.preview,
        renderProject,
      ),
    [renderProject, view.time, view.selection, view.preview],
  );
  const input = useMemo(
    () =>
      transformPreview &&
      gesture.current?.project === view.project &&
      gesture.current?.settings === view.transformSettings
        ? createRenderSnapshot(
            transformPreviewComposition(
              activeComposition(renderProject),
              evaluated,
              transformPreview,
            ),
            view.time,
            view.selection,
            undefined,
            renderProject,
          )
        : evaluated,
    [
      transformPreview,
      transformPreview ? view.project : undefined,
      transformPreview ? view.transformSettings : undefined,
      renderProject,
      evaluated,
      view.time,
      view.selection,
    ],
  );
  const transformContext = useMemo(
    () =>
      createTransformContext(
        input,
        view.selection,
        view.transformSettings,
        store.textMeasure,
      ),
    [input, view.selection, view.transformSettings, measureVersion, store],
  );
  const spatialSelection = [
    ...transformContext.initialTransforms.values(),
  ].some((item) => item.source.editor?.is3D);
  const uiScale = c.width / Math.max(1, fitWidth || c.width) / view.zoom;
  const gizmo = useMemo(
    () => transformGizmo(transformContext, uiScale, store.textMeasure),
    [transformContext, uiScale, store],
  );
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(container);
      const width =
        container.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      const height =
        container.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
      setFitWidth(Math.max(1, Math.min(width, (height * c.width) / c.height)));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [c.width, c.height]);
  useEffect(() => {
    if (ref.current)
      renderer.current.render(
        input,
        ref.current,
        c.width / (ref.current.getBoundingClientRect().width || c.width),
        spatialSelection,
      );
  }, [input, c.width, fitWidth, view.zoom, spatialSelection]);
  useEffect(() => {
    let active = true;
    renderer.current
      .syncAssets(view.project.assets)
      .then(() => {
        if (active && ref.current) {
          const current = store.getSnapshot();
          const snapshot = createRenderSnapshot(
            activeComposition(current.project),
            current.time,
            current.selection,
            undefined,
            current.project,
          );
          renderer.current.render(
            snapshot,
            ref.current,
            snapshot.width /
              (ref.current.getBoundingClientRect().width || snapshot.width),
            snapshot.layers.some(
              (item) =>
                snapshot.selection.includes(item.source.id) &&
                item.source.editor?.is3D === true,
            ),
          );
        }
      })
      .catch(() => {
        if (active) store.setStatus('图片解码失败，请重新导入有效图片', true);
      });
    return () => {
      active = false;
    };
  }, [view.project.assets, store]);
  const point = (event: {
    currentTarget: HTMLCanvasElement;
    clientX: number;
    clientY: number;
  }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * c.width) / rect.width,
      y: ((event.clientY - rect.top) * c.height) / rect.height,
    };
  };
  return (
    <section
      className="canvas-panel"
      aria-label="画布区域"
      tabIndex={0}
      onPointerDownCapture={(event) => event.currentTarget.focus()}
      style={{
        cursor:
          space || tool === 'hand'
            ? 'grab'
            : tool === 'select'
              ? 'default'
              : 'crosshair',
      }}
    >
      <div className="canvas-caption">
        <span className="composition-caption">
          <Icon name="comp" />
          {displayName(c.name)}
        </span>
        <div className="viewport-tools">
          <TransformControls store={store} disabled={spatialSelection} />
          <button
            aria-pressed={anchorMode}
            onClick={() => setAnchorMode(!anchorMode)}
          >
            <Icon name="anchor" />
            <span>锚点</span>
          </button>
          <button
            aria-label="画布吸附"
            aria-pressed={snapping}
            title="吸附到合成与图层边缘/中心 · Alt 临时关闭 · Shift 锁定方向"
            onClick={() => {
              const next = !snapping;
              setSnapping(next);
              try {
                localStorage.setItem('motion.canvas-snap', String(next));
              } catch {
                /* Preferences are optional. */
              }
            }}
          >
            <Icon name="snap" />
          </button>
        </div>
        <span className="composition-meta">
          {c.width} × {c.height} · {c.fps} 帧/秒
        </span>
      </div>
      <div
        className="canvas-scroll"
        ref={containerRef}
        onPointerDownCapture={(event) => {
          if (event.button !== 1 && !space && tool !== 'hand') return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          pan.current = {
            x: event.clientX,
            y: event.clientY,
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
            offset,
          };
        }}
        onPointerMove={(event) => {
          if (!pan.current) return;
          setOffset({
            x: pan.current.offset.x + event.clientX - pan.current.x,
            y: pan.current.offset.y + event.clientY - pan.current.y,
          });
        }}
        onPointerUp={() => {
          pan.current = undefined;
        }}
        onPointerCancel={() => {
          if (pan.current) setOffset(pan.current.offset);
          pan.current = undefined;
        }}
      >
        <div
          className="canvas-fit"
          style={{
            width: fitWidth
              ? `${fitWidth * view.zoom}px`
              : `${view.zoom * 100}%`,
            aspectRatio: `${c.width} / ${c.height}`,
            transform: `translate(${offset.x}px,${offset.y}px)`,
          }}
        >
          <canvas
            ref={ref}
            aria-label="合成画布"
            data-testid="canvas"
            width={c.width}
            height={c.height}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              const p = point(event);
              if (tool !== 'select' && tool !== 'hand') {
                event.currentTarget.setPointerCapture(event.pointerId);
                drawing.current = { start: p, end: p, project: view.project };
                setDrawBox({ start: p, end: p });
                return;
              }
              const selected = input.layers.filter(
                (l) => view.selection.includes(l.source.id) && !l.source.locked,
              );
              const handle = spatialSelection
                ? selected
                    .map((l) =>
                      hitTransformHandle(
                        l,
                        p,
                        8 * uiScale,
                        anchorMode,
                        uiScale,
                      ),
                    )
                    .find(Boolean)
                : [
                    ...(anchorMode
                      ? selected.map((l) => ({
                          kind: 'anchor' as const,
                          point: l.position,
                        }))
                      : []),
                    ...gizmo.handles,
                  ]
                    .filter(
                      (h) =>
                        Math.hypot(h.point.x - p.x, h.point.y - p.y) <=
                        8 * uiScale,
                    )
                    .sort(
                      (a, b) =>
                        Math.hypot(a.point.x - p.x, a.point.y - p.y) -
                        Math.hypot(b.point.x - p.x, b.point.y - p.y),
                    )[0];
              if (handle) {
                event.currentTarget.setPointerCapture(event.pointerId);
                store.setPlaying(false);
                if (handle.kind === 'move') {
                  store.beginDrag(selected[0]!.source.id, p);
                  moveSnap.current = {
                    start: p,
                    project: view.project,
                    time: view.time,
                    transform: store.getDragTransformContext()!,
                    axis: handle.axis,
                    context: canvasSnapContext(evaluated, view.selection),
                  };
                  return;
                }
                gesture.current = {
                  kind: handle.kind,
                  direction:
                    'direction' in handle ? handle.direction : undefined,
                  linked: readAxisLink(selected[0]!.source.transform.scale.id),
                  point: p,
                  items: selected,
                  project: view.project,
                  time: view.time,
                  context:
                    spatialSelection || handle.kind === 'anchor'
                      ? undefined
                      : transformContext,
                  settings: view.transformSettings,
                };
                setTransformPreview(selected);
                return;
              }
              const id = hitTest(input, p);
              if (id) {
                event.currentTarget.setPointerCapture(event.pointerId);
                if (event.shiftKey || event.metaKey || event.ctrlKey)
                  store.select(id, true);
                else {
                  store.beginDrag(id, p);
                  moveSnap.current = {
                    start: p,
                    project: store.getSnapshot().project,
                    time: store.getSnapshot().time,
                    transform: store.getDragTransformContext()!,
                    context: canvasSnapContext(
                      evaluated,
                      store.getSnapshot().selection,
                    ),
                  };
                }
              } else {
                marquee.current = {
                  start: p,
                  end: p,
                  selection: view.selection,
                  additive: event.shiftKey,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
                setMarqueeBox({ start: p, end: p });
                if (!event.shiftKey) store.select(null);
              }
            }}
            onPointerMove={(event) => {
              const g = gesture.current,
                p = point(event);
              if (marquee.current) {
                marquee.current.end = p;
                setMarqueeBox({ ...marquee.current });
                return;
              }
              if (drawing.current) {
                drawing.current.end = p;
                setDrawBox({ ...drawing.current });
                return;
              }
              if (!g) {
                const move = moveSnap.current;
                if (!move) return;
                if (move.project !== view.project || move.time !== view.time) {
                  moveSnap.current = undefined;
                  setSnapGuides([]);
                  store.cancelDrag();
                  return;
                }
                const delta = { x: p.x - move.start.x, y: p.y - move.start.y };
                const constrained = constrainedMove(
                  move.transform,
                  delta,
                  event.shiftKey,
                  move.axis,
                );
                const axis = constrained.worldAxis;
                const snapped = snapCanvasDelta(
                  move.context,
                  constrained.delta,
                  snapping &&
                    !event.altKey &&
                    (!constrained.axis || axis !== undefined)
                    ? (6 * c.width) /
                        Math.max(
                          1,
                          event.currentTarget.getBoundingClientRect().width,
                        )
                    : -1,
                  axis,
                );
                setSnapGuides(snapped.guides);
                store.moveDrag({
                  x: move.start.x + snapped.delta.x,
                  y: move.start.y + snapped.delta.y,
                });
                return;
              }
              if (g.project !== view.project || g.time !== view.time) {
                gesture.current = undefined;
                setTransformPreview(undefined);
                return;
              }
              g.moved = Math.hypot(p.x - g.point.x, p.y - g.point.y) > 1e-8;
              if (g.settings !== view.transformSettings) {
                gesture.current = undefined;
                setTransformPreview(undefined);
                return;
              }
              if (g.context) {
                try {
                  const context =
                    event.altKey && g.kind === 'scale'
                      ? createTransformContext(
                          g.context.snapshot,
                          g.context.selectedLayerIds,
                          { ...g.context.settings, pivotMode: 'anchor' },
                          store.textMeasure,
                        )
                      : g.context;
                  let operation = pointerTransformOperation(
                    context,
                    g.kind as 'scale' | 'rotate',
                    g.point,
                    p,
                    g.direction,
                    g.linked || event.shiftKey,
                  );
                  if (operation.kind === 'rotate' && event.shiftKey)
                    operation = {
                      ...operation,
                      angle: Math.round(operation.angle / 15) * 15,
                    };
                  setTransformPreview(transformItems(context, operation));
                } catch (error) {
                  setTransformPreview(undefined);
                  store.setStatus(
                    error instanceof Error ? error.message : '无法计算变换',
                    true,
                  );
                }
                return;
              }
              const center = g.items.reduce(
                (v, l) => ({
                  x: v.x + l.position.x / g.items.length,
                  y: v.y + l.position.y / g.items.length,
                }),
                { x: 0, y: 0 },
              );
              const screenCenter = g.items.reduce(
                (v, l) => {
                  const p = transformHandles(l).find(
                    (h) => h.kind === 'anchor',
                  )!.point;
                  return {
                    x: v.x + p.x / g.items.length,
                    y: v.y + p.y / g.items.length,
                  };
                },
                { x: 0, y: 0 },
              );
              const ratio = Math.max(
                0.001,
                Math.hypot(p.x - screenCenter.x, p.y - screenCenter.y) /
                  Math.max(
                    1,
                    Math.hypot(
                      g.point.x - screenCenter.x,
                      g.point.y - screenCenter.y,
                    ),
                  ),
              );
              let angle =
                Math.atan2(p.y - screenCenter.y, p.x - screenCenter.x) -
                Math.atan2(
                  g.point.y - screenCenter.y,
                  g.point.x - screenCenter.x,
                );
              if (event.shiftKey && g.kind === 'rotate')
                angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
              setTransformPreview(
                g.items.map((l) =>
                  g.kind === 'scale'
                    ? {
                        ...l,
                        scale: { x: l.scale.x * ratio, y: l.scale.y * ratio },
                        position: {
                          x: center.x + (l.position.x - center.x) * ratio,
                          y: center.y + (l.position.y - center.y) * ratio,
                        },
                      }
                    : g.kind === 'rotate'
                      ? {
                          ...l,
                          rotation: l.rotation + (angle * 180) / Math.PI,
                          position: {
                            x:
                              center.x +
                              (l.position.x - center.x) * Math.cos(angle) -
                              (l.position.y - center.y) * Math.sin(angle),
                            y:
                              center.y +
                              (l.position.x - center.x) * Math.sin(angle) +
                              (l.position.y - center.y) * Math.cos(angle),
                          },
                        }
                      : {
                          ...l,
                          position: {
                            x: l.position.x + p.x - g.point.x,
                            y: l.position.y + p.y - g.point.y,
                          },
                          anchor: {
                            x:
                              (l.anchor?.x ?? 0) +
                              worldToLayer(l, p).x -
                              worldToLayer(l, g.point).x,
                            y:
                              (l.anchor?.y ?? 0) +
                              worldToLayer(l, p).y -
                              worldToLayer(l, g.point).y,
                          },
                        },
                ),
              );
            }}
            onPointerUp={() => {
              moveSnap.current = undefined;
              setSnapGuides([]);
              const m = marquee.current;
              marquee.current = undefined;
              setMarqueeBox(undefined);
              if (m) {
                const left = Math.min(m.start.x, m.end.x),
                  right = Math.max(m.start.x, m.end.x),
                  top = Math.min(m.start.y, m.end.y),
                  bottom = Math.max(m.start.y, m.end.y);
                if (Math.hypot(right - left, bottom - top) > 3) {
                  const ids = input.layers
                    .filter((item) => {
                      if (item.source.locked) return false;
                      const q =
                        item.quad ??
                        [
                          {
                            x: -item.source.width / 2,
                            y: -item.source.height / 2,
                          },
                          {
                            x: item.source.width / 2,
                            y: -item.source.height / 2,
                          },
                          {
                            x: item.source.width / 2,
                            y: item.source.height / 2,
                          },
                          {
                            x: -item.source.width / 2,
                            y: item.source.height / 2,
                          },
                        ].map((p) => layerToWorld(item, p));
                      return (
                        Math.min(...q.map((p) => p.x)) <= right &&
                        Math.max(...q.map((p) => p.x)) >= left &&
                        Math.min(...q.map((p) => p.y)) <= bottom &&
                        Math.max(...q.map((p) => p.y)) >= top
                      );
                    })
                    .map((item) => item.source.id);
                  store.select(null);
                  for (const id of new Set([
                    ...(m.additive ? m.selection : []),
                    ...ids,
                  ]))
                    store.select(id, true);
                }
                return;
              }
              const d = drawing.current;
              drawing.current = undefined;
              setDrawBox(undefined);
              if (d) {
                if (d.project !== store.getSnapshot().project) return;
                const width = Math.max(2, Math.abs(d.end.x - d.start.x)),
                  height = Math.max(2, Math.abs(d.end.y - d.start.y));
                if (tool === 'pen') {
                  const push = (p: Vec2) => {
                    const last = penPoints.current.at(-1);
                    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 1)
                      penPoints.current = [...penPoints.current, p];
                  };
                  push(d.start);
                  if (Math.hypot(d.end.x - d.start.x, d.end.y - d.start.y) > 3)
                    push(d.end);
                  setPenPreview([...penPoints.current]);
                  return;
                }
                const kind =
                  tool === 'text'
                    ? 'text'
                    : tool === 'ellipse'
                      ? 'ellipse'
                      : 'rectangle';
                const layer = createLayer(kind, {
                  position: {
                    x: (d.start.x + d.end.x) / 2,
                    y: (d.start.y + d.end.y) / 2,
                  },
                  width: kind === 'text' && width <= 2 ? 360 : width,
                  height: kind === 'text' && height <= 2 ? 90 : height,
                });
                if (
                  store.run('画布创建图层', [
                    command({
                      type: 'layer.create',
                      compositionId: c.id,
                      layer,
                    }),
                  ]).ok
                )
                  store.select(layer.id);
                setTool('select');
                return;
              }
              const g = gesture.current;
              gesture.current = undefined;
              if (
                g &&
                g.moved &&
                latestTransformPreview.current &&
                g.project === store.getSnapshot().project &&
                g.time === store.getSnapshot().time &&
                g.settings === store.getSnapshot().transformSettings
              ) {
                const commands = transformEditCommands(
                  view.project,
                  evaluated,
                  latestTransformPreview.current,
                  g.kind,
                  view.time,
                  view.autoKeyframes,
                );
                if (commands.length) store.run('画布变换', commands);
              } else if (!g) store.endDrag();
              setTransformPreview(undefined);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              const id = hitTest(input, point(event));
              if (id && !view.selection.includes(id)) store.select(id);
              setMenu({ x: event.clientX, y: event.clientY });
            }}
            onDoubleClick={(event) => {
              if (tool === 'pen') {
                finishPen();
                return;
              }
              const id = hitTest(input, point(event));
              const layer = c.layers.find((l) => l.id === id);
              if (!layer) return;
              store.select(layer.id);
              if (layer.type === 'precomp' && layer.compositionId) {
                store.run('进入预合成', [
                  command({
                    type: 'project.activate',
                    compositionId: layer.compositionId,
                  }),
                ]);
                store.select(null);
              } else if (layer.type === 'text' || layer.type === 'shape')
                setInternal(layer.id);
            }}
            onPointerCancel={() => {
              marquee.current = undefined;
              setMarqueeBox(undefined);
              drawing.current = undefined;
              setDrawBox(undefined);
              gesture.current = undefined;
              setTransformPreview(undefined);
              store.cancelDrag();
              moveSnap.current = undefined;
              setSnapGuides([]);
            }}
            onLostPointerCapture={() => {
              marquee.current = undefined;
              setMarqueeBox(undefined);
              drawing.current = undefined;
              setDrawBox(undefined);
              gesture.current = undefined;
              setTransformPreview(undefined);
              store.cancelDrag();
              moveSnap.current = undefined;
              setSnapGuides([]);
            }}
          />
          {!spatialSelection && view.selection.length > 0 && (
            <TransformOverlay
              store={store}
              context={transformContext}
              gizmo={gizmo}
              uiScale={uiScale}
              anchorMode={anchorMode}
              canvas={ref}
            />
          )}
          {snapGuides.length > 0 && (
            <svg
              className="canvas-snap-guides"
              aria-label="画布吸附参考线"
              viewBox={`0 0 ${c.width} ${c.height}`}
            >
              {snapGuides.map((guide) => (
                <line
                  key={guide.axis}
                  x1={guide.axis === 'x' ? guide.value : 0}
                  x2={guide.axis === 'x' ? guide.value : c.width}
                  y1={guide.axis === 'y' ? guide.value : 0}
                  y2={guide.axis === 'y' ? guide.value : c.height}
                />
              ))}
            </svg>
          )}
          {penPreview.length > 0 && (
            <svg className="pen-preview" viewBox={`0 0 ${c.width} ${c.height}`}>
              <polyline
                points={penPreview.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#8dafff"
                strokeWidth={Math.max(
                  2,
                  c.width / Math.max(1, fitWidth) / view.zoom,
                )}
              />
              {penPreview.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={Math.max(
                    3,
                    (c.width / Math.max(1, fitWidth) / view.zoom) * 3,
                  )}
                  fill="#8dafff"
                />
              ))}
            </svg>
          )}
          {marqueeBox && (
            <div
              className="draw-preview"
              style={{
                left: `${(Math.min(marqueeBox.start.x, marqueeBox.end.x) / c.width) * 100}%`,
                top: `${(Math.min(marqueeBox.start.y, marqueeBox.end.y) / c.height) * 100}%`,
                width: `${(Math.abs(marqueeBox.end.x - marqueeBox.start.x) / c.width) * 100}%`,
                height: `${(Math.abs(marqueeBox.end.y - marqueeBox.start.y) / c.height) * 100}%`,
              }}
            />
          )}
          {drawBox && (
            <div
              className="draw-preview"
              style={{
                left: `${(Math.min(drawBox.start.x, drawBox.end.x) / c.width) * 100}%`,
                top: `${(Math.min(drawBox.start.y, drawBox.end.y) / c.height) * 100}%`,
                width: `${(Math.abs(drawBox.end.x - drawBox.start.x) / c.width) * 100}%`,
                height: `${(Math.abs(drawBox.end.y - drawBox.start.y) / c.height) * 100}%`,
                borderRadius: tool === 'ellipse' ? '50%' : 0,
              }}
            />
          )}
        </div>
      </div>
      {menu && (
        <ContextMenu
          {...menu}
          items={layerActions(store, () =>
            window.dispatchEvent(new Event('motion:rename')),
          )}
          onClose={() => setMenu(undefined)}
        />
      )}
      {internal &&
        (() => {
          const layer = c.layers.find((l) => l.id === internal);
          return layer?.type === 'text' ? (
            <div className="canvas-text-edit">
              <TextField
                label="画布文字编辑"
                multiline
                autoFocus
                value={layer.text}
                onCommit={(text) =>
                  store.run('编辑文字', [
                    command({
                      type: 'layer.patch',
                      compositionId: c.id,
                      layerId: layer.id,
                      patch: { text },
                    }),
                  ])
                }
              />
              <button onClick={() => setInternal(undefined)}>
                完成文字编辑
              </button>
            </div>
          ) : layer?.editor?.properties.path ? (
            <PathEditor
              store={store}
              property={
                layer.editor.properties
                  .path as import('../core/project-model').Property<
                  readonly number[]
                >
              }
              onClose={() => setInternal(undefined)}
            />
          ) : null;
        })()}
      <div className="canvas-bottom">
        <span>
          {view.selection.length
            ? `${view.selection.length} 个图层`
            : `${c.width} × ${c.height}`}
        </span>
        <button
          title="缩放到所选图层"
          disabled={!view.selection.length}
          onClick={() => {
            const selected = input.layers.filter((l) =>
              view.selection.includes(l.source.id),
            );
            const points = selected.flatMap<Vec2>(
              (item) =>
                item.quad ??
                [
                  { x: -item.source.width / 2, y: -item.source.height / 2 },
                  { x: item.source.width / 2, y: item.source.height / 2 },
                ].map((p) => layerToWorld(item, p)),
            );
            const left = Math.min(...points.map((p) => p.x)),
              right = Math.max(...points.map((p) => p.x)),
              top = Math.min(...points.map((p) => p.y)),
              bottom = Math.max(...points.map((p) => p.y));
            const el = containerRef.current;
            if (!el) return;
            zoomAnchor.current = {
              x: el.clientWidth / 2,
              y: el.clientHeight / 2,
              u: (left + right) / 2 / c.width,
              v: (top + bottom) / 2 / c.height,
            };
            store.setZoom(
              ((Math.min(
                el.clientWidth / Math.max(1, right - left),
                el.clientHeight / Math.max(1, bottom - top),
              ) *
                c.width) /
                Math.max(1, fitWidth)) *
                0.8,
            );
          }}
        >
          选区
        </button>
        <label>
          缩放{' '}
          <select
            aria-label="画布缩放"
            value={view.zoom}
            onChange={(event) => {
              if (event.target.value === 'actual')
                store.setZoom(c.width / Math.max(1, fitWidth));
              else if (event.target.value === 'double')
                store.setZoom((c.width * 2) / Math.max(1, fitWidth));
              else {
                store.setZoom(Number(event.target.value));
                if (Number(event.target.value) === 1) {
                  setOffset({ x: 0, y: 0 });
                  if (containerRef.current) {
                    containerRef.current.scrollLeft = 0;
                    containerRef.current.scrollTop = 0;
                  }
                }
              }
            }}
          >
            <option value={0.5}>50%</option>
            <option value={1}>适合窗口</option>
            <option value="actual">100% 实际尺寸</option>
            <option value="double">200% 实际尺寸</option>
            <option value={2}>200%</option>
            <option value={4}>400%</option>
            {![0.5, 1, 1.5, 2, 4].includes(view.zoom) && (
              <option value={view.zoom}>{Math.round(view.zoom * 100)}%</option>
            )}
          </select>
        </label>
      </div>
    </section>
  );
}
