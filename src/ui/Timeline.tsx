import { Icon } from './workspace/icons';
import { snapTimeDelta } from '../core/timeline-snapping';
import { CompositingGraphPanel } from './CompositingGraph';
import { motionSegments, segmentMotionCurve } from '../core/motion-curve';
import { applyMotionCurveCommands } from '../core/motion-curve-commands';
import { useInteractionCancel } from './workspace/interaction';
import {
  ContextMenu,
  MenuDropdown,
  IconButton,
  Tabs,
} from './workspace/primitives';
import { MotionCurvePanel } from './MotionCurvePanel';
import { LayerTimeBar } from './LayerTimeBar';
import { GraphEditor } from './GraphEditor';
import { visibleProperties, propertyLabel } from './property-labels';
import { interpolationLabels, displayName } from './labels';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { CSSProperties } from 'react';
import { command } from '../core/command-system';
import { newId } from '../core/core-types';
import { evaluateProperty } from '../core/animation-engine';
import { activeComposition } from '../core/project-model';
import type { Interpolation } from '../core/project-model';
import type { EditorStore } from './editor-store';
import { advancePlayback } from './playback';

export function Timeline({ store }: { store: EditorStore }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomAnchor = useRef<{ time: number; x: number } | undefined>(undefined);
  const rulerDrag = useRef<{ time: number } | undefined>(undefined);
  const [snapping, setSnapping] = useState(true);
  const marquee = useRef<
    | {
        x: number;
        y: number;
        endX: number;
        endY: number;
        start: readonly import('../core/editing-commands').FrameRef[];
      }
    | undefined
  >(undefined);
  const [box, setBox] = useState<{
    x: number;
    y: number;
    endX: number;
    endY: number;
  }>();
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
  const [motionOpen, setMotionOpen] = useState(false);
  const [frameDrag, setFrameDrag] = useState<{
    id: string;
    delta: number;
    snapTime?: number;
  }>();
  const dragRef = useRef<
    | {
        id: string;
        x: number;
        width: number;
        delta: number;
        snapshot: unknown;
        duplicate: boolean;
        times: readonly number[];
        targets: readonly number[];
      }
    | undefined
  >(undefined);
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const c = activeComposition(view.project);
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
      220 +
        (view.time / c.duration) *
          Math.max(1, el.clientWidth - 310) *
          view.timelineZoom -
        el.scrollLeft;
    const time =
      x === undefined
        ? view.time
        : ((el.scrollLeft + cursor - 220) /
            Math.max(1, el.clientWidth - 310) /
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
      220 +
      (a.time / c.duration) *
        Math.max(1, el.clientWidth - 310) *
        view.timelineZoom -
      a.x;
    zoomAnchor.current = undefined;
  }, [view.timelineZoom, c.duration]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) return;
      event.preventDefault();
      const current = store.getSnapshot();
      const x = event.clientX - el.getBoundingClientRect().left;
      const time =
        ((el.scrollLeft + x - 220) /
          Math.max(1, el.clientWidth - 310) /
          current.timelineZoom) *
        c.duration;
      zoomAnchor.current = { time, x };
      store.setTimelineZoom(
        current.timelineZoom * Math.exp(-event.deltaY * 0.002),
      );
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [store, c.duration]);
  useInteractionCancel(() => {
    dragRef.current = undefined;
    setFrameDrag(undefined);
    marquee.current = undefined;
    setBox(undefined);
    if (rulerDrag.current) store.setTime(rulerDrag.current.time);
    rulerDrag.current = undefined;
    setKeyMenu(undefined);
  });
  const easingSegments = () => {
    const selected = store.getSnapshot().frames;
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
      store.clearGraphSelection();
    };
    const motion = () => setMotionOpen(true);
    window.addEventListener('motion:motion-curve', motion);
    window.addEventListener('motion:graph', open);
    return () => {
      window.removeEventListener('motion:graph', open);
      window.removeEventListener('motion:motion-curve', motion);
    };
  }, []);
  useEffect(() => {
    localStorage.setItem(
      'motion.active-timeline',
      compositingOpen ? 'compositing' : graphOpen ? 'graph' : 'timeline',
    );
  }, [graphOpen, compositingOpen]);
  const timelineFrames = useMemo(
    () =>
      c.layers.flatMap((layer) =>
        visibleProperties(layer).flatMap(({ property }) => property.keyframes),
      ),
    [c],
  );
  const currentFrameSignature = timelineFrames
    .filter((frame) => Math.abs(frame.time - view.time) < 1e-8)
    .map((frame) => frame.id)
    .join(',');
  const currentFrameIds = useMemo(
    () => new Set(currentFrameSignature.split(',')),
    [currentFrameSignature],
  );
  // Playhead movement between keys does not rebuild static track/keyframe DOM.
  // Commands read the live time, never the memoized row's captured time.
  const layerRows = useMemo(
    () =>
      [...c.layers].reverse().map((layer) => (
        <div className="timeline-layer" key={layer.id} data-layer={layer.id}>
          <div className="timeline-layer-heading">
            <button
              className="layer-disclosure"
              aria-label={`展开 ${displayName(layer.name)} 属性`}
              aria-expanded={
                expanded[layer.id] ?? view.selection.includes(layer.id)
              }
              onClick={() =>
                setExpanded({
                  ...expanded,
                  [layer.id]: !(
                    expanded[layer.id] ?? view.selection.includes(layer.id)
                  ),
                })
              }
            >
              {(expanded[layer.id] ?? view.selection.includes(layer.id))
                ? '▾'
                : '▸'}
            </button>
            <button
              className={`timeline-layer-name ${view.selection.includes(layer.id) ? 'active' : ''}`}
              onClick={(event) => store.select(layer.id, event.shiftKey)}
            >
              {displayName(layer.name)}
            </button>
            <LayerTimeBar store={store} layer={layer} composition={c} />
          </div>
          {(expanded[layer.id] ?? view.selection.includes(layer.id)) && (
            <>
              <button
                className="transform-disclosure"
                aria-expanded={transforms[layer.id] ?? true}
                onClick={() =>
                  setTransforms({
                    ...transforms,
                    [layer.id]: !(transforms[layer.id] ?? true),
                  })
                }
              >
                {(transforms[layer.id] ?? true) ? '▾' : '▸'} 变换与动画属性
              </button>
              {(transforms[layer.id] ?? true) &&
                visibleProperties(layer)
                  .filter(
                    ({ key, property }) =>
                      key.startsWith('transform.') ||
                      property.keyframes.length > 0 ||
                      view.frames.some((ref) => ref.propertyId === property.id),
                  )
                  .filter(
                    ({ key, property }) =>
                      view.propertyFilter === 'all' ||
                      `transform.${view.propertyFilter}` === key ||
                      (view.propertyFilter === 'animated' &&
                        property.keyframes.length > 0),
                  )
                  .map(({ key, property }) => {
                    const current = property.keyframes.find((frame) =>
                      currentFrameIds.has(frame.id),
                    );
                    return (
                      <div
                        key={key}
                        className="timeline-row"
                        role="group"
                        aria-label={`${displayName(layer.name)} ${propertyLabel(key, layer)} 轨道`}
                      >
                        <div className="property-name">
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
                            aria-label={`添加 ${displayName(layer.name)} ${propertyLabel(key, layer)} 关键帧`}
                            disabled={!!current || layer.locked}
                            onClick={() =>
                              store.run('添加关键帧', [
                                command({
                                  type: 'keyframe.add',
                                  propertyId: property.id,
                                  keyframe: {
                                    id: newId(),
                                    time: store.getSnapshot().time,
                                    value: evaluateProperty(
                                      property,
                                      store.getSnapshot().time,
                                    ),
                                    interpolation: { type: 'linear' },
                                  },
                                }),
                              ])
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
                            const r =
                              event.currentTarget.getBoundingClientRect();
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
                                left: `${((frame.time + (frameDrag && view.frames.some((ref) => ref.keyframeId === frame.id) ? frameDrag.delta : 0)) / c.duration) * 100}%`,
                              }}
                              aria-label={`关键帧 ${displayName(layer.name)} ${propertyLabel(key, layer)} ${frame.time.toFixed(3)} 秒`}
                              title={`${frame.time} 秒 · ${interpolationLabels[frame.interpolation.type]}`}
                              onPointerDown={(event) => {
                                if (event.button !== 0 || layer.locked) return;
                                event.stopPropagation();
                                event.preventDefault();
                                store.setPlaying(false);
                                if (
                                  event.shiftKey ||
                                  !view.frames.some(
                                    (ref) => ref.keyframeId === frame.id,
                                  )
                                )
                                  store.selectFrame(
                                    {
                                      propertyId: property.id,
                                      keyframeId: frame.id,
                                    },
                                    event.shiftKey,
                                  );
                                event.currentTarget.setPointerCapture(
                                  event.pointerId,
                                );
                                dragRef.current = {
                                  id: frame.id,
                                  x: event.clientX,
                                  width:
                                    event.currentTarget.parentElement!.getBoundingClientRect()
                                      .width,
                                  delta: 0,
                                  snapshot: view.project,
                                  duplicate: event.altKey,
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
                              onPointerMove={(event) => {
                                const drag = dragRef.current;
                                if (!drag || drag.id !== frame.id) return;
                                if (
                                  drag.snapshot !== store.getSnapshot().project
                                ) {
                                  dragRef.current = undefined;
                                  setFrameDrag(undefined);
                                  return;
                                }
                                const result = snapTimeDelta(
                                  drag.times,
                                  ((event.clientX - drag.x) /
                                    Math.max(1, drag.width)) *
                                    c.duration,
                                  c.duration,
                                  c.fps,
                                  drag.targets,
                                  snapping && !event.metaKey && !event.ctrlKey
                                    ? (8 / Math.max(1, drag.width)) * c.duration
                                    : -1,
                                );
                                drag.delta = result.delta;
                                setFrameDrag({
                                  id: frame.id,
                                  ...result,
                                });
                              }}
                              onPointerUp={(event) => {
                                event.stopPropagation();
                                const drag = dragRef.current;
                                dragRef.current = undefined;
                                setFrameDrag(undefined);
                                if (
                                  drag &&
                                  drag.snapshot === store.getSnapshot().project
                                ) {
                                  if (Math.abs(drag.delta) > 1e-8) {
                                    if (drag.duplicate) {
                                      const commands = view.frames.map(
                                        (ref) => {
                                          const property =
                                            visibleProperties(layer).find(
                                              (entry) =>
                                                entry.property.id ===
                                                ref.propertyId,
                                            )?.property ??
                                            c.layers
                                              .flatMap(visibleProperties)
                                              .find(
                                                (entry) =>
                                                  entry.property.id ===
                                                  ref.propertyId,
                                              )?.property;
                                          const source =
                                            property?.keyframes.find(
                                              (k) => k.id === ref.keyframeId,
                                            );
                                          if (!source)
                                            throw new Error('关键帧不存在');
                                          return command({
                                            type: 'keyframe.add',
                                            propertyId: ref.propertyId,
                                            keyframe: {
                                              ...source,
                                              id: newId(),
                                              time: source.time + drag.delta,
                                            },
                                          });
                                        },
                                      );
                                      store.run('拖动复制关键帧', commands);
                                    } else store.moveSelectedFrames(drag.delta);
                                  } else store.setTime(frame.time);
                                } else if (drag)
                                  store.setStatus(
                                    '工程已变化，关键帧拖动已取消',
                                    true,
                                  );
                              }}
                              onPointerCancel={() => {
                                dragRef.current = undefined;
                                setFrameDrag(undefined);
                              }}
                              onLostPointerCapture={() => {
                                dragRef.current = undefined;
                                setFrameDrag(undefined);
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
            </>
          )}
        </div>
      )),
    [
      c,
      view.project,
      view.selection,
      view.frames,
      view.propertyFilter,
      expanded,
      transforms,
      frameDrag,
      snapping,
      currentFrameIds,
      store,
    ],
  );
  const playhead = `${(view.time / c.duration) * 100}%`;
  return (
    <section
      className="timeline-panel"
      style={{ '--timeline-playhead': playhead } as CSSProperties}
      aria-label="时间轴"
      tabIndex={0}
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
                store.setTime(Number(event.target.value));
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
              ? `${String(Math.floor(view.time / 3600)).padStart(2, '0')}:${String(Math.floor(view.time / 60) % 60).padStart(2, '0')}:${String(Math.floor(view.time) % 60).padStart(2, '0')}:${String(Math.floor((view.time % 1) * c.fps)).padStart(2, '0')}`
              : `${view.time.toFixed(3)} s`}
          </button>
        </div>
        <Tabs
          items={['时间轴', '曲线编辑器', '合成节点']}
          value={
            compositingOpen ? '合成节点' : graphOpen ? '曲线编辑器' : '时间轴'
          }
          onChange={(tab) => {
            store.setPropertyPreview(undefined);
            store.setPropertyPreviews(undefined);
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
      {motionOpen && (
        <MotionCurvePanel store={store} onClose={() => setMotionOpen(false)} />
      )}
      {compositingOpen && <CompositingGraphPanel store={store} />}
      {graphOpen && (
        <GraphEditor
          store={store}
          embedded
          onClose={() => setGraphOpen(false)}
        />
      )}
      {!graphOpen && !compositingOpen && (
        <div
          className="timeline-scroll"
          ref={scrollRef}
          onPointerDown={(event) => {
            if (
              event.button !== 0 ||
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
            const m = marquee.current;
            if (!m) return;
            m.endX = event.clientX;
            m.endY = event.clientY;
            setBox({ ...m });
          }}
          onPointerUp={(event) => {
            const m = marquee.current;
            marquee.current = undefined;
            setBox(undefined);
            if (!m) return;
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
              width: `calc(310px + (100% - 310px) * ${view.timelineZoom})`,
            }}
          >
            <div className="timeline-ruler">
              <span>图层 / 属性</span>
              <div
                className="ruler-track"
                role="slider"
                tabIndex={0}
                aria-label="播放头"
                aria-valuemin={0}
                aria-valuemax={c.duration}
                aria-valuenow={view.time}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    store.setPlaying(false);
                    store.setTime(
                      view.time + (event.key === 'ArrowLeft' ? -1 : 1) / c.fps,
                    );
                  }
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  rulerDrag.current = { time: store.getSnapshot().time };
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const r = event.currentTarget.getBoundingClientRect();
                  store.setPlaying(false);
                  store.setTime(
                    Math.round(
                      ((event.clientX - r.left) / r.width) * c.duration * c.fps,
                    ) / c.fps,
                  );
                }}
                onPointerMove={(event) => {
                  if (!rulerDrag.current) return;
                  const r = event.currentTarget.getBoundingClientRect();
                  store.setTime(
                    Math.round(
                      ((event.clientX - r.left) / r.width) * c.duration * c.fps,
                    ) / c.fps,
                  );
                }}
                onPointerUp={() => {
                  rulerDrag.current = undefined;
                }}
                onPointerCancel={() => {
                  if (rulerDrag.current) store.setTime(rulerDrag.current.time);
                  rulerDrag.current = undefined;
                }}
                onLostPointerCapture={() => {
                  if (rulerDrag.current) store.setTime(rulerDrag.current.time);
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
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i}>
                    {Number(((c.duration * i) / 5).toFixed(2))} 秒
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
      <div className="timeline-footer" hidden={compositingOpen}>
        <button onClick={() => setMotionOpen((v) => !v)}>动画缓动</button>
        <MenuDropdown>
          <summary>关键帧 ▾</summary>
          <div className="dropdown-menu">
            <button
              aria-label="上一个关键帧"
              onClick={() => store.jumpFrame(-1)}
            >
              上一个关键帧
            </button>
            <button
              aria-label="下一个关键帧"
              onClick={() => store.jumpFrame(1)}
            >
              下一个关键帧
            </button>
            <button onClick={() => store.copySelection()}>复制</button>
            <button onClick={() => store.pasteSelection()}>粘贴</button>
            <button
              disabled={!view.frames.length}
              onClick={() => store.duplicateSelection()}
            >
              复制关键帧到下一帧
            </button>
            <button
              disabled={!view.frames.length}
              onClick={() => store.deleteSelected()}
            >
              删除关键帧
            </button>
          </div>
        </MenuDropdown>
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
        <label className="timeline-zoom">
          缩放
          <input
            type="range"
            aria-label="时间轴缩放"
            min={1}
            max={8}
            step={0.1}
            value={view.timelineZoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
      </div>
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
            { label: '打开曲线编辑器', action: () => setGraphOpen(true) },
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
