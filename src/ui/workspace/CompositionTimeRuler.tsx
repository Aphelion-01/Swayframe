import { useEffect, useState, useRef } from 'react';
import type { EditorStore } from '../editor-store';
import { useEditorSlice } from '../use-editor-slice';
import { activeComposition } from '../../core/project-model';
import { timelineTicks } from '../../core/timeline-time';
import { usePointerRelease } from './pointer-release';
import { useInteractionCancel } from './interaction';
export function CompositionTimeRuler({ store }: { store: EditorStore }) {
  const v = useEditorSlice(store, ['project', 'time']);
  const c = activeComposition(v.project);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const drag = useRef<
    { left: number; width: number; time: number } | undefined
  >(undefined);
  const sample = (x: number) => {
    if (drag.current) {
      const t = ((x - drag.current.left) / drag.current.width) * c.duration;
      store.setTime(
        Math.round(Math.max(0, Math.min(c.duration, t)) * c.fps) / c.fps,
      );
    }
  };
  const cancel = () => {
    if (drag.current) store.setTime(drag.current.time);
    drag.current = undefined;
  };
  usePointerRelease({
    active: () => !!drag.current,
    move: (e) => sample(e.clientX),
    finish: (e) => {
      sample(e.clientX);
      drag.current = undefined;
    },
    cancel,
  });
  useInteractionCancel(cancel);
  const ticks = timelineTicks(c.duration, c.fps, Math.max(300, width));
  return (
    <div
      className="composition-time-ruler"
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="合成时间标尺"
      aria-valuemin={0}
      aria-valuemax={c.duration}
      aria-valuenow={v.time}
      aria-valuetext={`${v.time.toFixed(3)} 秒`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') cancel();
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          store.setPlaying(false);
          store.setTime(
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? c.duration
                : v.time + (e.key === 'ArrowLeft' ? -1 : 1) / c.fps,
          );
        }
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        drag.current = { left: r.left + 8, width: r.width - 16, time: v.time };
        e.currentTarget.setPointerCapture(e.pointerId);
        store.setPlaying(false);
        sample(e.clientX);
      }}
      onPointerUp={(e) => {
        sample(e.clientX);
        drag.current = undefined;
      }}
    >
      {ticks.map((t) => (
        <span
          key={t.time}
          className="composition-time-tick"
          style={{ left: `calc(8px + (100% - 16px) * ${t.time / c.duration})` }}
        >
          {t.label}
        </span>
      ))}
      <span
        className="composition-time-pointer"
        style={{ left: `calc(8px + (100% - 16px) * ${v.time / c.duration})` }}
      >
        <i />
        <b>{v.time.toFixed(3)} s</b>
      </span>
    </div>
  );
}
