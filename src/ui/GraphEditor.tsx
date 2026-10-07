import { usePointerRelease } from './workspace/pointer-release';
import { Modal, IconButton } from './workspace/primitives';
import { dispatchShortcut } from './workspace/shortcuts';
import { useInteractionCancel } from './workspace/interaction';
import {
  applyMotionCurveCommands,
  previewMotionCurve,
} from '../core/motion-curve-commands';
import { SpatialMotionEditor } from './SpatialMotionEditor';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { Vec2, AnimValue } from '../core/core-types';
import type { Property } from '../core/project-model';
import { activeComposition } from '../core/project-model';
import {
  controlsFromSpeed,
  easePresets,
  sampleCurve,
  segmentControls,
  speedsFromControls,
  valueComponent,
  spatialEndpointDistances,
  propertySpeedUnit,
  components,
} from '../core/curve-model';
import { visibleProperties, propertyLabel } from './property-labels';
import { NumberField } from './fields';
import type { EditorStore } from './editor-store';

export function GraphEditor({
  store,
  onClose,
  embedded = false,
}: {
  store: EditorStore;
  onClose: () => void;
  embedded?: boolean;
}) {
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot),
    c = activeComposition(view.project),
    layer =
      c.layers.find((l) =>
        visibleProperties(l).some(
          (e) => e.property.id === view.selectedProperties[0],
        ),
      ) ?? c.layers.find((l) => l.id === view.selection[0]);
  const entries = layer ? visibleProperties(layer) : [];
  const [chosen, setChosen] = useState(''),
    [mode, setMode] = useState<'value' | 'speed'>('value'),
    [component, setComponent] = useState(0),
    [segmentId, setSegmentId] = useState('');
  const gesture = useRef<
    | {
        which: 'out' | 'in';
        controls: { out: Vec2; in: Vec2 };
        project: unknown;
        key: string;
        domain: { start: number; end: number; min: number; max: number };
      }
    | undefined
  >(undefined);
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgSize, setSvgSize] = useState({ width: 680, height: 280 });
  const measureSvg = useCallback((svg: SVGSVGElement | null) => {
    svgRef.current = svg;
    if (!svg) return;
    const measure = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width && rect.height)
        setSvgSize((previous) =>
          previous.width === rect.width && previous.height === rect.height
            ? previous
            : { width: rect.width, height: rect.height },
        );
    };
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(svg);
    return () => observer?.disconnect();
  }, []);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const space = useRef(false);
  const panUsed = useRef(false);
  const [grabbing, setGrabbing] = useState(false);
  const pan = useRef<
    | {
        x: number;
        y: number;
        width: number;
        height: number;
        view: typeof viewport;
      }
    | undefined
  >(undefined);
  const zoomAt = (factor: number, x = 340, y = 140) => {
    setViewport((v) => {
      const zoom = Math.max(0.5, Math.min(8, v.zoom * factor));
      return {
        x: v.x + x / v.zoom - x / zoom,
        y: v.y + y / v.zoom - y / zoom,
        zoom,
      };
    });
  };
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      if (gesture.current || pan.current) return;
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      zoomAt(
        Math.exp(-event.deltaY * 0.002),
        ((event.clientX - rect.left) / rect.width) * 680,
        ((event.clientY - rect.top) / rect.height) * 280,
      );
    };
    const release = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        if (
          space.current &&
          !panUsed.current &&
          !(e.target as Element)?.closest?.('input,textarea,select')
        )
          store.setPlaying(!store.getSnapshot().playing);
        space.current = false;
        setGrabbing(false);
      }
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keyup', release);
    return () => {
      svg.removeEventListener('wheel', wheel);
      window.removeEventListener('keyup', release);
    };
  });
  useInteractionCancel(() => {
    gesture.current = undefined;
    if (pan.current) setViewport(pan.current.view);
    pan.current = undefined;
    space.current = false;
    setGrabbing(false);
    store.setPropertyPreviews(undefined);
  });
  const domainRef = useRef<
    { key: string; min: number; max: number } | undefined
  >(undefined);
  const fitCurve = () => {
    domainRef.current = undefined;
    setViewport({ x: 0, y: 0, zoom: 1 });
  };
  const pointerHandlers = useRef<{
    move: (event: PointerEvent) => void;
    finish: () => void;
  }>({
    move: () => {},
    finish: () => {},
  });
  usePointerRelease({
    active: () => !!gesture.current,
    move: (e) => pointerHandlers.current.move(e),
    finish: () => pointerHandlers.current.finish(),
    cancel: () => {
      gesture.current = undefined;
      store.setPropertyPreviews(undefined);
    },
  });
  const entry =
    entries.find((e) => e.property.id === chosen) ??
    entries.find((e) => e.property.id === view.selectedProperties[0]) ??
    entries.find((e) => e.property.id === view.frames[0]?.propertyId) ??
    entries.find((e) => e.property.keyframes.length > 1) ??
    entries[0];
  if (!entry)
    return (
      <GraphFrame embedded={embedded} onClose={onClose} empty>
        <section className="graph-dialog">
          <h2>曲线编辑器</h2>
          <button
            aria-label={view.playing ? '暂停曲线预览' : '播放曲线预览'}
            onClick={() => store.setPlaying(!view.playing)}
          >
            {view.playing ? '暂停' : '播放'}预览
          </button>
          <p>先选择一个图层。</p>
          <button onClick={onClose}>关闭曲线编辑器</button>
        </section>
      </GraphFrame>
    );
  const pixelX = 680 / (svgSize.width * viewport.zoom),
    pixelY = 280 / (svgSize.height * viewport.zoom);
  const original = entry.property,
    p: Property<AnimValue> =
      view.propertyPreview?.id === original.id
        ? view.propertyPreview.property
        : (view.propertyPreviews?.find((v) => v.id === original.id) ??
          original);
  const frames = [...p.keyframes].sort((a, b) => a.time - b.time),
    candidate =
      frames.find((k) => k.id === segmentId) ??
      frames.find((k) => k.id === view.frames[0]?.keyframeId) ??
      frames[0],
    index = candidate
      ? Math.max(0, Math.min(frames.indexOf(candidate), frames.length - 2))
      : 0,
    left = frames[index],
    right = frames[index + 1];
  const domainKey = `${original.id}/${left?.id}/${right?.id}/${mode}/${component}`;
  const fixedDomain =
    domainRef.current?.key === domainKey ? domainRef.current : undefined;
  const start = frames[0]?.time ?? 0,
    end = Math.max(start + 1 / c.fps, frames.at(-1)?.time ?? c.duration);
  const unit = propertySpeedUnit(entry.key),
    factor = mode === 'speed' ? unit.factor : 1;
  const samples = sampleCurve(p, start, end, mode, component).map((s) => ({
      ...s,
      value: s.value * factor,
    })),
    vals = samples.map((v) => v.value),
    rawMin = Math.min(...vals),
    rawMax = Math.max(...vals),
    padding = Math.max(1, (rawMax - rawMin) * 0.15),
    min = fixedDomain?.min ?? rawMin - padding,
    max = fixedDomain?.max ?? rawMax + padding;
  const X = (t: number) => 50 + ((t - start) / (end - start)) * 580,
    Y = (v: number) => 235 - ((v - min) / (max - min)) * 205;
  const path = samples
    .map(
      (v, i) =>
        `${i ? 'L' : 'M'}${X(v.time).toFixed(2)},${Y(v.value).toFixed(2)}`,
    )
    .join(' ');
  const controls = left
    ? segmentControls(left, right)
    : { out: { x: 0.33, y: 0.33 }, in: { x: 0.67, y: 0.67 } };
  const apply = (ctrl: { out: Vec2; in: Vec2 }) => {
    if (!left || !right) return;
    store.setPropertyPreviews(undefined);
    try {
      store.run(
        '修改动画曲线',
        applyMotionCurveCommands(
          view.project,
          [`${original.id}/${left.id}/${right.id}`],
          {
            type: 'cubic-bezier',
            x1: ctrl.out.x,
            y1: ctrl.out.y,
            x2: ctrl.in.x,
            y2: ctrl.in.y,
          },
        ),
      );
    } catch (e) {
      store.setStatus(e instanceof Error ? e.message : '曲线无效', true);
    }
  };
  const handlePoint = (which: 'out' | 'in') => {
    if (!left || !right) return { x: 0, y: 0 };
    const pt = controls[which],
      time = left.time + (right.time - left.time) * pt.x;
    let value =
      valueComponent(left.value, component) +
      (valueComponent(right.value, component) -
        valueComponent(left.value, component)) *
        pt.y;
    if (mode === 'speed') {
      const s = speedsFromControls(left, right);
      value = Math.abs(which === 'out' ? s.outSpeed : s.inSpeed) * factor;
    }
    return { x: X(time), y: Y(value) };
  };
  const speed = left && right ? speedsFromControls(left, right) : undefined;
  const editSpeed = (
    field: 'outSpeed' | 'inSpeed' | 'outInfluence' | 'inInfluence',
    value: number,
    preview = false,
  ) => {
    if (speed && left && right) {
      const n = {
        ...speed,
        [field]: field.includes('Speed') ? value / factor : value,
      };
      const converted = controlsFromSpeed(
        left,
        right,
        n.outInfluence,
        n.inInfluence,
        n.outSpeed,
        n.inSpeed,
      );
      const originalControls = segmentControls(left, right);
      const controls = field.startsWith('out')
        ? { out: converted.out, in: originalControls.in }
        : { out: originalControls.out, in: converted.in };
      if (preview)
        store.setPropertyPreviews(
          previewMotionCurve(
            view.project,
            [`${original.id}/${left.id}/${right.id}`],
            {
              type: 'cubic-bezier',
              x1: controls.out.x,
              y1: controls.out.y,
              x2: controls.in.x,
              y2: controls.in.y,
            },
          ),
        );
      else apply(controls);
    }
  };
  const curveKey = domainKey;
  const endGesture = () => {
    const g = gesture.current;
    gesture.current = undefined;
    if (g && g.project === store.getSnapshot().project && g.key === curveKey)
      apply(g.controls);
    else store.setPropertyPreviews(undefined);
  };
  pointerHandlers.current = {
    finish: endGesture,
    move: (e) => {
      const g = gesture.current;
      const which = g?.which;
      if (!g || !which || !left || !right) return;
      if (g.project !== view.project || g.key !== curveKey) {
        gesture.current = undefined;
        store.setPropertyPreviews(undefined);
        return;
      }
      const svg = svgRef.current!,
        rect = svg.getBoundingClientRect(),
        x =
          viewport.x +
          ((e.clientX - rect.left) * 680) /
            Math.max(1, rect.width) /
            viewport.zoom,
        y =
          viewport.y +
          ((e.clientY - rect.top) * 280) /
            Math.max(1, rect.height) /
            viewport.zoom,
        time =
          g.domain.start + ((x - 50) / 580) * (g.domain.end - g.domain.start),
        val = g.domain.min + ((235 - y) / 205) * (g.domain.max - g.domain.min),
        duration = right.time - left.time;
      const px = Math.max(
        0.001,
        Math.min(0.999, (time - left.time) / duration),
      );
      let py = 0;
      if (mode === 'value') {
        const delta =
          valueComponent(right.value, component) -
          valueComponent(left.value, component);
        py = delta
          ? (val - valueComponent(left.value, component)) / delta
          : which === 'out'
            ? 0
            : 1;
      } else {
        const delta = spatialEndpointDistances(left, right)[which];
        const direction =
          Math.sign(which === 'out' ? speed!.outVelocity : speed!.inVelocity) ||
          1;
        py =
          which === 'out'
            ? delta
              ? ((Math.max(0, val) / factor) * direction * duration * px) /
                delta
              : 0
            : delta
              ? 1 -
                ((Math.max(0, val) / factor) *
                  direction *
                  duration *
                  (1 - px)) /
                  delta
              : 1;
      }
      const ctrl = {
        ...g.controls,
        [which]: { x: px, y: Math.max(-10, Math.min(10, py)) },
      };
      g.controls = ctrl;
      store.setPropertyPreviews(
        previewMotionCurve(
          view.project,
          [`${original.id}/${left.id}/${right.id}`],
          {
            type: 'cubic-bezier',
            x1: ctrl.out.x,
            y1: ctrl.out.y,
            x2: ctrl.in.x,
            y2: ctrl.in.y,
          },
        ),
      );
    },
  };
  return (
    <GraphFrame embedded={embedded} onClose={onClose}>
      <section
        className="graph-dialog"
        aria-label="曲线编辑器"
        tabIndex={0}
        onKeyDown={(e) => {
          if (
            e.code === 'Space' &&
            !(e.target as Element).closest('input,textarea,select')
          )
            e.stopPropagation();
          if (
            dispatchShortcut(e.nativeEvent, [
              {
                id: 'curve-pan',
                label: '曲线平移',
                key: 'space',
                contexts: ['curvegraph'],
                action: () => {
                  panUsed.current = false;
                  space.current = true;
                  setGrabbing(true);
                },
              },
              ...['f', 'home'].map((key) => ({
                id: `curve-fit-${key}`,
                label: '适应曲线视图',
                key,
                contexts: ['curvegraph'] as const,
                action: fitCurve,
              })),
              ...['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].map(
                (key) => ({
                  id: `curve-pan-${key}`,
                  label: '曲线视图移动',
                  key,
                  contexts: ['curvegraph'] as const,
                  action: () =>
                    setViewport((v) => ({
                      ...v,
                      x:
                        v.x +
                        (key === 'arrowleft'
                          ? -20
                          : key === 'arrowright'
                            ? 20
                            : 0) /
                          v.zoom,
                      y:
                        v.y +
                        (key === 'arrowup'
                          ? -20
                          : key === 'arrowdown'
                            ? 20
                            : 0) /
                          v.zoom,
                    })),
                }),
              ),
            ])
          )
            e.preventDefault();
        }}
      >
        <div className="graph-heading">
          <h2>曲线编辑器</h2>
          <button
            aria-label={view.playing ? '暂停曲线预览' : '播放曲线预览'}
            onClick={() => store.setPlaying(!view.playing)}
          >
            {view.playing ? '暂停' : '播放'}预览
          </button>
          <button
            onClick={() => {
              store.setPropertyPreviews(undefined);
              onClose();
            }}
          >
            关闭曲线编辑器
          </button>
        </div>
        <div className="graph-tools">
          <label>
            属性
            <select
              aria-label="曲线属性"
              value={entry.property.id}
              onChange={(e) => {
                setChosen(e.target.value);
                setSegmentId('');
                setComponent(0);
              }}
            >
              {entries.map((e) => (
                <option key={e.property.id} value={e.property.id}>
                  {propertyLabel(e.key, layer)}
                </option>
              ))}
            </select>
          </label>
          <label>
            曲线
            <select
              aria-label="曲线模式"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'value' | 'speed')}
            >
              <option value="value">值曲线</option>
              <option value="speed">速度曲线</option>
            </select>
          </label>
          {mode === 'value' && components(p.baseValue).length > 1 && (
            <label>
              分量
              <select
                aria-label="曲线分量"
                value={component}
                onChange={(e) => setComponent(Number(e.target.value))}
              >
                {components(p.baseValue).map((_, i) => (
                  <option key={i} value={i}>
                    {['X / R', 'Y / G', 'Z / B', 'A'][i] ?? i + 1}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            区间
            <select
              aria-label="曲线关键帧区间"
              value={left?.id ?? ''}
              onChange={(e) => setSegmentId(e.target.value)}
            >
              {frames.slice(0, -1).map((k) => (
                <option key={k.id} value={k.id}>
                  {k.time.toFixed(2)} →{' '}
                  {frames[frames.indexOf(k) + 1]!.time.toFixed(2)} 秒
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="graph-view-tools">
          <IconButton label="缩小曲线视图" onClick={() => zoomAt(1 / 1.25)}>
            −
          </IconButton>
          <IconButton label="放大曲线视图" onClick={() => zoomAt(1.25)}>
            ＋
          </IconButton>
          <IconButton label="适应曲线视图" shortcut="F" onClick={fitCurve}>
            ⛶
          </IconButton>
          <span>
            {Math.round(viewport.zoom * 100)}% · 滚轮缩放 · 空格/中键平移
          </span>
        </div>
        <p>
          {mode === 'speed'
            ? `真实速度 · ${unit.label}`
            : '属性值 · 与标准化缓动面板独立'}
        </p>
        <svg
          ref={measureSvg}
          viewBox={`${viewport.x} ${viewport.y} ${680 / viewport.zoom} ${280 / viewport.zoom}`}
          preserveAspectRatio="none"
          tabIndex={0}
          style={{
            touchAction: 'none',
            cursor: grabbing ? 'grab' : 'default',
            maxWidth: embedded
              ? Math.max(280, (svgSize.height * 680) / 280)
              : undefined,
          }}
          onPointerDown={(e) => {
            if (e.button === 0 && !space.current) panUsed.current = false;
            if (e.button !== 1 && !(e.button === 0 && space.current)) return;
            e.preventDefault();
            e.currentTarget.focus();
            e.currentTarget.setPointerCapture(e.pointerId);
            const rect = e.currentTarget.getBoundingClientRect();
            pan.current = {
              x: e.clientX,
              y: e.clientY,
              width: rect.width,
              height: rect.height,
              view: viewport,
            };
          }}
          onPointerMove={(e) => {
            const p = pan.current;
            if (p) {
              panUsed.current =
                Math.hypot(e.clientX - p.x, e.clientY - p.y) > 3;
              setViewport({
                ...p.view,
                x:
                  p.view.x -
                  ((e.clientX - p.x) * 680) /
                    Math.max(1, p.width) /
                    p.view.zoom,
                y:
                  p.view.y -
                  ((e.clientY - p.y) * 280) /
                    Math.max(1, p.height) /
                    p.view.zoom,
              });
            }
          }}
          onPointerUp={() => {
            pan.current = undefined;
          }}
          onPointerCancel={() => {
            if (pan.current) setViewport(pan.current.view);
            pan.current = undefined;
          }}
          onLostPointerCapture={() => {
            if (pan.current) setViewport(pan.current.view);
            pan.current = undefined;
          }}
          className="graph-svg"
          role="img"
          aria-label={mode === 'speed' ? '动画速度曲线' : '动画值曲线'}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line
                pointerEvents="none"
                x1="50"
                x2="630"
                y1={30 + (i * 205) / 4}
                y2={30 + (i * 205) / 4}
                stroke="var(--border-subtle)"
              />
              <text
                x="0"
                y="0"
                transform={`translate(4 ${30 + (i * 205) / 4 + 4 * pixelY}) scale(${pixelX} ${pixelY})`}
                fill="var(--text-muted)"
                fontSize="10"
              >
                {(max - (i * (max - min)) / 4).toFixed(1)}
              </text>
            </g>
          ))}
          <path
            d={path}
            stroke="var(--accent-primary)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            fill="none"
          />
          {frames.map((k) => (
            <ellipse
              key={k.id}
              cx={X(k.time)}
              cy={Y(
                mode === 'speed'
                  ? sampleCurve(p, k.time, k.time, 'speed', 0, 1)[0]!.value *
                      factor
                  : valueComponent(k.value, component),
              )}
              rx={5 * pixelX}
              ry={5 * pixelY}
              fill={
                k.id === left?.id ? 'var(--warning)' : 'var(--text-primary)'
              }
              onClick={() => {
                if (space.current || panUsed.current) return;
                setSegmentId(k.id);
                store.setTime(k.time);
                store.selectFrame({ propertyId: p.id, keyframeId: k.id });
              }}
            />
          ))}
          {left &&
            right &&
            (['out', 'in'] as const).map((which) => {
              const actual = handlePoint(which),
                h = {
                  x: Math.max(
                    viewport.x + 10 * pixelX,
                    Math.min(
                      viewport.x + 680 / viewport.zoom - 10 * pixelX,
                      actual.x,
                    ),
                  ),
                  y: Math.max(
                    viewport.y + 10 * pixelY,
                    Math.min(
                      viewport.y + 280 / viewport.zoom - 10 * pixelY,
                      actual.y,
                    ),
                  ),
                },
                key = which === 'out' ? left : right;
              return (
                <g key={which}>
                  <line
                    pointerEvents="none"
                    x1={X(key.time)}
                    y1={Y(
                      mode === 'speed'
                        ? (which === 'out' ? speed!.outSpeed : speed!.inSpeed) *
                            factor
                        : valueComponent(key.value, component),
                    )}
                    x2={h.x}
                    y2={h.y}
                    stroke="var(--warning)"
                  />
                  <ellipse
                    role="slider"
                    aria-label={which === 'out' ? '出切线手柄' : '入切线手柄'}
                    aria-valuenow={controls[which].x}
                    data-offscreen={h.x !== actual.x || h.y !== actual.y}
                    tabIndex={0}
                    cx={h.x}
                    cy={h.y}
                    rx={6 * pixelX}
                    ry={6 * pixelY}
                    fill="var(--warning)"
                    style={{ cursor: 'move', touchAction: 'none' }}
                    onPointerDown={(e) => {
                      if (e.button !== 0 || space.current || layer?.locked)
                        return;
                      e.stopPropagation();
                      store.setPlaying(false);
                      e.currentTarget.focus();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      domainRef.current = { key: curveKey, min, max };
                      gesture.current = {
                        which,
                        controls,
                        project: view.project,
                        key: curveKey,
                        domain: { start, end, min, max },
                      };
                    }}
                    onKeyDown={(e) => {
                      if (layer?.locked) return;
                      if (
                        [
                          'ArrowLeft',
                          'ArrowRight',
                          'ArrowUp',
                          'ArrowDown',
                        ].includes(e.key)
                      ) {
                        e.preventDefault();
                        const pt = controls[which];
                        apply({
                          ...controls,
                          [which]: {
                            x: Math.max(
                              0,
                              Math.min(
                                1,
                                pt.x +
                                  (e.key === 'ArrowRight'
                                    ? 0.01
                                    : e.key === 'ArrowLeft'
                                      ? -0.01
                                      : 0),
                              ),
                            ),
                            y:
                              pt.y +
                              (e.key === 'ArrowUp'
                                ? 0.02
                                : e.key === 'ArrowDown'
                                  ? -0.02
                                  : 0),
                          },
                        });
                      }
                    }}
                  />
                </g>
              );
            })}
          <line
            pointerEvents="none"
            x1={X(view.time)}
            x2={X(view.time)}
            y1="20"
            y2="240"
            stroke="var(--danger)"
          />
          <text
            x="0"
            y="0"
            transform={`translate(50 268) scale(${pixelX} ${pixelY})`}
            fill="var(--text-muted)"
            fontSize="11"
          >
            {start.toFixed(2)} 秒
          </text>
          <text
            x="0"
            y="0"
            transform={`translate(580 268) scale(${pixelX} ${pixelY})`}
            fill="var(--text-muted)"
            fontSize="11"
          >
            {end.toFixed(2)} 秒
          </text>
        </svg>
        <div className="graph-options">
          <div className="graph-tools">
            {Object.entries({
              easeIn: '缓入',
              easeOut: '缓出',
              easeInOut: '缓入缓出',
            }).map(([key, label]) => (
              <button
                key={key}
                disabled={!right || layer?.locked}
                onClick={() => {
                  const preset = easePresets[key]!;
                  if (preset.type === 'bezier') apply(preset);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {speed && (
            <div className="graph-fields">
              {(
                [
                  ['outInfluence', '出影响比例（%）'],
                  ['inInfluence', '入影响比例（%）'],
                  ['outSpeed', '出速度'],
                  ['inSpeed', '入速度'],
                ] as const
              ).map(([field, label]) => (
                <NumberField
                  key={field}
                  revision={original}
                  time={view.time}
                  onPreview={(v) => editSpeed(field, v, true)}
                  onCancel={() => store.setPropertyPreviews(undefined)}
                  label={label}
                  value={speed[field] * (field.includes('Speed') ? factor : 1)}
                  min={field.includes('Influence') ? 0.1 : 0}
                  max={field.includes('Influence') ? 100 : undefined}
                  onCommit={(v) => editSpeed(field, v)}
                  onError={(m) => store.setStatus(m, true)}
                />
              ))}
            </div>
          )}
          {left && right && entry.key === 'transform.position' && (
            <SpatialMotionEditor
              store={store}
              property={original}
              left={left}
              right={right}
            />
          )}
          <label className="graph-time">
            预览时间
            <input
              aria-label="曲线预览时间"
              type="range"
              min={0}
              max={c.duration}
              step={1 / c.fps}
              value={view.time}
              onChange={(e) => store.setTime(Number(e.target.value))}
            />
          </label>
          {!right && (
            <p>该属性至少需要两个关键帧。请在时间轴添加关键帧后编辑曲线。</p>
          )}
        </div>
        <p className="inspector-note">
          速度曲线使用属性所有分量的变化速度。拖动黄色切线手柄，松手后提交一次修改；箭头键可微调手柄。
        </p>
      </section>
    </GraphFrame>
  );
}

function GraphFrame({
  embedded,
  onClose,
  children,
  empty = false,
}: {
  embedded: boolean;
  onClose: () => void;
  empty?: boolean;
  children: import('react').ReactNode;
}) {
  return embedded ? (
    <div className={`graph-inline ${empty ? 'is-empty' : ''}`}>{children}</div>
  ) : (
    <Modal onClose={onClose}>{children}</Modal>
  );
}
