import { SpatialViewport } from './SpatialViewport';
import { ThreeDGizmo } from './ThreeDGizmo';
import { CanvasAids, type CanvasAidSettings } from './CanvasAids';
import { projectPoint } from '../core/perspective';
import { pathSvg } from '../core/shape-geometry';
import { useEditorSlice } from './use-editor-slice';
import {
  CanvasInteractionState,
  canvasInteractionTokens,
  canvasInteractionModifiers,
} from './workspace/canvas-interaction';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  screenToComposition,
  continuousRotation,
  scaleCursor,
} from '../core/canvas-coordinates';
import { boundsCorners, getWorldBounds } from '../core/layer-bounds';
import { localTransformValues } from '../core/transform-editing';
import {
  createTransformGuideModel,
  hitTransformRotationGuide,
} from '../core/transform-guidance';
import { guidanceFor } from './transform-guidance-controller';
import { TransformOverlay } from './TransformOverlay';
import {
  TransformControls,
  orientationLabels,
  orientationDescriptions,
  pivotLabels,
  pivotDescriptions,
} from './TransformControls';
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
import { canvasSnapContext, snapCanvasDelta } from '../core/canvas-snapping';
import type { CanvasSnapContext, SnapGuide } from '../core/canvas-snapping';
import { useInteractionCancel } from './workspace/interaction';
import { ContextMenu, MenuDropdown } from './workspace/primitives';
import { layerActions } from './workspace/layer-actions';
import { PathEditor } from './PathEditor';
import { TextField } from './fields';
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

type PenPoint = Vec2 & { incoming: Vec2; outgoing: Vec2 };
function penPoint(start: Vec2, end: Vec2): PenPoint {
  return {
    ...start,
    incoming: { x: 2 * start.x - end.x, y: 2 * start.y - end.y },
    outgoing: end,
  };
}
const penValues = (points: readonly PenPoint[]) =>
  points.flatMap((p) => [
    p.x,
    p.y,
    p.incoming.x,
    p.incoming.y,
    p.outgoing.x,
    p.outgoing.y,
  ]);

type CanvasInteractionData = {
  marquee: Exclude<
    | {
        start: Vec2;
        end: Vec2;
        selection: readonly string[];
        additive: boolean;
      }
    | undefined,
    undefined
  >;
  drawing: Exclude<
    { start: Vec2; end: Vec2; project: unknown } | undefined,
    undefined
  >;
  moveSnap: Exclude<
    | {
        context: CanvasSnapContext;
        transform: TransformContext;
        axis?: 'x' | 'y';
        lockedAxis?: 'x' | 'y';
        duplicate?: boolean;
        start: Vec2;
        project: unknown;
        time: number;
      }
    | undefined,
    undefined
  >;
  gesture: Exclude<
    | {
        kind: HandleKind;
        context?: TransformContext;
        previewContext?: TransformContext;
        settings: unknown;
        point: Vec2;
        items: readonly RenderLayer[];
        project: unknown;
        time: number;
        direction?: Vec2;
        linked: boolean;
        moved?: boolean;
        lastAngle?: number;
        angle?: number;
      }
    | undefined,
    undefined
  >;
  pan: Exclude<
    | {
        x: number;
        y: number;
        left: number;
        top: number;
        offset: { x: number; y: number };
      }
    | undefined,
    undefined
  >;
};

