/** A single shared delta preserves relative spacing of a multi-keyframe selection. */
export function snapTimeDelta(
  times: readonly number[],
  desired: number,
  duration: number,
  fps: number,
  targets: readonly number[] = [],
  tolerance = -1,
): { delta: number; snapTime?: number } {
  if (!times.length || !Number.isFinite(desired)) return { delta: 0 };
  const lower = -Math.min(...times),
    upper = duration - Math.max(...times);
  const clamp = (value: number) => Math.max(lower, Math.min(upper, value));
  let delta = clamp(Math.round(desired * fps) / fps);
  let correction: number | undefined, snapTime: number | undefined;
  for (const time of times)
    for (const target of targets) {
      const candidate = target - time,
        distance = candidate - delta;
      if (
        candidate >= lower - 1e-8 &&
        candidate <= upper + 1e-8 &&
        Math.abs(distance) <= tolerance &&
        (correction === undefined || Math.abs(distance) < Math.abs(correction))
      ) {
        correction = distance;
        snapTime = target;
      }
    }
  if (correction !== undefined) delta = clamp(delta + correction);
  return {
    delta: Math.abs(delta) < 1e-8 ? 0 : delta,
    ...(snapTime === undefined ? {} : { snapTime }),
  };
}
/** Restrict the preview before commit, preserving duration when moving and a minimum frame on trim. */
export function layerTimeDragDelta(
  start: number,
  end: number,
  desired: number,
  mode: 'move' | 'start' | 'end',
  duration: number,
  fps: number,
): number {
  const frame = Math.min(1 / fps, end - start);
  const lower = mode === 'end' ? start + frame - end : -start;
  const upper = mode === 'start' ? end - start - frame : duration - end;
  return Math.max(lower, Math.min(upper, Math.round(desired * fps) / fps));
}
