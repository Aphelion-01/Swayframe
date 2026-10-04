import { useEffect, useState } from 'react';
import type { MotionCurve } from '../core/motion-curve';
import { evaluateMotionCurve, motionCurveVelocity } from '../core/motion-curve';
export function MotionPreview({ curve }: { curve: MotionCurve }) {
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    let request = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setTime(((now - start) % 2400) / 2000);
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing]);
  const samples = Array.from({ length: 81 }, (_, i) =>
      motionCurveVelocity(curve, i / 80),
    ),
    min = Math.min(0, ...samples),
    max = Math.max(1, ...samples),
    range = Math.max(1, max - min);
  const d = samples
    .map(
      (v, i) =>
        `${i ? 'L' : 'M'}${20 + i * 3.7},${72 - ((v - min) / range) * 55}`,
    )
    .join(' ');
  return (
    <section className="motion-preview" aria-label="缓动运动预览">
      <div>
        <span>运动预览</span>
        <button onClick={() => setPlaying((v) => !v)}>
          {playing ? '暂停小球' : '播放小球'}
        </button>
      </div>
      <svg viewBox="0 0 360 52" role="img" aria-label="缓动预览小球">
        <line x1="65" x2="295" y1="26" y2="26" stroke="var(--border-strong)" />
        <circle
          cx={65 + evaluateMotionCurve(curve, Math.min(1, time)) * 230}
          cy="26"
          r="7"
          fill="var(--success)"
        />
      </svg>
      <small>归一化速度 dp/du（可为负）</small>
      <svg viewBox="0 0 360 85" role="img" aria-label="归一化速度预览">
        <path d={d} stroke="var(--warning)" strokeWidth="2" fill="none" />
        <text x="20" y="83" fill="var(--text-muted)" fontSize="10">
          0 → 1 · 无属性单位
        </text>
      </svg>
    </section>
  );
}
