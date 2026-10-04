import { useInteractionCancel } from './workspace/interaction';
import {
  reverseMotionCurve,
  mirrorMotionCurve,
} from '../core/motion-curve-operations';
import { MotionPresetBrowser } from './MotionPresetBrowser';
import { MotionPreview } from './MotionPreview';
import { previewMotionCurve } from '../core/motion-curve-commands';
import { useRef, useState, useSyncExternalStore } from 'react';
import type { EditorStore } from './editor-store';
import type {
  MotionCurve,
  MotionCurveApplyMode,
  MotionSegment,
} from '../core/motion-curve';
import {
  cubicCoordinates,
  evaluateMotionCurve,
  motionSegments,
  segmentMotionCurve,
} from '../core/motion-curve';
import {
  applyMotionCurveCommands,
  selectedMotionSegments,
} from '../core/motion-curve-commands';
import { activeComposition, layerProperties } from '../core/project-model';
import { propertyLabel } from './property-labels';
import { NumberField } from './fields';

export const quickMotionCurves: Readonly<Record<string, MotionCurve>> = {
  线性: { type: 'linear' },
  缓入: { type: 'cubic-bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 },
  缓出: { type: 'cubic-bezier', x1: 0, y1: 0, x2: 0.58, y2: 1 },
  缓入缓出: { type: 'cubic-bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  柔和缓动: { type: 'cubic-bezier', x1: 1 / 3, y1: 0, x2: 2 / 3, y2: 1 },
};
export function MotionCurvePanel({
  store,
  onClose,
}: {
  store: EditorStore;
  onClose: () => void;
}) {
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot),
    project = view.project;
  const [, refreshClipboard] = useState(0);
  const [scope, setScope] = useState<'selection' | 'segment'>('selection');
  const [chosen, setChosen] = useState(''),
    [mode, setMode] = useState<MotionCurveApplyMode>('both');
  const [draft, setDraft] = useState<{
    project: unknown;
    curve: MotionCurve;
  }>();
  const gesture = useRef<
    | {
        project: unknown;
        curve: MotionCurve;
        targets: readonly string[];
        min: number;
        max: number;
      }
    | undefined
  >(undefined);
  const available = activeComposition(project)
    .layers.filter((l) => view.selection.includes(l.id))
    .flatMap((l) =>
      layerProperties(l).flatMap((e) =>
        motionSegments(e.property).map((s) => ({
          ...s,
          label: `${l.name} · ${propertyLabel(e.key)} · ${s.from.time}→${s.to.time} 秒`,
        })),
      ),
    );
  const selected = selectedMotionSegments(project, view.frames);
  const fallback =
    available.find((s) => s.id === chosen) ??
    available.find(
      (s) =>
        s.from.id === view.frames[0]?.keyframeId ||
        s.to.id === view.frames[0]?.keyframeId,
    ) ??
    available[0];
  const targets =
    scope === 'selection' && selected.length
      ? selected
      : fallback
        ? [fallback.id]
        : [];
  const segments = available.filter((s) => targets.includes(s.id));
  const first = segments[0] as MotionSegment | undefined;
  const mixed = segments.some(
    (s) => JSON.stringify(s.curve) !== JSON.stringify(first?.curve),
  );
  const curve =
    draft?.project === project
      ? draft.curve
      : (first?.curve ?? { type: 'linear' as const });
  const c = cubicCoordinates(curve),
    minimum = Math.min(-0.25, c.y1 - 0.15, c.y2 - 0.15),
    maximum = Math.max(1.25, c.y1 + 0.15, c.y2 + 0.15);
  const low = gesture.current?.min ?? minimum,
    high = gesture.current?.max ?? maximum;
  const X = (x: number) => 40 + x * 280,
    Y = (y: number) => 240 - (200 * (y - low)) / (high - low);
  const apply = (next: MotionCurve, ids: readonly string[] = targets) => {
    setDraft(undefined);
    store.setPropertyPreviews(undefined);
    try {
      return store.run(
        '应用动画曲线',
        applyMotionCurveCommands(store.getSnapshot().project, ids, next, mode),
      ).ok;
    } catch (e) {
      store.setStatus(e instanceof Error ? e.message : '曲线无效', true);
      return false;
    }
  };
  const preview = (next: MotionCurve) => {
    try {
      const ids = gesture.current?.targets ?? targets;
      const properties = previewMotionCurve(project, ids, next, mode);
      const segment = segments.find((s) => s.id === ids[0]);
      const property = properties.find((p) => p.id === segment?.propertyId);
      const left = property?.keyframes.find((k) => k.id === segment?.from.id),
        right = property?.keyframes.find((k) => k.id === segment?.to.id);
      setDraft({
        project,
        curve: left && right ? (segmentMotionCurve(left, right) ?? next) : next,
      });
      store.setPropertyPreviews(properties);
    } catch (e) {
      store.setStatus(e instanceof Error ? e.message : '曲线无效', true);
    }
  };
  const cancel = () => {
    gesture.current = undefined;
    setDraft(undefined);
    store.setPropertyPreviews(undefined);
  };
  useInteractionCancel(cancel);
  const path = Array.from(
    { length: 121 },
    (_, i) =>
      `${i ? 'L' : 'M'}${X(i / 120)},${Y(evaluateMotionCurve(curve, i / 120))}`,
  ).join(' ');
  return (
    <aside className="motion-curve-panel" aria-label="动画缓动面板">
      <header>
        <div>
          <strong>动画缓动 · Motion Curve</strong>
          <small>标准化时间 → 动画进度</small>
        </div>
        <button
          onClick={() => {
            cancel();
            onClose();
          }}
        >
          关闭缓动面板
        </button>
      </header>
      <p role="status">
        {mixed
          ? '混合（Mixed）'
          : first?.curve === null
            ? '保持 / 弹簧：应用预设将转换曲线'
            : `${targets.length} 个动画区间`}
      </p>
      <label>
        应用范围
        <select
          aria-label="缓动应用范围"
          value={scope}
          onChange={(e) => {
            cancel();
            setScope(e.target.value as typeof scope);
          }}
        >
          <option value="selection">选中关键帧的全部相邻区间</option>
          <option value="segment">仅当前区间</option>
        </select>
      </label>
      <label>
        目标区间
        <select
          aria-label="缓动目标区间"
          value={fallback?.id ?? ''}
          onChange={(e) => {
            cancel();
            setChosen(e.target.value);
            setScope('segment');
          }}
        >
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {!targets.length && (
        <p>选择图层的动画区间，或在时间轴选中两个相邻关键帧。</p>
      )}
      <label>
        合成预览时间
        <input
          aria-label="缓动合成预览时间"
          type="range"
          min={0}
          max={activeComposition(project).duration}
          step={0.001}
          value={view.time}
          onChange={(e) => store.setTime(Number(e.target.value))}
        />
      </label>
      <output aria-label="当前标准化进度">
        {first
          ? evaluateMotionCurve(
              curve,
              (view.time - first.from.time) / (first.to.time - first.from.time),
            ).toFixed(3)
          : '—'}
      </output>
      <fieldset disabled={!targets.length}>
        <div className="motion-quick">
          {Object.entries(quickMotionCurves).map(([name, data]) => (
            <button key={name} onClick={() => apply(data)}>
              {name}
            </button>
          ))}
        </div>
        <svg
          viewBox="0 0 360 280"
          className="motion-curve-svg"
          role="img"
          aria-label="标准化缓动曲线"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((n) => (
            <g key={n} pointerEvents="none">
              <line x1={X(n)} x2={X(n)} y1="40" y2="240" stroke="#29354b" />
              <line x1="40" x2="320" y1={Y(n)} y2={Y(n)} stroke="#29354b" />
            </g>
          ))}
          <path
            d={path}
            fill="none"
            stroke="#a7b5ff"
            strokeWidth="3"
            pointerEvents="none"
          />
          <text x="18" y={Y(0) + 17} fill="#9badc9">
            0,0
          </text>
          <text x="307" y={Y(1) - 10} fill="#9badc9">
            1,1
          </text>
          <text x="117" y="272" fill="#9badc9">
            标准化时间 0 → 1
          </text>
          {([1, 2] as const).map((which) => {
            const x = which === 1 ? c.x1 : c.x2,
              y = which === 1 ? c.y1 : c.y2;
            return (
              <g key={which}>
                <line
                  pointerEvents="none"
                  x1={X(which === 1 ? 0 : 1)}
                  y1={Y(which === 1 ? 0 : 1)}
                  x2={X(x)}
                  y2={Y(y)}
                  stroke="#eab76b"
                />
                <circle
                  role="slider"
                  tabIndex={0}
                  aria-label={`缓动 P${which} 手柄`}
                  aria-valuenow={x}
                  cx={X(x)}
                  cy={Y(y)}
                  r="9"
                  fill={which === 1 ? '#f1be7c' : '#86dcca'}
                  style={{ touchAction: 'none', cursor: 'grab' }}
                  onPointerDown={(e) => {
                    if (!targets.length || e.button !== 0) return;
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    gesture.current = {
                      project,
                      curve,
                      targets,
                      min: low,
                      max: high,
                    };
                  }}
                  onPointerMove={(e) => {
                    const g = gesture.current;
                    if (!g) return;
                    if (g.project !== store.getSnapshot().project) {
                      cancel();
                      return;
                    }
                    const r =
                      e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                    const px =
                        (((e.clientX - r.left) * 360) / r.width - 40) / 280,
                      py =
                        g.min +
                        ((240 - ((e.clientY - r.top) * 280) / r.height) / 200) *
                          (g.max - g.min);
                    const next = {
                      ...cubicCoordinates(g.curve),
                      [which === 1 ? 'x1' : 'x2']: Math.max(0, Math.min(1, px)),
                      [which === 1 ? 'y1' : 'y2']: Math.max(
                        -10,
                        Math.min(10, py),
                      ),
                    };
                    g.curve = next;
                    preview(next);
                  }}
                  onPointerUp={() => {
                    const g = gesture.current;
                    gesture.current = undefined;
                    if (g && g.project === store.getSnapshot().project)
                      apply(g.curve, g.targets);
                    else cancel();
                  }}
                  onPointerCancel={cancel}
                  onKeyDown={(e) => {
                    if (!e.key.startsWith('Arrow')) return;
                    e.preventDefault();
                    const next = {
                      ...c,
                      [which === 1 ? 'x1' : 'x2']: Math.max(
                        0,
                        Math.min(
                          1,
                          x +
                            (e.key === 'ArrowRight'
                              ? 0.01
                              : e.key === 'ArrowLeft'
                                ? -0.01
                                : 0),
                        ),
                      ),
                      [which === 1 ? 'y1' : 'y2']: Math.max(
                        -10,
                        Math.min(
                          10,
                          y +
                            (e.key === 'ArrowUp'
                              ? 0.02
                              : e.key === 'ArrowDown'
                                ? -0.02
                                : 0),
                        ),
                      ),
                    };
                    apply(next);
                  }}
                />
              </g>
            );
          })}
        </svg>
        <div className="motion-coordinates">
          {(['x1', 'y1', 'x2', 'y2'] as const).map((key) => (
            <NumberField
              key={key}
              revision={project}
              time={store.getSnapshot().time}
              step={0.01}
              onPreview={(v) => preview({ ...c, [key]: v })}
              onCancel={cancel}
              label={key.toUpperCase()}
              value={c[key]}
              min={key.startsWith('x') ? 0 : -10}
              max={key.startsWith('x') ? 1 : 10}
              onCommit={(v) => apply({ ...c, [key]: v })}
              onError={(m) => store.setStatus(m, true)}
            />
          ))}
        </div>
        <div className="motion-coordinates">
          {(['out', 'in'] as const).map((side) => (
            <NumberField
              key={side}
              revision={project}
              time={store.getSnapshot().time}
              onPreview={(v) =>
                preview(
                  side === 'out'
                    ? { ...c, x1: v / 100 }
                    : { ...c, x2: 1 - v / 100 },
                )
              }
              onCancel={cancel}
              label={side === 'out' ? '出影响（%）' : '入影响（%）'}
              value={(side === 'out' ? c.x1 : 1 - c.x2) * 100}
              min={0}
              max={100}
              onCommit={(v) =>
                apply(
                  side === 'out'
                    ? { ...c, x1: v / 100 }
                    : { ...c, x2: 1 - v / 100 },
                )
              }
              onError={(m) => store.setStatus(m, true)}
            />
          ))}
        </div>
        <label>
          应用模式
          <select
            aria-label="缓动应用模式"
            value={mode}
            onChange={(e) => setMode(e.target.value as MotionCurveApplyMode)}
          >
            <option value="both">双侧（Both）</option>
            <option value="out">出侧（Out）</option>
            <option value="in">入侧（In）</option>
          </select>
        </label>
      </fieldset>
      <div className="motion-quick">
        <button
          disabled={!targets.length}
          onClick={() => apply(reverseMotionCurve(curve))}
        >
          反转曲线
        </button>
        <button
          disabled={!targets.length}
          title="保留出侧，将入侧设为中心对称"
          onClick={() => apply(mirrorMotionCurve(curve, 'out'))}
        >
          镜像：出 → 入
        </button>
        <button
          disabled={!targets.length}
          title="保留入侧，将出侧设为中心对称"
          onClick={() => apply(mirrorMotionCurve(curve, 'in'))}
        >
          镜像：入 → 出
        </button>
        <button
          disabled={!first?.curve || mixed}
          onClick={() => {
            store.motionCurveClipboard.copy(curve);
            refreshClipboard((v) => v + 1);
            store.setStatus('已复制缓动曲线，不含时间与数值');
          }}
        >
          复制缓动
        </button>
        <button
          disabled={!targets.length || !store.motionCurveClipboard.read()}
          onClick={() => apply(store.motionCurveClipboard.read()!)}
        >
          粘贴缓动
        </button>
      </div>
      <MotionPreview curve={curve} />
      <MotionPresetBrowser
        curve={curve}
        onApply={apply}
        onError={(m) => store.setStatus(m, true)}
      />
      <p className="inspector-note">
        拖动控制点直接修改缓动。Y 可越过
        0～1；修改时间曲线不改变空间路径。拖动右下角调整面板大小。
      </p>
    </aside>
  );
}
