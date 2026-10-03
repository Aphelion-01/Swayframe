import { useInteractionCancel } from './workspace/interaction';
import {
  applyMotionCurveCommands,
  previewMotionCurve,
} from '../core/motion-curve-commands';
import { SpatialMotionEditor } from './SpatialMotionEditor';
import { useRef, useState, useSyncExternalStore } from 'react';
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
    layer = c.layers.find((l) => l.id === view.selection[0]);
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
      }
    | undefined
  >(undefined);
  useInteractionCancel(() => {
    gesture.current = undefined;
    store.setPropertyPreviews(undefined);
  });
  const entry =
    entries.find((e) => e.property.id === chosen) ??
    entries.find((e) => e.property.id === view.frames[0]?.propertyId) ??
    entries.find((e) => e.property.keyframes.length > 1) ??
    entries[0];
  if (!entry)
    return (
      <div className={embedded ? 'graph-inline' : 'modal-backdrop'}>
        <section className="graph-dialog">
          <h2>曲线编辑器</h2>
          <p>先选择一个图层。</p>
          <button onClick={onClose}>关闭曲线编辑器</button>
        </section>
      </div>
    );
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
    min = rawMin - padding,
    max = rawMax + padding;
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
  ) => {
    if (speed && left && right) {
      const n = {
        ...speed,
        [field]: field.includes('Speed') ? value / factor : value,
      };
      apply(
        controlsFromSpeed(
          left,
          right,
          n.outInfluence,
          n.inInfluence,
          n.outSpeed,
          n.inSpeed,
        ),
      );
    }
  };
  const endGesture = () => {
    const g = gesture.current;
    gesture.current = undefined;
    if (g && g.project === store.getSnapshot().project) apply(g.controls);
    else store.setPropertyPreviews(undefined);
  };
  return (
    <div className={embedded ? 'graph-inline' : 'modal-backdrop'}>
      <section className="graph-dialog" aria-label="曲线编辑器">
        <div className="graph-heading">
          <h2>曲线编辑器</h2>
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
        <p>
          {mode === 'speed'
            ? `真实速度 · ${unit.label}`
            : '属性值 · 与标准化缓动面板独立'}
        </p>
        <svg
          viewBox="0 0 680 280"
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
                stroke="#2e3d55"
              />
              <text x="4" y={35 + (i * 205) / 4} fill="#97abc9" fontSize="10">
                {(max - (i * (max - min)) / 4).toFixed(1)}
              </text>
            </g>
          ))}
          <path d={path} stroke="#6fbeff" strokeWidth="2" fill="none" />
          {frames.map((k) => (
            <circle
              key={k.id}
              cx={X(k.time)}
              cy={Y(
                mode === 'speed'
                  ? sampleCurve(p, k.time, k.time, 'speed', 0, 1)[0]!.value *
                      factor
                  : valueComponent(k.value, component),
              )}
              r="5"
              fill={k.id === left?.id ? '#ffd25a' : '#d6e4ff'}
              onClick={() => {
                setSegmentId(k.id);
                store.setTime(k.time);
                store.selectFrame({ propertyId: p.id, keyframeId: k.id });
              }}
            />
          ))}
          {left &&
            right &&
            (['out', 'in'] as const).map((which) => {
              const h = handlePoint(which),
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
                    stroke="#e3b34d"
                  />
                  <circle
                    role="slider"
                    aria-label={which === 'out' ? '出切线手柄' : '入切线手柄'}
                    aria-valuenow={controls[which].x}
                    tabIndex={0}
                    cx={h.x}
                    cy={h.y}
                    r="8"
                    fill="#ffd25a"
                    style={{ cursor: 'move', touchAction: 'none' }}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      gesture.current = {
                        which,
                        controls,
                        project: view.project,
                      };
                    }}
                    onPointerMove={(e) => {
                      const g = gesture.current;
                      if (!g || g.which !== which) return;
                      const svg = e.currentTarget.ownerSVGElement!,
                        rect = svg.getBoundingClientRect(),
                        x = ((e.clientX - rect.left) * 680) / rect.width,
                        y = ((e.clientY - rect.top) * 280) / rect.height,
                        time = start + ((x - 50) / 580) * (end - start),
                        val = min + ((235 - y) / 205) * (max - min),
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
                          ? (val - valueComponent(left.value, component)) /
                            delta
                          : which === 'out'
                            ? 0
                            : 1;
                      } else {
                        const delta = spatialEndpointDistances(left, right)[
                          which
                        ];
                        const direction =
                          Math.sign(
                            which === 'out'
                              ? speed!.outVelocity
                              : speed!.inVelocity,
                          ) || 1;
                        py =
                          which === 'out'
                            ? delta
                              ? ((Math.max(0, val) / factor) *
                                  direction *
                                  duration *
                                  px) /
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
                    }}
                    onPointerUp={endGesture}
                    onPointerCancel={() => {
                      gesture.current = undefined;
                      store.setPropertyPreviews(undefined);
                    }}
                    onKeyDown={(e) => {
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
            stroke="#ee7282"
          />
          <text x="50" y="268" fill="#a4b5cf" fontSize="12">
            {start.toFixed(2)} 秒
          </text>
          <text x="580" y="268" fill="#a4b5cf" fontSize="12">
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
    </div>
  );
}