export function Canvas({ store }: { store: EditorStore }) {
  const [spaceView, setSpaceView] = useState(false);
  const [aids, setAids] = useState<CanvasAidSettings>(() => {
    try {
      return {
        ...{ grid: false, rulers: false, guides: true },
        ...JSON.parse(localStorage.getItem('swayframe.canvas-aids') ?? '{}'),
      };
    } catch {
      return { grid: false, rulers: false, guides: true };
    }
  });
  const toggleAid = (key: keyof CanvasAidSettings) =>
    setAids((old) => {
      const next = { ...old, [key]: !old[key] };
      try {
        localStorage.setItem('swayframe.canvas-aids', JSON.stringify(next));
      } catch {
        /* preferences only */
      }
      return next;
    });

  const { tool, space, setSpace } = useTools();
  const interaction = useRef(
    new CanvasInteractionState<CanvasInteractionData>(),
  ).current;
  const guidanceController = guidanceFor(store);
  const guidance = useSyncExternalStore(
    guidanceController.subscribe,
    guidanceController.getSnapshot,
  );

  const penPoints = useRef<PenPoint[]>([]);
  const [penPreview, setPenPreview] = useState<readonly PenPoint[]>([]);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hoverId, setHoverId] = useState<string>();
  const [panning, setPanning] = useState(false);
  const viewportMode = useRef<'fit' | 'manual'>('fit');
  const breadcrumbs = useRef<string[]>([]);
  const [navigation, setNavigation] = useState<readonly string[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number }>();
  const [internal, setInternal] = useState<string>();
  const outsideInteraction = useRef(false);
  const marquee = interaction.slot('marquee');
  const [marqueeBox, setMarqueeBox] = useState<{ start: Vec2; end: Vec2 }>();
  const drawing = interaction.slot('drawing');
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
  const moveSnap = interaction.slot('moveSnap');
  const gesture = interaction.slot('gesture');
  const [transformPreview, updateTransformPreview] = useState<
    readonly RenderLayer[] | undefined
  >();
  const latestTransformPreview = useRef<readonly RenderLayer[] | undefined>(
    undefined,
  );
  const setTransformPreview = (items: readonly RenderLayer[] | undefined) => {
    latestTransformPreview.current = items;
    if (items) {
      const snapshot = createRenderSnapshot(
        activeComposition(store.getSnapshot().project),
        store.getSnapshot().time,
        [],
        undefined,
        store.getSnapshot().project,
      );
      store.setPropertyPreviews(
        localTransformValues(snapshot, items).flatMap((item) => [
          {
            ...item.source.transform.position,
            baseValue: item.position,
            keyframes: [],
          },
          {
            ...item.source.transform.scale,
            baseValue: item.scale,
            keyframes: [],
          },
          {
            ...item.source.transform.rotation,
            baseValue: item.rotation,
            keyframes: [],
          },
          ...(item.anchor && item.source.editor?.properties.anchor
            ? [
                {
                  ...item.source.editor.properties.anchor,
                  baseValue: item.anchor,
                  keyframes: [],
                },
              ]
            : []),
        ]),
      );
    } else store.setPropertyPreviews(undefined);
    updateTransformPreview(items);
  };
  const [measureVersion, setMeasureVersion] = useState(0);
  const view = useEditorSlice(store, [
    'project',
    'selection',
    'time',
    'zoom',
    'transformSettings',
    'autoKeyframes',
    'preview',
    'propertyPreview',
    'propertyPreviews',
  ]);
  const c = activeComposition(view.project);
  useEffect(() => {
    breadcrumbs.current = [];
    setNavigation([]);
  }, [view.project.id]);
  useEffect(() => {
    const open = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      const current = activeComposition(store.getSnapshot().project);
      if (
        !store
          .getSnapshot()
          .project.compositions.some((comp) => comp.id === id) ||
        current.id === id
      )
        return;
      cancelCanvas();
      breadcrumbs.current = [...breadcrumbs.current, current.id];
      setNavigation(breadcrumbs.current);
      store.run('进入预合成', [
        command({ type: 'project.activate', compositionId: id }),
      ]);
      store.select(null);
    };
    window.addEventListener('motion:open-composition', open);
    return () => window.removeEventListener('motion:open-composition', open);
  });
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
  const pan = interaction.slot('pan');
  const [fitWidth, setFitWidth] = useState(0);
  const fitWidthRef = useRef(0);
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
        viewportMode.current = 'manual';
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
  }, [view.zoom, fitWidth]);
  const cancelMarquee = () => {
    const m = marquee.current;
    if (m) {
      store.select(null);
      for (const id of m.selection) store.select(id, true);
    }
    marquee.current = undefined;
    outsideInteraction.current = false;
    setMarqueeBox(undefined);
  };
  const cancelCanvas = () => {
    penPoints.current = [];
    setPenPreview([]);
    setInternal(undefined);
    setMenu(undefined);
    cancelMarquee();
    drawing.current = undefined;
    setDrawBox(undefined);
    gesture.current = undefined;
    setTransformPreview(undefined);
    store.cancelDrag();
    moveSnap.current = undefined;
    setSnapGuides([]);
    if (pan.current) setOffset(pan.current.offset);
    pan.current = undefined;
    setPanning(false);
    setHoverId(undefined);
    setSpace(false);
  };
  useInteractionCancel(cancelCanvas);
  const finishPen = (closed = false) => {
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
        pathClosed: closed,
        properties: {
          ...editor.properties,
          path: {
            ...path,
            baseValue: penValues(points).map(
              (v, i) => v - (i % 2 ? center.y : center.x),
            ),
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
  };
  useEffect(() => {
    const finish = () => finishPen();
    window.addEventListener('motion:finish-path', finish);
    const fit = () => {
      viewportMode.current = 'fit';
      setOffset({ x: 0, y: 0 });
      store.setZoom(1);
      if (containerRef.current) {
        containerRef.current.scrollLeft = 0;
        containerRef.current.scrollTop = 0;
      }
    };
    const actual = () => {
      viewportMode.current = 'manual';
      store.setZoom(c.width / Math.max(1, fitWidth));
    };
    const zoomIn = () => {
      viewportMode.current = 'manual';
      store.setZoom(store.getSnapshot().zoom * 1.25);
    };
    const zoomOut = () => {
      viewportMode.current = 'manual';
      store.setZoom(store.getSnapshot().zoom / 1.25);
    };
    window.addEventListener('motion:zoom-in', zoomIn);
    window.addEventListener('motion:zoom-out', zoomOut);
    window.addEventListener('motion:actual-size', actual);
    window.addEventListener('motion:fit', fit);
    return () => {
      window.removeEventListener('motion:finish-path', finish);
      window.removeEventListener('motion:fit', fit);
      window.removeEventListener('motion:zoom-in', zoomIn);
      window.removeEventListener('motion:zoom-out', zoomOut);
      window.removeEventListener('motion:actual-size', actual);
    };
  });
  const rawRenderProject = gesture.current
    ? view.project
    : store.getRenderProject();
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
  const guideContext = useMemo(
    () =>
      guidance.referencePreview
        ? createTransformContext(
            input,
            view.selection,
            guidance.referencePreview,
            store.textMeasure,
          )
        : ((gesture.current?.project === view.project
            ? (gesture.current?.previewContext ?? gesture.current?.context)
            : undefined) ??
          (guidance.activity?.property === 'scale' ||
          guidance.activity?.property === 'rotation'
            ? guidance.baseline
            : undefined) ??
          transformContext),
    [
      guidance.referencePreview,
      guidance.baseline,
      guidance.activity,
      input,
      transformContext,
      view.selection,
      store,
    ],
  );
  const guideActivity = anchorMode
    ? {
        property: 'anchor' as const,
        phase:
          guidance.activity?.property === 'anchor'
            ? guidance.activity.phase
            : ('hover' as const),
      }
    : guidance.referencePreview
      ? { property: 'scale' as const, phase: 'hover' as const }
      : guidance.activity;
  const guideModel = useMemo(
    () =>
      createTransformGuideModel(
        guideContext,
        input,
        guideActivity,
        uiScale,
        guidance.ghost,
        store.textMeasure,
      ),
    [guideContext, input, guideActivity, uiScale, guidance.ghost],
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
      const next = Math.max(1, Math.min(width, (height * c.width) / c.height));
      const previous = fitWidthRef.current;
      fitWidthRef.current = next;
      if (
        previous > 0 &&
        (viewportMode.current === 'manual' || store.getSnapshot().zoom !== 1) &&
        Math.abs(next - previous) > 0.1
      ) {
        viewportMode.current = 'manual';
        store.setZoom((store.getSnapshot().zoom * previous) / next);
      }
      setFitWidth(next);
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
    currentTarget: HTMLElement;
    clientX: number;
    clientY: number;
  }) => {
    const rect = ref.current!.getBoundingClientRect();
    return screenToComposition({ x: event.clientX, y: event.clientY }, rect, {
      x: c.width,
      y: c.height,
    });
  };
  const isCornerRotation = (p: Vec2) => {
    return gizmo.box.some((corner) => {
      const center = {
        x: gizmo.box.reduce((sum, p) => sum + p.x / 4, 0),
        y: gizmo.box.reduce((sum, p) => sum + p.y / 4, 0),
      };
      const d = Math.hypot(corner.x - center.x, corner.y - center.y) || 1;
      return (
        Math.hypot(
          p.x -
            corner.x -
            ((corner.x - center.x) / d) *
              canvasInteractionTokens.rotationOffset *
              uiScale,
          p.y -
            corner.y -
            ((corner.y - center.y) / d) *
              canvasInteractionTokens.rotationOffset *
              uiScale,
        ) <
        6 * uiScale
      );
    });
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || interaction.state.type !== 'idle') return;
    const p = point(event);
    if (tool !== 'select' && tool !== 'hand') {
      event.currentTarget.setPointerCapture(event.pointerId);
      if (
        tool === 'pen' &&
        penPoints.current.length > 2 &&
        Math.hypot(
          p.x - penPoints.current[0]!.x,
          p.y - penPoints.current[0]!.y,
        ) <
          8 * uiScale
      ) {
        finishPen(true);
        return;
      }
      drawing.current = { start: p, end: p, project: view.project };
      if (tool === 'pen') setPenPreview([...penPoints.current, penPoint(p, p)]);
      else setDrawBox({ start: p, end: p });
      return;
    }
    const selected = input.layers.filter(
      (l) => view.selection.includes(l.source.id) && !l.source.locked,
    );
    const cornerRotate = isCornerRotation(p);
    const arcHit =
      cornerRotate ||
      hitTransformRotationGuide(
        guideModel,
        p,
        canvasInteractionTokens.hitRadius * uiScale,
      );
    const handle = !selected.length
      ? undefined
      : arcHit
        ? { kind: 'rotate' as const, point: p }
        : spatialSelection
          ? selected
              .map((l) =>
                hitTransformHandle(
                  l,
                  p,
                  canvasInteractionTokens.hitRadius * uiScale,
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
                  canvasInteractionTokens.hitRadius * uiScale,
              )
              .sort(
                (a, b) =>
                  Math.hypot(a.point.x - p.x, a.point.y - p.y) -
                  Math.hypot(b.point.x - p.x, b.point.y - p.y),
              )[0];
    if (handle) {
      event.currentTarget.setPointerCapture(event.pointerId);
      store.setPlaying(false);
      guidanceController.activate({
        property:
          handle.kind === 'move'
            ? 'position'
            : handle.kind === 'rotate'
              ? 'rotation'
              : handle.kind === 'anchor'
                ? 'anchor'
                : 'scale',
        phase: 'active',
        axis:
          'axis' in handle
            ? handle.axis
            : handle.kind === 'scale' && 'direction' in handle
              ? handle.direction?.x === 0
                ? 'y'
                : handle.direction?.y === 0
                  ? 'x'
                  : undefined
              : undefined,
      });
      if (handle.kind === 'move') {
        store.beginDrag(selected[0]!.source.id, p);
        moveSnap.current = {
          start: p,
          project: view.project,
          time: view.time,
          transform: store.getDragTransformContext()!,
          axis: handle.axis,
          context: canvasSnapContext(
            evaluated,
            view.selection,
            store.textMeasure,
          ),
        };
        return;
      }
      gesture.current = {
        kind: handle.kind,
        direction: 'direction' in handle ? handle.direction : undefined,
        linked:
          'direction' in handle &&
          !!handle.direction?.x &&
          !!handle.direction?.y,
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
    const id = hitTest(input, p, store.textMeasure);
    if (id) {
      event.currentTarget.setPointerCapture(event.pointerId);
      if (event.shiftKey || event.metaKey || event.ctrlKey)
        store.select(id, true);
      else {
        store.beginDrag(id, p, canvasInteractionModifiers.duplicate(event));
        moveSnap.current = {
          start: p,
          duplicate: canvasInteractionModifiers.duplicate(event),
          project: store.getSnapshot().project,
          time: store.getSnapshot().time,
          transform: store.getDragTransformContext()!,
          context: canvasSnapContext(
            evaluated,
            store.getSnapshot().selection,
            store.textMeasure,
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
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const g = gesture.current,
      p = point(event);
    if (marquee.current) {
      marquee.current.end = p;
      setMarqueeBox({ ...marquee.current });
      return;
    }
    if (drawing.current) {
      drawing.current.end = p;
      if (tool === 'pen')
        setPenPreview([
          ...penPoints.current,
          penPoint(drawing.current.start, p),
        ]);
      else setDrawBox({ ...drawing.current });
      return;
    }
    if (!g) {
      const move = moveSnap.current;
      if (!move) {
        setHoverId(
          tool === 'select' && !space && !internal
            ? (hitTest(input, p, store.textMeasure) ?? undefined)
            : undefined,
        );
        if (space || tool === 'hand') {
          event.currentTarget.style.cursor = '';
          return;
        }
        if (tool === 'select' && !internal) {
          const hover = view.selection.length
            ? gizmo.handles.find(
                (h) =>
                  Math.hypot(h.point.x - p.x, h.point.y - p.y) <=
                  canvasInteractionTokens.hitRadius * uiScale,
              )
            : undefined;
          const overArc =
            view.selection.length > 0 &&
            (isCornerRotation(p) ||
              hitTransformRotationGuide(
                guideModel,
                p,
                canvasInteractionTokens.hitRadius * uiScale,
              ));
          const property =
            overArc || hover?.kind === 'rotate'
              ? 'rotation'
              : hover?.kind === 'scale'
                ? 'scale'
                : 'position';
          if (guidance.activity?.phase !== 'active')
            guidanceController.activate({
              property,
              phase: 'hover',
              axis:
                hover?.axis ??
                (hover?.kind === 'scale'
                  ? hover.direction?.x === 0
                    ? 'y'
                    : hover.direction?.y === 0
                      ? 'x'
                      : undefined
                  : undefined),
            });
          event.currentTarget.style.cursor =
            overArc || hover?.kind === 'rotate'
              ? 'crosshair'
              : hover?.kind === 'scale'
                ? scaleCursor(
                    hover.direction ?? { x: 1, y: 1 },
                    (Math.atan2(
                      transformContext.basis.x.y,
                      transformContext.basis.x.x,
                    ) *
                      180) /
                      Math.PI,
                  )
                : hover?.axis === 'x'
                  ? 'ew-resize'
                  : hover?.axis === 'y'
                    ? 'ns-resize'
                    : hitTest(input, p, store.textMeasure)
                      ? 'move'
                      : 'default';
        }
        return;
      }
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
        move.axis ?? (event.shiftKey ? move.lockedAxis : undefined),
      );
      if (
        event.shiftKey &&
        !move.lockedAxis &&
        Math.hypot(delta.x, delta.y) > 2 * uiScale
      )
        move.lockedAxis = constrained.axis;
      if (!event.shiftKey) move.lockedAxis = undefined;
      const axis = constrained.worldAxis;
      const snapped = snapCanvasDelta(
        move.context,
        constrained.delta,
        snapping &&
          !canvasInteractionModifiers.snapBypass(event) &&
          (!constrained.axis || axis !== undefined)
          ? (canvasInteractionTokens.snapThreshold * c.width) /
              Math.max(1, ref.current!.getBoundingClientRect().width)
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
    g.moved = g.moved || Math.hypot(p.x - g.point.x, p.y - g.point.y) > 1e-8;
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
        g.previewContext = context;
        let operation = pointerTransformOperation(
          context,
          g.kind as 'scale' | 'rotate',
          g.point,
          p,
          g.direction,
          g.linked ? !event.shiftKey : event.shiftKey,
        );
        if (operation.kind === 'rotate') {
          const currentAngle = Math.atan2(
            p.y - context.pivot.y,
            p.x - context.pivot.x,
          );
          const previousAngle =
            g.lastAngle ??
            Math.atan2(
              g.point.y - context.pivot.y,
              g.point.x - context.pivot.x,
            );
          g.angle = continuousRotation(
            previousAngle,
            currentAngle,
            g.angle ?? 0,
          );
          g.lastAngle = currentAngle;
          operation = {
            ...operation,
            angle: (g.angle * 180) / Math.PI,
          };
        }
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
        const p = transformHandles(l).find((h) => h.kind === 'anchor')!.point;
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
          Math.hypot(g.point.x - screenCenter.x, g.point.y - screenCenter.y),
        ),
    );
    let angle =
      Math.atan2(p.y - screenCenter.y, p.x - screenCenter.x) -
      Math.atan2(g.point.y - screenCenter.y, g.point.x - screenCenter.x);
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
  };
  const onPointerUp = () => {
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
      if (
        Math.hypot(right - left, bottom - top) >
        canvasInteractionTokens.marqueeThreshold * uiScale
      ) {
        const ids = input.layers
          .filter((item) => {
            if (
              item.source.locked ||
              !item.source.visible ||
              item.active === false ||
              item.opacity === 0 ||
              item.source.type === 'camera'
            )
              return false;
            const q = boundsCorners(
              getWorldBounds(item, view.time, store.textMeasure),
            );
            return (
              Math.min(...q.map((p) => p.x)) <= right &&
              Math.max(...q.map((p) => p.x)) >= left &&
              Math.min(...q.map((p) => p.y)) <= bottom &&
              Math.max(...q.map((p) => p.y)) >= top
            );
          })
          .map((item) => item.source.id);
        store.select(null);
        for (const id of new Set([...(m.additive ? m.selection : []), ...ids]))
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
        const last = penPoints.current.at(-1);
        if (!last || Math.hypot(last.x - d.start.x, last.y - d.start.y) > 1)
          penPoints.current = [...penPoints.current, penPoint(d.start, d.end)];
        setPenPreview([...penPoints.current]);
        return;
      }
      const kind =
        tool === 'text' ? 'text' : tool === 'ellipse' ? 'ellipse' : 'rectangle';
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
      return;
    }
    const g = gesture.current;
    gesture.current = undefined;
    guidanceController.activate();
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
  };
  return (
    <section
      className="canvas-panel"
      aria-label="画布区域"
      data-interaction={interaction.state.type}
      tabIndex={0}
      onPointerDownCapture={(event) => event.currentTarget.focus()}
      style={{
        cursor: panning
          ? 'grabbing'
          : space || tool === 'hand'
            ? 'grab'
            : tool === 'select'
              ? 'default'
              : tool === 'text'
                ? 'text'
                : 'crosshair',
      }}
    >
      <div className="canvas-caption">
        <span className="composition-caption">
          <Icon name="comp" />
          {navigation.map((id, index) => (
            <button
              key={`${id}-${index}`}
              aria-label={`返回合成 ${view.project.compositions.find((c) => c.id === id)?.name}`}
              onClick={() => {
                store.run('返回合成', [
                  command({ type: 'project.activate', compositionId: id }),
                ]);
                store.select(null);
                breadcrumbs.current = navigation.slice(0, index);
                setNavigation(breadcrumbs.current);
              }}
            >
              {displayName(
                view.project.compositions.find((c) => c.id === id)?.name ?? '',
              )}{' '}
              ›
            </button>
          ))}
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
            title={`吸附到合成与图层边缘/中心及等间距 · ${canvasInteractionModifiers.snapHint} · Shift 锁定方向`}
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
        <div className="canvas-view-tools">
          <button
            aria-label="三维图层查看工具"
            aria-pressed={spaceView}
            onClick={() => setSpaceView(!spaceView)}
          >
            3D 空间
          </button>
          <MenuDropdown className="canvas-aids-menu">
            <summary>辅助</summary>
            <div>
              {(
                [
                  ['grid', '网格'],
                  ['rulers', '标尺'],
                  ['guides', '参考线'],
                ] as const
              ).map(([id, label]) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={aids[id]}
                    onChange={() => toggleAid(id)}
                  />
                  {label}
                </label>
              ))}
              <small>像素单位 · 从标尺拖出参考线</small>
            </div>
          </MenuDropdown>
        </div>
        <span className="composition-meta">
          {c.width} × {c.height} · {c.fps} 帧/秒
        </span>
      </div>
      <div className={`canvas-viewports ${spaceView ? 'is-split' : ''}`}>
        <div
          className="canvas-scroll"
          ref={containerRef}
          onPointerDownCapture={(event) => {
            if (event.button !== 1 && !space && tool !== 'hand') return;
            if (interaction.state.type !== 'idle') return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            setPanning(true);
            pan.current = {
              x: event.clientX,
              y: event.clientY,
              left: event.currentTarget.scrollLeft,
              top: event.currentTarget.scrollTop,
              offset,
            };
          }}
          onPointerMove={(event) => {
            if (!pan.current) {
              if (outsideInteraction.current) onPointerMove(event);
              return;
            }
            setOffset({
              x: pan.current.offset.x + event.clientX - pan.current.x,
              y: pan.current.offset.y + event.clientY - pan.current.y,
            });
          }}
          onPointerDown={(event) => {
            if (
              event.target === event.currentTarget &&
              event.button === 0 &&
              !space &&
              tool !== 'hand'
            ) {
              outsideInteraction.current = true;
              onPointerDown(event);
            }
          }}
          onPointerUp={() => {
            if (outsideInteraction.current) {
              onPointerUp();
              outsideInteraction.current = false;
            }
            pan.current = undefined;
            setPanning(false);
          }}
          onLostPointerCapture={() => {
            if (interaction.state.type !== 'idle') cancelCanvas();
          }}
          onPointerCancel={() => {
            cancelCanvas();
            setPanning(false);
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
              style={
                space || tool === 'hand'
                  ? { cursor: panning ? 'grabbing' : 'grab' }
                  : tool === 'text'
                    ? { cursor: 'text' }
                    : tool !== 'select'
                      ? { cursor: 'crosshair' }
                      : undefined
              }
              width={c.width}
              height={c.height}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={() => {
                setHoverId(undefined);
                if (ref.current) ref.current.style.cursor = '';
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                const id = hitTest(input, point(event), store.textMeasure);
                if (id && !view.selection.includes(id)) store.select(id);
                store.selectFrames([]);
                store.selectProperties([]);
                setMenu({ x: event.clientX, y: event.clientY });
              }}
              onDoubleClick={(event) => {
                if (tool === 'pen') {
                  finishPen();
                  return;
                }
                if (space || tool !== 'select') return;
                const id = hitTest(input, point(event), store.textMeasure);
                const layer = c.layers.find((l) => l.id === id);
                if (!layer) return;
                store.select(layer.id);
                if (layer.type === 'precomp' && layer.compositionId) {
                  breadcrumbs.current = [...breadcrumbs.current, c.id];
                  setNavigation(breadcrumbs.current);
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
                guidanceController.activate();
                cancelMarquee();
                drawing.current = undefined;
                setDrawBox(undefined);
                gesture.current = undefined;
                setTransformPreview(undefined);
                store.cancelDrag();
                moveSnap.current = undefined;
                setSnapGuides([]);
              }}
              onLostPointerCapture={() => {
                guidanceController.activate();
                cancelMarquee();
                drawing.current = undefined;
                setDrawBox(undefined);
                gesture.current = undefined;
                setTransformPreview(undefined);
                store.cancelDrag();
                moveSnap.current = undefined;
                setSnapGuides([]);
              }}
            />
            <CanvasAids
              width={c.width}
              height={c.height}
              scale={uiScale}
              key={c.id}
              compositionId={c.id}
              settings={aids}
            />
            {spatialSelection &&
              tool === 'select' &&
              !space &&
              input.camera && (
                <ThreeDGizmo
                  store={store}
                  snapshot={input}
                  project={(p) => projectPoint(p, input.camera!)}
                  width={c.width}
                  height={c.height}
                  unitsPerPixel={uiScale}
                />
              )}
            {hoverId &&
              !view.selection.includes(hoverId) &&
              tool === 'select' &&
              !space &&
              (() => {
                const item = input.layers.find((l) => l.source.id === hoverId);
                if (!item) return null;
                const q =
                  item.quad ??
                  boundsCorners(
                    getWorldBounds(item, view.time, store.textMeasure),
                  );
                return (
                  <svg
                    className="canvas-hover-outline"
                    aria-label="悬停对象轮廓"
                    viewBox={`0 0 ${c.width} ${c.height}`}
                  >
                    <polygon points={q.map((p) => `${p.x},${p.y}`).join(' ')} />
                  </svg>
                );
              })()}
            {!spatialSelection &&
              view.selection.length > 0 &&
              tool === 'select' &&
              !internal &&
              !guidance.suppressed && (
                <TransformOverlay
                  store={store}
                  context={guideContext}
                  gizmo={gizmo}
                  uiScale={uiScale}
                  model={guideModel}
                  canvas={ref}
                />
              )}
            {snapGuides.length > 0 && (
              <svg
                className="canvas-snap-guides"
                aria-label="画布吸附参考线"
                viewBox={`0 0 ${c.width} ${c.height}`}
              >
                {snapGuides.map((guide) =>
                  guide.spacing ? (
                    <g key={guide.axis} aria-label="等间距参考线">
                      {guide.spacing.spans.map(([a, b], i) => (
                        <g key={i}>
                          <line
                            x1={guide.axis === 'x' ? a : guide.spacing!.cross}
                            x2={guide.axis === 'x' ? b : guide.spacing!.cross}
                            y1={guide.axis === 'y' ? a : guide.spacing!.cross}
                            y2={guide.axis === 'y' ? b : guide.spacing!.cross}
                          />
                          <text
                            x={
                              guide.axis === 'x'
                                ? (a + b) / 2
                                : guide.spacing!.cross + 8 * uiScale
                            }
                            y={
                              guide.axis === 'y'
                                ? (a + b) / 2
                                : guide.spacing!.cross - 8 * uiScale
                            }
                            fontSize={11 * uiScale}
                            textAnchor="middle"
                          >
                            {Math.round(guide.spacing!.distance * 10) / 10}
                          </text>
                        </g>
                      ))}
                    </g>
                  ) : (
                    <line
                      key={guide.axis}
                      x1={guide.axis === 'x' ? guide.value : 0}
                      x2={guide.axis === 'x' ? guide.value : c.width}
                      y1={guide.axis === 'y' ? guide.value : 0}
                      y2={guide.axis === 'y' ? guide.value : c.height}
                    />
                  ),
                )}
              </svg>
            )}
            {penPreview.length > 0 && (
              <svg
                className="pen-preview"
                viewBox={`0 0 ${c.width} ${c.height}`}
              >
                <path
                  d={pathSvg(penValues(penPreview), false)}
                  fill="none"
                  stroke="#8dafff"
                  strokeWidth={Math.max(
                    2,
                    c.width / Math.max(1, fitWidth) / view.zoom,
                  )}
                />
                {penPreview.map((p, i) => (
                  <g key={i}>
                    <line
                      x1={p.incoming.x}
                      y1={p.incoming.y}
                      x2={p.outgoing.x}
                      y2={p.outgoing.y}
                      stroke="var(--warning)"
                      strokeWidth={uiScale}
                    />
                    <circle
                      cx={p.outgoing.x}
                      cy={p.outgoing.y}
                      r={3 * uiScale}
                      fill="var(--warning)"
                    />
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
                  </g>
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
            {drawBox && tool !== 'pen' && (
              <div
                className="draw-preview creation-preview"
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
        {spaceView && (
          <SpatialViewport store={store} onClose={() => setSpaceView(false)} />
        )}
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
              closed={layer.editor.pathClosed}
              onClose={() => setInternal(undefined)}
            />
          ) : null;
        })()}
      <div className="canvas-bottom">
        <span
          className="transform-mode-hint"
          title={`${orientationDescriptions[guideContext.settings.orientation]}；${pivotDescriptions[guideContext.settings.pivotMode]}`}
        >
          <span className="guide-status">
            {orientationLabels[guideContext.settings.orientation]}
          </span>
          <span className="guide-status">
            {pivotLabels[guideContext.settings.pivotMode]}
          </span>
          {guidance.referencePreview && (
            <span className="guide-status">预览</span>
          )}
        </span>
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
            viewportMode.current = 'manual';
            const points = selected.flatMap((item) =>
              boundsCorners(getWorldBounds(item, view.time, store.textMeasure)),
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
            value={
              viewportMode.current === 'fit' && view.zoom === 1
                ? 'fit'
                : String(
                    Math.round(((fitWidth * view.zoom) / c.width) * 10000) /
                      100,
                  )
            }
            onChange={(event) => {
              if (event.target.value === 'fit')
                window.dispatchEvent(new Event('motion:fit'));
              else {
                viewportMode.current = 'manual';
                store.setZoom(
                  ((c.width / Math.max(1, fitWidth)) *
                    Number(event.target.value)) /
                    100,
                );
              }
            }}
          >
            <option value="fit">适合窗口</option>
            {[25, 50, 100, 200, 400].map((percent) => (
              <option key={percent} value={percent}>
                {percent}%
              </option>
            ))}
            {![25, 50, 100, 200, 400].includes(
              Math.round(((fitWidth * view.zoom) / c.width) * 10000) / 100,
            ) && (
              <option
                value={
                  Math.round(((fitWidth * view.zoom) / c.width) * 10000) / 100
                }
              >
                {Math.round(((fitWidth * view.zoom) / c.width) * 100)}%
              </option>
            )}
          </select>
        </label>
      </div>
    </section>
  );
}
