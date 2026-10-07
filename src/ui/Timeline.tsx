import { SharedCurveTransport } from './workspace/CurveWorkspace';
import { CompositionTimeRuler } from './workspace/CompositionTimeRuler';
import { dispatchShortcut } from './workspace/shortcuts';
import { useLayerMarquee } from './workspace/layer-marquee';
import { CreateLayerMenu } from './workspace/CreateLayerMenu';
import { timelineReorderCommands } from '../core/timeline-reorder';
import { CanvasInteractionState as PointerInteractionState } from './workspace/canvas-interaction';
import type { FrameRef } from '../core/editing-commands';
import { useEditorSlice } from './use-editor-slice';
import {
  formatTimecode,
  snapToFrame,
  timelineTicks,
} from '../core/timeline-time';
import { splitLayerCommands } from '../core/composition-editing';
import { layerActions } from './workspace/layer-actions';
import { LayerAccentChip } from './LayerAccentChip';
import { timelineVisibleRows } from './timeline-visible-rows';
import { Icon } from './workspace/icons';
import { snapTimeDelta } from '../core/timeline-snapping';
import { CompositingGraphPanel } from './CompositingGraph';
import { motionSegments, segmentMotionCurve } from '../core/motion-curve';
import {
  applyMotionCurveCommands,
  selectedMotionSegments,
} from '../core/motion-curve-commands';
import { useInteractionCancel } from './workspace/interaction';
import { ContextMenu, IconButton, Tabs } from './workspace/primitives';
import { MotionCurvePanel } from './MotionCurvePanel';
import { LayerTimeBar } from './LayerTimeBar';
import { GraphEditor } from './GraphEditor';
import { visibleProperties, propertyLabel } from './property-labels';
import { interpolationLabels, displayName } from './labels';
import { useEffect, useMemo, useRef, useState, Fragment } from 'react';
import type { CSSProperties } from 'react';
import { command } from '../core/command-system';
import { newId } from '../core/core-types';
import { findProperty, activeComposition } from '../core/project-model';
import type { Interpolation } from '../core/project-model';
import type { EditorStore } from './editor-store';
import { advancePlayback } from './playback';

