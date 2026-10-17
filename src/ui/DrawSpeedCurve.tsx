import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { EditorStore } from './editor-store';
import type { AnimValue } from '../core/core-types';
import type { Keyframe, Project, Property } from '../core/project-model';
import { applySpeedCurveCommands } from '../core/motion-curve-commands';
import {
  simplifySpeedStroke,
  speedPresets,
  speedProgress,
} from '../core/speed-curve';
import type { CustomSpeedInterpolation, SpeedPoint } from '../core/speed-curve';
import { usePointerRelease } from './workspace/pointer-release';
import { useInteractionCancel } from './workspace/interaction';

/** Interval editor inside the native Graph Editor; drafts stay outside Scene. */
export function DrawSpeedCurve({
  store,
  project,
  property,
  left,
  right,
  time,
  locked,
}: {
  store: EditorStore;
  project: Project;
  property: Property<AnimValue>;
  left: Keyframe<AnimValue>;
  right: Keyframe<AnimValue>;
  time: number;
  locked: boolean;
}) {
  const saved =
    left.interpolation.type === 'custom-speed'
      ? left.interpolation
      : speedPresets.uniform!;
  const [draft, setDraft] = useState<CustomSpeedInterpolation>();
  const [error, setError] = useState('');
  const svg = useRef<SVGSVGElement>(null);
  const stroke = useRef<
    | {
        pointer: number;
        project: Project;
        points: SpeedPoint[];
        rect: DOMRect;
        max: number;
        valid?: CustomSpeedInterpolation;
        invalid?: boolean;
      }
    | undefined
  >(undefined);
  const segment = `${property.id}/${left.id}/${right.id}`;
  const curve = draft ?? saved;
  const maximum = Math.max(2, ...saved.points.map((p) => p.speed));
  const cancel = () => {
    stroke.current = undefined;
    setDraft(undefined);
    store.setPropertyPreviews(undefined);
  };
  useInteractionCancel(cancel);
  useEffect(() => {
    cancel();
    return () => {
      store.setPropertyPreviews(undefined);
    };
  }, [project, property.id, left.id, right.id, locked]);
  const preview = (next: CustomSpeedInterpolation) => {
    setDraft(next);
    store.setPropertyPreviews([
      {
        ...property,
        keyframes: property.keyframes.map((k) =>
          k.id === left.id ? { ...k, interpolation: next } : k,
        ),
      },
    ]);
  };
  const commit = (next: CustomSpeedInterpolation, expected = project) => {
    cancel();
    if (store.commands.getSnapshot() !== expected) {
      setError('工程已更改，未应用笔迹，请重新绘制');
      return;
    }
    try {
      const result = store.run(
        '手绘速度曲线',
        applySpeedCurveCommands(expected, segment, next),
      );
      if (!result.ok) throw new Error(result.error);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '速度曲线无效');
    }
  };
  const sample = (event: Pick<PointerEvent, 'clientX' | 'clientY'>) => {
    const g = stroke.current;
    if (!g) return;
    if (store.commands.getSnapshot() !== g.project) {
      cancel();
      setError('工程已更改，绘制已取消');
      return;
    }
    const t = Math.max(
      0,
      Math.min(
        1,
        (((event.clientX - g.rect.left) / g.rect.width) * 680 - 50) / 580,
      ),
    );
    const y = ((event.clientY - g.rect.top) / g.rect.height) * 280;
    const speed =
      y >= 233 ? 0 : Math.max(0, Math.min(g.max, ((235 - y) / 205) * g.max));
    // Reverse motion replaces the current part of the stroke, rather than appending duplicate times.
    g.points = g.points.filter((p) => p.t < t);
    g.points.push({ t, speed });
    if (g.points.length > 4096) {
      cancel();
      setError('笔迹采样过多，请缩短绘制');
      return;
    }
    try {
      const next = simplifySpeedStroke(g.points);
      g.valid = next;
      g.invalid = false;
      preview(next);
      setError('');
    } catch {
      g.invalid = true;
      setError('曲线须包含非零速度；当前保留上次有效结果');
    }
  };
  usePointerRelease({
    active: () => !!stroke.current,
    accepts: (e) => e.pointerId === stroke.current?.pointer,
    move: sample,
    finish: (e) => {
      sample(e);
      const g = stroke.current;
      if (!g) return;
      if (g.valid && !g.invalid) commit(g.valid, g.project);
      else cancel();
    },
    cancel,
  });
  const start = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || locked) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.focus();
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    store.setPlaying(false);
    stroke.current = {
      pointer: e.pointerId,
      project,
      points: [],
      rect,
      max: maximum,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    sample(e);
  };
  const X = (t: number) => 50 + t * 580,
    Y = (v: number) => 235 - (v / maximum) * 205;
  return (
    <div
      className="draw-speed-editor"
      aria-label="手绘速度区间"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cancel();
          setError('已取消绘制');
        }
      }}
    >
      <div
        className="draw-speed-presets"
        role="group"
        aria-label="相对速度预设"
      >
        <span>相对速度</span>
        {(
          [
            ['uniform', '匀速'],
            ['accelerate', '加速'],
            ['decelerate', '减速'],
            ['ease', '慢–快–慢'],
            ['pause', '中途停顿'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            disabled={locked}
            onClick={() => commit(speedPresets[id]!)}
          >
            {label}
          </button>
        ))}
      </div>
      <svg
        ref={svg}
        className="graph-svg"
        viewBox="0 0 680 280"
        preserveAspectRatio="none"
        role="img"
        aria-label="手绘相对速度曲线"
        tabIndex={0}
        style={{
          touchAction: 'none',
          cursor: locked ? 'not-allowed' : 'crosshair',
        }}
        onPointerDown={start}
      >
        {Array.from({ length: 11 }, (_, i) => (
          <line
            key={`x${i}`}
            x1={X(i / 10)}
            x2={X(i / 10)}
            y1={30}
            y2={235}
            stroke="var(--border-subtle)"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line
              x1={50}
              x2={630}
              y1={Y(v * maximum)}
              y2={Y(v * maximum)}
              stroke="var(--border-subtle)"
            />
            <text
              x={8}
              y={Y(v * maximum) + 4}
              fill="var(--text-muted)"
              fontSize={11}
            >
              {(v * maximum).toFixed(1)}
            </text>
          </g>
        ))}
        <path
          d={curve.points
            .map((p, i) => `${i ? 'L' : 'M'}${X(p.t)},${Y(p.speed)}`)
            .join(' ')}
          fill="none"
          stroke="var(--accent-primary)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        <path
          d={Array.from(
            { length: 101 },
            (_, i) =>
              `${i ? 'L' : 'M'}${X(i / 100)},${235 - speedProgress(curve, i / 100) * 205}`,
          ).join(' ')}
          fill="none"
          stroke="var(--text-muted)"
          strokeDasharray="4 4"
          pointerEvents="none"
        />
        <line
          x1={X(
            Math.max(
              0,
              Math.min(1, (time - left.time) / (right.time - left.time)),
            ),
          )}
          x2={X(
            Math.max(
              0,
              Math.min(1, (time - left.time) / (right.time - left.time)),
            ),
          )}
          y1={30}
          y2={235}
          stroke="var(--danger)"
          pointerEvents="none"
        />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <text
            key={t}
            x={X(t)}
            y={262}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize={11}
          >
            {t * 100}%
          </text>
        ))}
      </svg>
      <small role="status">
        {error ||
          `${left.time.toFixed(2)}–${right.time.toFixed(2)} s · 左键/笔从左向右绘制 · 底部为停顿 · Esc 取消 · 虚线为累计进度`}
      </small>
    </div>
  );
}