type TimelinePointerPayloads = {
  scrubbing: { time: number; left: number; width: number };
  panning: { x: number; scroll: number };
  marqueeSelecting: {
    x: number;
    y: number;
    endX: number;
    endY: number;
    start: readonly FrameRef[];
  };
  movingKeyframes: {
    id: string;
    x: number;
    width: number;
    delta: number;
    snapshot: unknown;
    duplicate: boolean;
    time: number;
    times: readonly number[];
    targets: readonly number[];
    refs: readonly FrameRef[];
  };
  resizingTree: { x: number; width: number };
  layerSpan: { cancel: () => void };
  reorderingLayers: {
    ids: readonly string[];
    x: number;
    y: number;
    snapshot: unknown;
    moved: boolean;
    target?: { id: string; after: boolean };
  };
};
export function Timeline({ store }: { store: EditorStore }) {
  const interaction = useRef(
    new PointerInteractionState<TimelinePointerPayloads>(),
  ).current;
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomAnchor = useRef<{ time: number; x: number } | undefined>(undefined);
  const rulerDrag = interaction.slot('scrubbing');
  const [search, setSearch] = useState('');
  const [treeWidth, setTreeWidth] = useState(() =>
    Math.max(
      220,
      Math.min(
        480,
        Number(localStorage.getItem('motion.timeline-tree-width')) || 260,
      ),
    ),
  );
  const treeResize = interaction.slot('resizingTree');
  const [viewportWidth, setViewportWidth] = useState(1000);
  const layerMarquee = useLayerMarquee(store);
  const [renaming, setRenaming] = useState<string>();
  const [renameValue, setRenameValue] = useState('');
  const suppressLayerClick = useRef(false);
  const [insertion, setInsertion] = useState<{ id: string; after: boolean }>();
  const [propertyMenu, setPropertyMenu] = useState<{
    x: number;
    y: number;
    id: string;
  }>();
  const [blankMenu, setBlankMenu] = useState<{ x: number; y: number }>();
  const [snapping, setSnapping] = useState(true);
  const marquee = interaction.slot('marqueeSelecting');
  const suppressTrackClick = useRef(false);
  const spacePan = useRef(false);
  const spacePanUsed = useRef(false);
  const [box, setBox] = useState<{
    x: number;
    y: number;
    endX: number;
    endY: number;
  }>();
  const [layerMenu, setLayerMenu] = useState<{ x: number; y: number }>();
  const [keyMenu, setKeyMenu] = useState<{ x: number; y: number }>();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [transforms, setTransforms] = useState<Record<string, boolean>>({});
  const [timecode, setTimecode] = useState(false);
  const [loop, setLoop] = useState(true);
  const [graphOpen, setGraphOpen] = useState(
    () => localStorage.getItem('motion.active-timeline') === 'graph',
  );
  const [compositingOpen, setCompositingOpen] = useState(
    () => localStorage.getItem('motion.active-timeline') === 'compositing',
  );
  const [motionOpen, setMotionOpen] = useState(
    () => localStorage.getItem('motion.active-timeline') === 'motion',
  );
  const [motionInitialSegment, setMotionInitialSegment] = useState('');
  const [frameDrag, setFrameDrag] = useState<{
    id: string;
    delta: number;
    snapTime?: number;
    width?: number;
  }>();
  const [duplicating, setDuplicating] = useState(false);
  const dragRef = interaction.slot('movingKeyframes');
  const view = useEditorSlice(store, [
    'project',
    'selection',
    'frames',
    'selectedProperties',
    'time',
    'playing',
    'timelineZoom',
    'propertyFilter',
  ]);
  const c = activeComposition(view.project);
  useEffect(() => {
    const release = (event: KeyboardEvent) => {
      if (event.code === 'Space' && spacePan.current) {
        if (!spacePanUsed.current)
          store.setPlaying(!store.getSnapshot().playing);
        spacePan.current = false;
      }
    };
    window.addEventListener('keyup', release);
    return () => window.removeEventListener('keyup', release);
  }, []);
  useEffect(() => {
    localStorage.setItem('motion.timeline-tree-width', String(treeWidth));
  }, [treeWidth]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setViewportWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [graphOpen, compositingOpen, motionOpen]);

  useEffect(() => {
    if (!view.playing) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - previous) / 1000;
      previous = now;
      const next = store.getSnapshot().time + elapsed;
      if (!loop && next >= c.duration) {
        store.setTime(c.duration);
        store.setPlaying(false);
        return;
      }
      store.setTime(
        advancePlayback(store.getSnapshot().time, elapsed, c.duration),
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [view.playing, c.duration, store, loop]);
  const setZoom = (zoom: number, x?: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const cursor =
      x ??
      treeWidth +
        (view.time / c.duration) *
          Math.max(1, el.clientWidth - treeWidth - 28) *
          view.timelineZoom -
        el.scrollLeft;
    const time =
      x === undefined
        ? view.time
        : ((el.scrollLeft + cursor - treeWidth) /
            Math.max(1, el.clientWidth - treeWidth - 28) /
            view.timelineZoom) *
          c.duration;
    zoomAnchor.current = { time, x: cursor };
    store.setTimelineZoom(zoom);
  };
  useEffect(() => {
    const a = zoomAnchor.current,
      el = scrollRef.current;
    if (!a || !el) return;
    el.scrollLeft =
      treeWidth +
      (a.time / c.duration) *
        Math.max(1, el.clientWidth - treeWidth - 28) *
        view.timelineZoom -
      a.x;
    zoomAnchor.current = undefined;
  }, [view.timelineZoom, c.duration, treeWidth]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        el.scrollLeft += event.deltaY || event.deltaX;
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey) return;
      event.preventDefault();
      const current = store.getSnapshot();
      const x = event.clientX - el.getBoundingClientRect().left;
      const time =
        ((el.scrollLeft + x - treeWidth) /
          Math.max(1, el.clientWidth - treeWidth - 28) /
          current.timelineZoom) *
        c.duration;
      zoomAnchor.current = { time, x };
      store.setTimelineZoom(
        current.timelineZoom * Math.exp(-event.deltaY * 0.002),
      );
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [store, c.duration, treeWidth, graphOpen, compositingOpen, motionOpen]);
  useInteractionCancel(() => {
    spacePan.current = false;
    interaction.slot('panning').current = undefined;
    interaction.slot('layerSpan').current?.cancel();
    interaction.slot('layerSpan').current = undefined;
    if (treeResize.current) setTreeWidth(treeResize.current.width);
    treeResize.current = undefined;
    setInsertion(undefined);
    interaction.slot('reorderingLayers').current = undefined;
    setPropertyMenu(undefined);
    setBlankMenu(undefined);
    setRenaming(undefined);
    dragRef.current = undefined;
    setFrameDrag(undefined);
    setDuplicating(false);
    marquee.current = undefined;
    setBox(undefined);
    if (rulerDrag.current) store.setTime(rulerDrag.current.time);
    rulerDrag.current = undefined;
    setKeyMenu(undefined);
    setLayerMenu(undefined);
  });
  // Track the complete gesture at window level: React updates or a lost button
  // capture must not discard the final pointer position / release.
  useEffect(() => {
    const clear = () => {
      if (rulerDrag.current) store.setTime(rulerDrag.current.time);
      rulerDrag.current = undefined;
      interaction.slot('panning').current = undefined;
      interaction.slot('reorderingLayers').current = undefined;
      setInsertion(undefined);
      dragRef.current = undefined;
      setFrameDrag(undefined);
      setDuplicating(false);
    };
    const move = (event: PointerEvent) => {
      const reorder = interaction.slot('reorderingLayers').current;
      if (reorder) {
        if (reorder.snapshot !== store.getSnapshot().project) {
          clear();
          return;
        }
        if (
          !reorder.moved &&
          Math.hypot(event.clientX - reorder.x, event.clientY - reorder.y) < 4
        )
          return;
        reorder.moved = true;
        const heading = [
          ...(scrollRef.current?.querySelectorAll<HTMLElement>(
            '.timeline-layer-heading',
          ) ?? []),
        ].find((el) => {
          const r = el.getBoundingClientRect();
          return event.clientY >= r.top && event.clientY <= r.bottom;
        });
        if (heading) {
          const r = heading.getBoundingClientRect();
          const target = {
            id: heading.parentElement!.dataset.layer!,
            after: event.clientY >= r.top + r.height / 2,
          };
          reorder.target = target;
          setInsertion((old) =>
            old?.id === target.id && old.after === target.after ? old : target,
          );
        } else {
          reorder.target = undefined;
          setInsertion(undefined);
        }
        return;
      }

      const scrub = rulerDrag.current;
      if (scrub) {
        store.setTime(
          snapToFrame(
            ((event.clientX - scrub.left) / scrub.width) * c.duration,
            c.fps,
          ),
        );
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      if (
        drag.snapshot !== store.getSnapshot().project ||
        drag.refs.length !== store.getSnapshot().frames.length ||
        !drag.refs.every(
          (ref, i) =>
            ref.keyframeId === store.getSnapshot().frames[i]?.keyframeId,
        )
      ) {
        clear();
        return;
      }
      const result = snapTimeDelta(
        drag.times,
        ((event.clientX - drag.x) / Math.max(1, drag.width)) * c.duration,
        c.duration,
        c.fps,
        drag.targets,
        snapping && !event.metaKey && !event.ctrlKey
          ? (8 / Math.max(1, drag.width)) * c.duration
          : -1,
      );
      drag.delta = result.delta;
      setFrameDrag({ id: drag.id, ...result, width: drag.width });
    };
    const finish = (event: PointerEvent) => {
      if (interaction.slot('reorderingLayers').current) {
        move(event);
        const reorder = interaction.slot('reorderingLayers').current;
        clear();
        if (
          reorder?.moved &&
          reorder.target &&
          reorder.snapshot === store.getSnapshot().project
        ) {
          try {
            const commands = timelineReorderCommands(
              c,
              reorder.ids,
              reorder.target.id,
              reorder.target.after,
            );
            if (commands.length) store.run('调整时间轴图层顺序', commands);
          } catch (e) {
            store.setStatus(e instanceof Error ? e.message : '排序失败', true);
          }
        }
        return;
      }

      if (rulerDrag.current) {
        move(event);
        rulerDrag.current = undefined;
        return;
      }
      const initial = dragRef.current;
      if (!initial) return;
      move(event);
      const drag = dragRef.current;
      clear();
      if (!drag) {
        store.setStatus('工程已变化，关键帧拖动已取消', true);
        return;
      }
      if (Math.abs(drag.delta) <= 1e-8) {
        store.setTime(drag.time);
        return;
      }
      if (drag.duplicate) {
        const commands = drag.refs.map((ref) => {
          const source = findProperty(
            store.getSnapshot().project,
            ref.propertyId,
          ).property.keyframes.find((key) => key.id === ref.keyframeId);
          if (!source) throw new Error('关键帧不存在');
          return command({
            type: 'keyframe.add',
            propertyId: ref.propertyId,
            keyframe: {
              ...source,
              id: newId(),
              time: source.time + drag.delta,
            },
          });
        });
        if (store.run('拖动复制关键帧', commands).ok)
          store.selectFrames(
            commands.flatMap((c) =>
              c.type === 'keyframe.add'
                ? [{ propertyId: c.propertyId, keyframeId: c.keyframe.id }]
                : [],
            ),
          );
      } else {
        store.selectFrames(drag.refs);
        store.moveSelectedFrames(drag.delta);
      }
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', clear, true);
    return () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', clear, true);
    };
  }, [store, c, snapping]);
  const jumpVisible = (direction: -1 | 1) => {
    const live = store.getSnapshot();
    const visible = timelineVisibleRows(
      c.layers,
      live.selection,
      expanded,
      transforms,
      live.propertyFilter,
      live.frames,
      search,
      live.selectedProperties,
    ).flatMap((row) => row.properties);
    const props = live.selectedProperties.length
      ? c.layers
          .flatMap(visibleProperties)
          .filter((entry) =>
            live.selectedProperties.includes(entry.property.id),
          )
      : visible;
    const times = props
      .flatMap(({ property }) => property.keyframes.map((k) => k.time))
      .filter((time) =>
        direction < 0 ? time < live.time - 1e-8 : time > live.time + 1e-8,
      )
      .sort((a, b) => (direction < 0 ? b - a : a - b));
    if (times[0] !== undefined) {
      store.setPlaying(false);
      store.setTime(times[0]);
    }
  };
  useEffect(() => {
    const previous = () => jumpVisible(-1),
      next = () => jumpVisible(1);
    window.addEventListener('motion:previous-key', previous);
    window.addEventListener('motion:next-key', next);
    return () => {
      window.removeEventListener('motion:previous-key', previous);
      window.removeEventListener('motion:next-key', next);
    };
  });
  const easingSegments = () => {
    const selected = store.getSnapshot().frames;
    const explicit = selectedMotionSegments(
      store.getSnapshot().project,
      selected,
    );
    if (explicit.length)
      return c.layers
        .flatMap(visibleProperties)
        .flatMap(({ property }) => motionSegments(property))
        .filter((segment) => explicit.includes(segment.id));
    return [
      ...new Map(
        selected.flatMap((ref) => {
          const property = c.layers
            .flatMap(visibleProperties)
            .find((entry) => entry.property.id === ref.propertyId)?.property;
          if (!property) return [];
          const intervals = motionSegments(property);
          const segment =
            intervals.find((s) => s.from.id === ref.keyframeId) ??
            intervals.find((s) => s.to.id === ref.keyframeId);
          return segment ? [[segment.id, segment] as const] : [];
        }),
      ).values(),
    ];
  };
  const interpolation = (
    type: 'linear' | 'hold' | 'bezier',
    out = { x: 0.42, y: 0 },
    incoming = { x: 0.58, y: 1 },
  ) => {
    const intervals = easingSegments();
    if (type === 'hold')
      store.run(
        '保持关键帧',
        view.frames.map((ref) =>
          command({
            type: 'keyframe.update',
            propertyId: ref.propertyId,
            keyframeId: ref.keyframeId,
            patch: { interpolation: { type: 'hold' } },
          }),
        ),
      );
    else if (intervals.length)
      store.run(
        '修改关键帧缓动',
        applyMotionCurveCommands(
          view.project,
          intervals.map((s) => s.id),
          type === 'linear'
            ? { type: 'linear' }
            : {
                type: 'cubic-bezier',
                x1: out.x,
                y1: out.y,
                x2: incoming.x,
                y2: incoming.y,
              },
        ),
      );
  };
  useEffect(() => {
    const open = () => {
      setCompositingOpen(false);
      setGraphOpen(true);
      setMotionOpen(false);
      store.clearGraphSelection();
    };
    const motion = (e: Event) => {
      const detail = (e as CustomEvent<{ segmentId?: string }>).detail;
      setMotionInitialSegment(detail?.segmentId ?? '');
      setMotionOpen(true);
      setGraphOpen(false);
      setCompositingOpen(false);
    };
    const mode = (compositing: boolean) => () => {
      setGraphOpen(false);
      setMotionOpen(false);
      setCompositingOpen(compositing);
      store.clearGraphSelection();
    };
    const timeline = mode(false),
      compositing = mode(true);
    const rename = () => {
      const l = activeComposition(store.getSnapshot().project).layers.find(
        (l) => l.id === store.getSnapshot().selection[0],
      );
      if (l) {
        setRenaming(l.id);
        setRenameValue(l.name);
      }
    };
    window.addEventListener('motion:timeline', timeline);
    window.addEventListener('motion:compositing', compositing);
    window.addEventListener('motion:timeline-rename', rename);
    window.addEventListener('motion:motion-curve', motion);
    window.addEventListener('motion:graph', open);
    return () => {
      window.removeEventListener('motion:timeline', timeline);
      window.removeEventListener('motion:compositing', compositing);
      window.removeEventListener('motion:timeline-rename', rename);
      window.removeEventListener('motion:graph', open);
      window.removeEventListener('motion:motion-curve', motion);
    };
  }, []);
  useEffect(() => {
    localStorage.setItem(
      'motion.active-timeline',
      compositingOpen
        ? 'compositing'
        : graphOpen
          ? 'graph'
          : motionOpen
            ? 'motion'
            : 'timeline',
    );
  }, [graphOpen, compositingOpen, motionOpen]);
  const frameSignatures = useMemo(() => {
    const index = new Map<number, string[]>();
    for (const layer of c.layers)
      for (const { property } of visibleProperties(layer))
        for (const frame of property.keyframes) {
          const time = Math.round(frame.time * 1e8);
          index.set(time, [...(index.get(time) ?? []), frame.id]);
        }
    return index;
  }, [c]);
  const currentFrameSignature =
    frameSignatures.get(Math.round(view.time * 1e8))?.join(',') ?? '';
  const currentFrameIds = useMemo(
    () => new Set(currentFrameSignature.split(',')),
    [currentFrameSignature],
  );
  // Playhead movement between keys does not rebuild static track/keyframe DOM.
  // Commands read the live time, never the memoized row's captured time.
  const layerRows = useMemo(
    () =>
      timelineVisibleRows(
        c.layers,
        view.selection,
        expanded,
        transforms,
        view.propertyFilter,
        view.frames,
        search,
        view.selectedProperties,
      ).map(({ layer, headerIndex, open, propertyGroups }) => (
        <div className="timeline-layer" key={layer.id} data-layer={layer.id}>
          <div
            className="timeline-layer-heading"
            data-layer-id={layer.id}
            data-locked={layer.locked}
            data-visible={layer.visible}
            data-insertion={
              insertion?.id === layer.id
                ? insertion.after
                  ? 'after'
                  : 'before'
                : undefined
            }
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!view.selection.includes(layer.id)) store.select(layer.id);
              store.selectFrames([]);
              store.selectProperties([]);
              setLayerMenu({ x: event.clientX, y: event.clientY });
            }}
            data-row-index={headerIndex}
            data-zebra={headerIndex % 2 ? 'b' : 'a'}
            data-selected={view.selection.includes(layer.id)}
          >
            <div
              className="timeline-layer-label"
              onDoubleClick={(event) => {
                if (
                  event.target !== event.currentTarget &&
                  !(event.target as Element).closest('.timeline-layer-name')
                )
                  return;
                if (layer.type === 'precomp' && layer.compositionId) {
                  window.dispatchEvent(
                    new CustomEvent('motion:open-composition', {
                      detail: layer.compositionId,
                    }),
                  );
                } else {
                  setRenaming(layer.id);
                  setRenameValue(layer.name);
                }
              }}
              onPointerDown={(event) => {
                suppressLayerClick.current = false;
                if (
                  event.button !== 0 ||
                  renaming ||
                  layer.locked ||
                  interaction.state.type !== 'idle' ||
                  !(event.target as Element).closest('.timeline-layer-name')
                )
                  return;
                event.preventDefault();
                if (
                  !view.selection.includes(layer.id) ||
                  event.shiftKey ||
                  event.ctrlKey ||
                  event.metaKey
                )
                  store.select(
                    layer.id,
                    event.shiftKey || event.ctrlKey || event.metaKey,
                  );
                event.currentTarget.setPointerCapture(event.pointerId);
                suppressLayerClick.current = true;
                interaction.slot('reorderingLayers').current = {
                  ids: [...store.getSnapshot().selection],
                  x: event.clientX,
                  y: event.clientY,
                  snapshot: store.getSnapshot().project,
                  moved: false,
                };
              }}
              onClickCapture={(event) => {
                if (suppressLayerClick.current) {
                  suppressLayerClick.current = false;
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
            >
              <button
                className="layer-disclosure"
                aria-label={`展开 ${displayName(layer.name)} 属性`}
                aria-expanded={open}
                onClick={() =>
                  setExpanded({
                    ...expanded,
                    [layer.id]: !open,
                  })
                }
              >
                {open ? '▾' : '▸'}
              </button>
              <button
                aria-label={`${layer.visible ? '隐藏' : '显示'} ${displayName(layer.name)} 图层`}
                onClick={() =>
                  store.run('切换图层可见性', [
                    command({
                      type: 'layer.patch',
                      compositionId: c.id,
                      layerId: layer.id,
                      patch: { visible: !layer.visible },
                    }),
                  ])
                }
              >
                <Icon name="eye" />
              </button>
              <button
                aria-label={`${layer.locked ? '解锁' : '锁定'} ${displayName(layer.name)} 图层`}
                aria-pressed={layer.locked}
                onClick={() =>
                  store.run('切换图层锁定', [
                    command({
                      type: 'layer.patch',
                      compositionId: c.id,
                      layerId: layer.id,
                      patch: { locked: !layer.locked },
                    }),
                  ])
                }
              >
                <Icon name="lock" />
              </button>
              {renaming === layer.id ? (
                <input
                  autoFocus
                  aria-label="时间轴图层名称"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    if (renameValue.trim() && renameValue !== layer.name)
                      store.run('重命名图层', [
                        command({
                          type: 'layer.patch',
                          compositionId: c.id,
                          layerId: layer.id,
                          patch: { name: renameValue.trim() },
                        }),
                      ]);
                    setRenaming(undefined);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setRenaming(undefined);
                    }
                  }}
                />
              ) : (
                <button
                  className={`timeline-layer-name ${view.selection.includes(layer.id) ? 'active' : ''}`}
                  title={layer.name}
                  onClick={(event) =>
                    store.select(
                      layer.id,
                      event.shiftKey || event.ctrlKey || event.metaKey,
                    )
                  }
                >
                  <LayerAccentChip layer={layer} />
                  <Icon
                    name={
                      layer.type === 'text'
                        ? 'text'
                        : layer.type === 'image'
                          ? 'image'
                          : layer.type === 'shape'
                            ? 'rectangle'
                            : 'comp'
                    }
                  />
                  <span className="timeline-layer-text">
                    {displayName(layer.name)}
                  </span>
                </button>
              )}
            </div>
            <LayerTimeBar
              store={store}
              layer={layer}
              composition={c}
              claimInteraction={(cancel) => {
                if (interaction.state.type !== 'idle') return false;
                interaction.slot('layerSpan').current = { cancel };
                return true;
              }}
              releaseInteraction={() => {
                interaction.slot('layerSpan').current = undefined;
              }}
            />
            <span />
          </div>
          {open &&
            propertyGroups.map((group) => (
              <Fragment key={group.id}>
                <div
                  className="timeline-group-row"
                  data-row-index={group.rowIndex}
                  data-zebra={group.rowIndex % 2 ? 'b' : 'a'}
                >
                  <button
                    className="transform-disclosure"
                    aria-expanded={group.open}
                    onClick={() =>
                      setTransforms({
                        ...transforms,
                        [`${layer.id}:${group.id}`]: !group.open,
                      })
                    }
                  >
                    {group.open ? '▾' : '▸'} {group.label}
                  </button>
                  <span />
                </div>
                {group.open &&
                  group.properties.map(({ key, property, rowIndex }) => {
                    const current = property.keyframes.find((frame) =>
                      currentFrameIds.has(frame.id),
                    );
                    return (
                      <div
                        key={key}
                        className="timeline-row"
                        data-row-index={rowIndex}
                        data-zebra={rowIndex % 2 ? 'b' : 'a'}
                        data-selected={view.frames.some(
                          (ref) => ref.propertyId === property.id,
                        )}
                        role="group"
                        aria-label={`${displayName(layer.name)} ${propertyLabel(key, layer)} 轨道`}
                      >
                        <div
                          className="property-name"
                          data-property-selected={view.selectedProperties.includes(
                            property.id,
                          )}
                          onClick={(event) => {
                            if ((event.target as Element).closest('button'))
                              return;
                            store.selectProperties(
                              event.shiftKey
                                ? [
                                    ...new Set([
                                      ...view.selectedProperties,
                                      property.id,
                                    ]),
                                  ]
                                : [property.id],
                            );
                          }}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            store.selectProperties([property.id]);
                            setPropertyMenu({
                              x: event.clientX,
                              y: event.clientY,
                              id: property.id,
                            });
                          }}
                        >
                          <button
                            className={`animation-switch ${property.keyframes.length ? 'enabled' : ''}`}
                            aria-label={`${property.keyframes.length ? '关闭' : '开启'} ${displayName(layer.name)} ${propertyLabel(key, layer)} 动画`}
                            title="开启动画后，修改数值会自动记录关键帧；关闭会保留当前值并移除该属性动画"
                            disabled={layer.locked}
                            onClick={() =>
                              store.togglePropertyAnimation(property.id)
                            }
                          >
                            <Icon name="clock" />
                          </button>
                          <span>{propertyLabel(key, layer)}</span>
                          <button
                            className={
                              current ? 'current-key-indicator' : undefined
                            }
                            title={
                              current
                                ? '当前时间已有关键帧'
                                : '在当前时间添加关键帧'
                            }
                            aria-label={`添加 ${displayName(layer.name)} ${propertyLabel(key, layer)} 关键帧`}
                            disabled={!!current || layer.locked}
                            onClick={() =>
                              store.recordPropertyKeyframe(property.id)
                            }
                          >
                            <Icon name="diamond" />
                          </button>
                          <button
                            aria-label={`删除 ${displayName(layer.name)} ${propertyLabel(key, layer)} 关键帧`}
                            disabled={!current || layer.locked}
                            onClick={() =>
                              store.run('删除关键帧', [
                                command({
                                  type: 'keyframe.delete',
                                  propertyId: property.id,
                                  keyframeId: current!.id,
                                }),
                              ])
                            }
                          >
                            −
                          </button>
                        </div>
                        <div
                          className="keyframe-track"
                          onClick={(event) => {
                            if (suppressTrackClick.current) {
                              suppressTrackClick.current = false;
                              return;
                            }
                            const r =
                              event.currentTarget.getBoundingClientRect();
                            store.selectFrames([]);
                            store.selectProperties([property.id]);
                            store.setPlaying(false);
                            store.setTime(
                              Math.round(
                                ((event.clientX - r.left) / r.width) *
                                  c.duration *
                                  c.fps,
                              ) / c.fps,
                            );
                          }}
                        >
                          <span
                            className="track-playhead"
                            style={{ left: 'var(--timeline-playhead)' }}
                          />
                          {property.keyframes.map((frame) => (
                            <button
                              key={frame.id}
                              data-easing={frame.interpolation.type}
                              data-property={property.id}
                              data-frame={frame.id}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                if (
                                  !view.frames.some(
                                    (ref) => ref.keyframeId === frame.id,
                                  )
                                )
                                  store.selectFrame({
                                    propertyId: property.id,
                                    keyframeId: frame.id,
                                  });
                                setKeyMenu({
                                  x: event.clientX,
                                  y: event.clientY,
                                });
                              }}
                              className={`keyframe-diamond ${current?.id === frame.id ? 'current' : ''} ${view.frames.some((ref) => ref.keyframeId === frame.id) ? 'selected' : ''}`}
                              style={{
                                left:
                                  !duplicating &&
                                  view.frames.some(
                                    (ref) => ref.keyframeId === frame.id,
                                  )
                                    ? `calc(${(frame.time / c.duration) * 100}% + var(--timeline-key-delta))`
                                    : `${(frame.time / c.duration) * 100}%`,
                              }}
                              aria-label={`关键帧 ${displayName(layer.name)} ${propertyLabel(key, layer)} ${frame.time.toFixed(3)} 秒`}
                              title={`${frame.time} 秒 · ${interpolationLabels[frame.interpolation.type]}`}
                              onPointerDown={(event) => {
                                if (
                                  event.button !== 0 ||
                                  layer.locked ||
                                  interaction.state.type !== 'idle'
                                )
                                  return;
                                event.stopPropagation();
                                event.preventDefault();
                                store.setPlaying(false);
                                if (
                                  event.shiftKey ||
                                  event.ctrlKey ||
                                  event.metaKey ||
                                  !view.frames.some(
                                    (ref) => ref.keyframeId === frame.id,
                                  )
                                )
                                  store.selectFrame(
                                    {
                                      propertyId: property.id,
                                      keyframeId: frame.id,
                                    },
                                    event.shiftKey ||
                                      event.ctrlKey ||
                                      event.metaKey,
                                  );
                                if (
                                  !store
                                    .getSnapshot()
                                    .frames.some(
                                      (ref) => ref.keyframeId === frame.id,
                                    )
                                )
                                  return;
                                event.currentTarget.setPointerCapture(
                                  event.pointerId,
                                );
                                setDuplicating(event.altKey);
                                dragRef.current = {
                                  refs: [...store.getSnapshot().frames],
                                  id: frame.id,
                                  x: event.clientX,
                                  width:
                                    event.currentTarget.parentElement!.getBoundingClientRect()
                                      .width,
                                  delta: 0,
                                  snapshot: view.project,
                                  duplicate: event.altKey,
                                  time: frame.time,
                                  times: c.layers
                                    .flatMap(visibleProperties)
                                    .flatMap(({ property: p }) =>
                                      p.keyframes
                                        .filter((k) =>
                                          store
                                            .getSnapshot()
                                            .frames.some(
                                              (ref) => ref.keyframeId === k.id,
                                            ),
                                        )
                                        .map((k) => k.time),
                                    ),
                                  targets: [
                                    0,
                                    c.duration,
                                    ...c.layers.flatMap((l) =>
                                      l.editor
                                        ? [
                                            l.editor.inPoint,
                                            Math.min(
                                              c.duration,
                                              l.editor.outPoint,
                                            ),
                                          ]
                                        : [],
                                    ),
                                    store.getSnapshot().time,
                                    ...c.layers
                                      .flatMap(visibleProperties)
                                      .flatMap(({ property: p }) =>
                                        p.keyframes
                                          .filter(
                                            (k) =>
                                              !store
                                                .getSnapshot()
                                                .frames.some(
                                                  (ref) =>
                                                    ref.keyframeId === k.id,
                                                ),
                                          )
                                          .map((k) => k.time),
                                      ),
                                  ],
                                };
                              }}
                              onClick={(event) => {
                                event.stopPropagation();
                                store.setPlaying(false);
                                if (event.detail === 0) {
                                  store.selectFrame(
                                    {
                                      propertyId: property.id,
                                      keyframeId: frame.id,
                                    },
                                    event.shiftKey,
                                  );
                                  store.setTime(frame.time);
                                }
                              }}
                            >
                              <span className="diamond-shape" />
                              {duplicating &&
                                view.frames.some(
                                  (ref) => ref.keyframeId === frame.id,
                                ) && (
                                  <span
                                    className="diamond-shape duplicate-keyframe-ghost"
                                    aria-hidden="true"
                                  />
                                )}
                            </button>
                          ))}
                        </div>
                        <details className="track-options">
                          <summary title="插值设置">⋯</summary>
                          <select
                            aria-label={`插值 ${displayName(layer.name)} ${propertyLabel(key, layer)}`}
                            value={current?.interpolation.type ?? 'linear'}
                            disabled={!current || layer.locked}
                            onChange={(event) => {
                              const type = event.target.value;
                              const interpolation: Interpolation =
                                type === 'spring'
                                  ? {
                                      type,
                                      stiffness: 170,
                                      damping: 18,
                                      mass: 1,
                                    }
                                  : type === 'bezier'
                                    ? {
                                        type,
                                        out: { x: 0.42, y: 0 },
                                        in: { x: 0.58, y: 1 },
                                      }
                                    : type === 'hold'
                                      ? { type: 'hold' }
                                      : { type: 'linear' };
                              store.run('修改插值', [
                                command({
                                  type: 'keyframe.update',
                                  propertyId: property.id,
                                  keyframeId: current!.id,
                                  patch: { interpolation },
                                }),
                              ]);
                            }}
                          >
                            <option value="linear">线性</option>
                            <option value="hold">保持</option>
                            <option value="bezier">贝塞尔曲线</option>
                            <option value="spring">弹簧</option>
                          </select>
                        </details>
                      </div>
                    );
                  })}
              </Fragment>
            ))}
        </div>
      )),
    [
      c,
      view.project,
      view.selection,
      view.frames,
      view.propertyFilter,
      view.selectedProperties,
      search,
      renaming,
      renameValue,
      insertion,
      duplicating,
      expanded,
      transforms,
      snapping,
      currentFrameIds,
      store,
    ],
  );
  const playhead = `${(view.time / c.duration) * 100}%`;
  return (
    <section
      className="timeline-panel"
      data-interaction={interaction.state.type}
      style={
        {
          '--timeline-playhead': playhead,
          '--timeline-tree-width': `${treeWidth}px`,
          '--timeline-key-delta': `${((frameDrag?.delta ?? 0) / c.duration) * 100}%`,
          '--timeline-key-delta-px': `${((frameDrag?.delta ?? 0) / c.duration) * (frameDrag?.width ?? 0)}px`,
        } as CSSProperties
      }
      aria-label="时间轴"
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          (event.target as Element).closest(
            'input,textarea,select,[contenteditable=true]',
          )
        )
          return;
        if (
          dispatchShortcut(event.nativeEvent, [
            {
              id: 'timeline-space',
              label: '时间轴平移/播放',
              key: 'space',
              contexts: ['timeline'],
              action: () => {
                if (!spacePan.current) spacePanUsed.current = false;
                spacePan.current = true;
              },
            },
            {
              id: 'timeline-rename',
              label: '重命名图层',
              key: 'f2',
              contexts: ['timeline'],
              action: () => {
                const layer = c.layers.find((l) => l.id === view.selection[0]);
                if (layer) {
                  setRenaming(layer.id);
                  setRenameValue(layer.name);
                }
              },
            },
          ])
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div className="timeline-toolbar">
        <div className="playback-controls">
          <button
            aria-label="回到起点"
            onClick={() => {
              store.setPlaying(false);
              store.setTime(0);
            }}
          >
            <Icon name="start" />
          </button>
          <IconButton
            label="回到终点"
            onClick={() => {
              store.setPlaying(false);
              store.setTime(c.duration);
            }}
          >
            <Icon name="start" style={{ transform: 'rotate(180deg)' }} />
          </IconButton>
          <button
            aria-label={view.playing ? '暂停' : '播放'}
            className="play-button"
            onClick={() => store.setPlaying(!view.playing)}
          >
            <Icon name={view.playing ? 'pause' : 'play'} />
          </button>
          <label className="time-field">
            <input
              aria-label="当前时间（秒）"
              type="number"
              min={0}
              max={c.duration}
              step={1 / c.fps}
              value={Number(view.time.toFixed(3))}
              onChange={(event) => {
                store.setPlaying(false);
                store.setTime(snapToFrame(Number(event.target.value), c.fps));
              }}
            />
            <span>秒</span>
          </label>
          <IconButton
            label="停止"
            onClick={() => {
              store.setPlaying(false);
              store.setTime(0);
            }}
          >
            <Icon name="stop" />
          </IconButton>
          <IconButton
            label="循环播放"
            aria-pressed={loop}
            onClick={() => setLoop(!loop)}
          >
            <Icon name="loop" />
          </IconButton>
          <IconButton
            label="时间轴吸附"
            aria-pressed={snapping}
            title="关键帧吸附到播放头、其他关键帧和边界 · Cmd/Ctrl 临时关闭"
            onClick={() => setSnapping(!snapping)}
          >
            <Icon name="snap" />
          </IconButton>
          <button
            className="timecode"
            title="切换秒 / 时间码"
            onClick={() => setTimecode(!timecode)}
          >
            {timecode
              ? formatTimecode(view.time, c.fps)
              : `${view.time.toFixed(3)} s`}
          </button>
        </div>
        <Tabs
          items={['时间轴', '曲线编辑器', '合成节点']}
          value={
            compositingOpen
              ? '合成节点'
              : graphOpen
                ? '曲线编辑器'
                : motionOpen
                  ? '曲线编辑器'
                  : '时间轴'
          }
          onChange={(tab) => {
            store.setPropertyPreview(undefined);
            store.setPropertyPreviews(undefined);
            setMotionOpen(false);
            setMotionInitialSegment('');
            setGraphOpen(tab === '曲线编辑器');
            setCompositingOpen(tab === '合成节点');
            if (tab !== '合成节点') store.clearGraphSelection();
            localStorage.setItem(
              'motion.active-timeline',
              tab === '合成节点'
                ? 'compositing'
                : tab === '曲线编辑器'
                  ? 'graph'
                  : 'timeline',
            );
          }}
        />
        <span className="timeline-meta">{c.fps} fps</span>
      </div>
      {(graphOpen || motionOpen || compositingOpen) && (
        <CompositionTimeRuler store={store} />
      )}
      <SharedCurveTransport.Provider value={true}>
        {(graphOpen || motionOpen) && (
          <div
            className="curve-function-tabs"
            role="group"
            aria-label="曲线编辑功能"
          >
            <button
              aria-pressed={!motionOpen}
              onClick={() => {
                setMotionOpen(false);
                setGraphOpen(true);
              }}
            >
              数值 / 速度
            </button>
            <button
              aria-pressed={motionOpen}
              onClick={() => {
                setGraphOpen(false);
                setMotionOpen(true);
              }}
            >
              缓动
            </button>
          </div>
        )}
        {motionOpen && (
          <MotionCurvePanel
            store={store}
            key={motionInitialSegment}
            initialSegmentId={motionInitialSegment}
            loop={loop}
            onLoopChange={setLoop}
            onClose={() => {
              setMotionOpen(false);
              setGraphOpen(false);
            }}
          />
        )}
        {compositingOpen && <CompositingGraphPanel store={store} />}
        {graphOpen && (
          <GraphEditor
            store={store}
            embedded
            loop={loop}
            onLoopChange={setLoop}
            onClose={() => setGraphOpen(false)}
          />
        )}
        {!graphOpen && !compositingOpen && !motionOpen && (
          <div
            className="timeline-scroll"
            ref={scrollRef}
            onContextMenu={(event) => {
              if (
                (event.target as Element).closest(
                  'button,.property-name,.timeline-layer-label',
                )
              )
                return;
              event.preventDefault();
              setBlankMenu({ x: event.clientX, y: event.clientY });
            }}
            onPointerDownCapture={(event) => {
              if (interaction.state.type !== 'idle') return;
              if (!spacePan.current && layerMarquee.begin(event)) return;
              suppressTrackClick.current = false;
              if (
                event.button !== 1 &&
                !(event.button === 0 && spacePan.current)
              )
                return;
              event.preventDefault();
              event.stopPropagation();
              spacePanUsed.current = true;
              interaction.slot('panning').current = {
                x: event.clientX,
                scroll: event.currentTarget.scrollLeft,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerDown={(event) => {
              if (
                event.button !== 0 ||
                interaction.state.type !== 'idle' ||
                !(event.target instanceof Element) ||
                !event.target.closest('.keyframe-track') ||
                event.target.closest('button')
              )
                return;
              const m = {
                x: event.clientX,
                y: event.clientY,
                endX: event.clientX,
                endY: event.clientY,
                start: event.shiftKey ? view.frames : [],
              };
              marquee.current = m;
              setBox(m);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const pan = interaction.slot('panning').current;
              if (pan) {
                event.currentTarget.scrollLeft =
                  pan.scroll + pan.x - event.clientX;
                return;
              }
              const m = marquee.current;
              if (!m) return;
              m.endX = event.clientX;
              m.endY = event.clientY;
              setBox({ ...m });
            }}
            onPointerUp={(event) => {
              if (interaction.slot('panning').current) {
                interaction.slot('panning').current = undefined;
                suppressTrackClick.current = true;
                return;
              }
              const m = marquee.current;
              if (m) {
                m.endX = event.clientX;
                m.endY = event.clientY;
              }
              marquee.current = undefined;
              setBox(undefined);
              if (!m) return;
              suppressTrackClick.current =
                Math.hypot(m.endX - m.x, m.endY - m.y) > 3;
              const left = Math.min(m.x, m.endX),
                right = Math.max(m.x, m.endX),
                top = Math.min(m.y, m.endY),
                bottom = Math.max(m.y, m.endY);
              const refs = [...m.start];
              event.currentTarget
                .querySelectorAll<HTMLButtonElement>('.keyframe-diamond')
                .forEach((button) => {
                  const r = button.getBoundingClientRect();
                  if (
                    r.left + r.width / 2 >= left &&
                    r.left + r.width / 2 <= right &&
                    r.top + r.height / 2 >= top &&
                    r.top + r.height / 2 <= bottom
                  ) {
                    const propertyId = button.dataset.property!,
                      keyframeId = button.dataset.frame!;
                    if (!refs.some((ref) => ref.keyframeId === keyframeId))
                      refs.push({ propertyId, keyframeId });
                  }
                });
              store.selectFrames(refs);
            }}
            onPointerCancel={() => {
              interaction.slot('panning').current = undefined;
              marquee.current = undefined;
              setBox(undefined);
            }}
          >
            {box && (
              <div
                className="timeline-marquee"
                style={{
                  left: Math.min(box.x, box.endX),
                  top: Math.min(box.y, box.endY),
                  width: Math.abs(box.endX - box.x),
                  height: Math.abs(box.endY - box.y),
                }}
              />
            )}
            <div
              style={{
                minWidth: 680,
                width: `calc(${treeWidth + 28}px + (100% - ${treeWidth + 28}px) * ${view.timelineZoom})`,
              }}
            >
              <div className="timeline-ruler">
                <span className="timeline-tree-heading">
                  图层 / 属性
                  <span
                    role="separator"
                    aria-label="时间轴属性列宽"
                    aria-orientation="vertical"
                    tabIndex={0}
                    className="timeline-column-resizer"
                    onKeyDown={(event) => {
                      if (
                        event.key === 'ArrowLeft' ||
                        event.key === 'ArrowRight'
                      ) {
                        event.preventDefault();
                        setTreeWidth((w) =>
                          Math.max(
                            220,
                            Math.min(
                              480,
                              w + (event.key === 'ArrowLeft' ? -10 : 10),
                            ),
                          ),
                        );
                      }
                    }}
                    onPointerDown={(event) => {
                      if (
                        event.button !== 0 ||
                        interaction.state.type !== 'idle'
                      )
                        return;
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      treeResize.current = {
                        x: event.clientX,
                        width: treeWidth,
                      };
                    }}
                    onPointerMove={(event) => {
                      if (treeResize.current)
                        setTreeWidth(
                          Math.max(
                            220,
                            Math.min(
                              480,
                              treeResize.current.width +
                                event.clientX -
                                treeResize.current.x,
                            ),
                          ),
                        );
                    }}
                    onPointerUp={() => {
                      treeResize.current = undefined;
                    }}
                    onPointerCancel={() => {
                      if (treeResize.current)
                        setTreeWidth(treeResize.current.width);
                      treeResize.current = undefined;
                    }}
                  />
                </span>
                <div
                  className="ruler-track"
                  role="slider"
                  tabIndex={0}
                  aria-label="播放头"
                  aria-valuemin={0}
                  aria-valuemax={c.duration}
                  aria-valuenow={view.time}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'ArrowLeft' ||
                      event.key === 'ArrowRight'
                    ) {
                      event.preventDefault();
                      store.setPlaying(false);
                      store.setTime(
                        view.time +
                          (event.key === 'ArrowLeft' ? -1 : 1) / c.fps,
                      );
                    }
                  }}
                  onPointerDown={(event) => {
                    if (event.button !== 0 || interaction.state.type !== 'idle')
                      return;
                    const r = event.currentTarget.getBoundingClientRect();
                    rulerDrag.current = {
                      time: store.getSnapshot().time,
                      left: r.left,
                      width: Math.max(1, r.width),
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
                    store.setPlaying(false);
                    store.setTime(
                      Math.round(
                        ((event.clientX - r.left) / r.width) *
                          c.duration *
                          c.fps,
                      ) / c.fps,
                    );
                  }}
                  onPointerMove={(event) => {
                    if (!rulerDrag.current) return;
                    const r = event.currentTarget.getBoundingClientRect();
                    store.setTime(
                      Math.round(
                        ((event.clientX - r.left) / r.width) *
                          c.duration *
                          c.fps,
                      ) / c.fps,
                    );
                  }}
                  onPointerUp={() => {
                    rulerDrag.current = undefined;
                  }}
                  onPointerCancel={() => {
                    if (rulerDrag.current)
                      store.setTime(rulerDrag.current.time);
                    rulerDrag.current = undefined;
                  }}
                >
                  {frameDrag?.snapTime !== undefined && (
                    <span
                      className="timeline-snap-guide"
                      aria-label="关键帧吸附参考线"
                      style={{
                        left: `${(frameDrag.snapTime / c.duration) * 100}%`,
                      }}
                    />
                  )}
                  <span className="ruler-playhead" style={{ left: playhead }}>
                    ▼
                  </span>
                  {timelineTicks(
                    c.duration,
                    c.fps,
                    Math.max(1, viewportWidth - treeWidth - 28) *
                      view.timelineZoom,
                    timecode,
                  ).map((tick) => (
                    <span
                      key={tick.time}
                      className={`timeline-tick ${tick.major ? 'major' : 'minor'}`}
                      style={{ left: `${(tick.time / c.duration) * 100}%` }}
                    >
                      {tick.label}
                    </span>
                  ))}
                </div>
                <span>插值</span>
              </div>
              <div className="timeline-body">
                {c.layers.length === 0 && (
                  <p className="timeline-empty">
                    添加图层后，点击秒表开启动画，或点击 ◇ 添加关键帧。
                  </p>
                )}
                {layerRows}
              </div>
            </div>
          </div>
        )}
        <div
          className="timeline-footer"
          hidden={compositingOpen || graphOpen || motionOpen}
        >
          <input
            className="timeline-search"
            aria-label="搜索时间轴属性"
            placeholder="搜索图层 / 属性"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <label className="timeline-filter">
            {' '}
            <select
              aria-label="时间轴属性筛选"
              value={view.propertyFilter}
              onChange={(e) =>
                store.setPropertyFilter(
                  e.target.value as typeof view.propertyFilter,
                )
              }
            >
              {(
                [
                  ['all', '全部'],
                  ['animated', '已有动画'],
                  ['selected', '所选属性'],
                  ['position', '位置'],
                  ['scale', '缩放'],
                  ['rotation', '旋转'],
                  ['opacity', '透明度'],
                ] as const
              ).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              zoomAnchor.current = undefined;
              store.setTimelineZoom(1);
              if (scrollRef.current) scrollRef.current.scrollLeft = 0;
            }}
            aria-label="适合合成时长"
          >
            适合时长
          </button>
          <label className="timeline-zoom">
            缩放
            <input
              type="range"
              aria-label="时间轴缩放"
              min={1}
              max={32}
              step={0.1}
              value={view.timelineZoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
        </div>
      </SharedCurveTransport.Provider>
      {layerMarquee.overlay}
      {blankMenu && (
        <CreateLayerMenu
          store={store}
          {...blankMenu}
          onClose={() => setBlankMenu(undefined)}
          items={[
            { label: '粘贴', action: () => store.pasteSelection() },
            {
              label: '适合合成时长',
              action: () => {
                store.setTimelineZoom(1);
                if (scrollRef.current) scrollRef.current.scrollLeft = 0;
              },
            },
          ]}
        />
      )}
      {propertyMenu && (
        <ContextMenu
          {...propertyMenu}
          onClose={() => setPropertyMenu(undefined)}
          items={[
            {
              label: '添加关键帧',
              action: () => {
                store.recordPropertyKeyframe(propertyMenu.id);
              },
            },
            {
              label: '移除动画',
              action: () => {
                const p = findProperty(
                  store.getSnapshot().project,
                  propertyMenu.id,
                ).property;
                if (p.keyframes.length) store.togglePropertyAnimation(p.id);
              },
            },
            { label: '粘贴到此属性', action: () => store.pasteSelection() },
            {
              label: '打开曲线编辑器',
              action: () => {
                setMotionOpen(false);
                setGraphOpen(true);
              },
            },
            {
              label: '打开动画缓动',
              action: () => {
                setGraphOpen(false);
                setMotionOpen(true);
              },
            },
          ]}
        />
      )}
      {layerMenu && (
        <ContextMenu
          {...layerMenu}
          items={[
            ...layerActions(
              store,
              () => {
                const l = c.layers.find(
                  (l) => l.id === store.getSnapshot().selection[0],
                );
                if (l) {
                  setRenaming(l.id);
                  setRenameValue(l.name);
                }
              },
              'timeline',
            ),
            {
              label: '在播放头拆分图层',
              action: () => {
                try {
                  store.run(
                    '拆分图层',
                    store
                      .getSnapshot()
                      .selection.flatMap((id) =>
                        splitLayerCommands(
                          store.getSnapshot().project,
                          id,
                          store.getSnapshot().time,
                        ),
                      ),
                  );
                } catch (e) {
                  store.setStatus(
                    e instanceof Error ? e.message : '拆分失败',
                    true,
                  );
                }
              },
            },
          ]}
          onClose={() => setLayerMenu(undefined)}
        />
      )}
      {keyMenu && (
        <ContextMenu
          {...keyMenu}
          onClose={() => setKeyMenu(undefined)}
          items={[
            {
              label: '缓入',
              action: () =>
                interpolation('bezier', { x: 0.42, y: 0 }, { x: 1, y: 1 }),
            },
            {
              label: '缓出',
              action: () =>
                interpolation('bezier', { x: 0, y: 0 }, { x: 0.58, y: 1 }),
            },
            { label: '缓入缓出', action: () => interpolation('bezier') },
            { label: '线性', action: () => interpolation('linear') },
            { label: '保持', action: () => interpolation('hold') },
            {
              label: '打开曲线编辑器',
              action: () => {
                setMotionOpen(false);
                setGraphOpen(true);
              },
            },
            {
              label: '打开动画缓动',
              action: () => {
                setGraphOpen(false);
                setMotionOpen(true);
              },
            },
            {
              label: '复制缓动',
              action: () => {
                const segment = easingSegments()[0];
                if (segment) {
                  const curve = segmentMotionCurve(segment.from, segment.to);
                  if (curve) {
                    store.motionCurveClipboard.copy(curve);
                    store.setStatus('缓动已复制');
                  }
                }
              },
            },
            {
              label: '粘贴缓动',
              disabled: !store.motionCurveClipboard.read(),
              action: () => {
                const curve = store.motionCurveClipboard.read();
                if (curve)
                  store.run(
                    '粘贴缓动',
                    applyMotionCurveCommands(
                      view.project,
                      easingSegments().map((s) => s.id),
                      curve,
                    ),
                  );
              },
            },
            {
              label: '复制',
              shortcut: '⌘C',
              action: () => store.copySelection(),
            },
            {
              label: '粘贴',
              shortcut: '⌘V',
              action: () => store.pasteSelection(),
            },
            {
              label: '复制关键帧到下一帧',
              action: () => store.duplicateSelection(),
            },
            {
              label: '删除关键帧',
              shortcut: 'Delete',
              action: () => store.deleteSelected(),
            },
          ]}
        />
      )}
    </section>
  );
}
