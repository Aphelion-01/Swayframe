/** Animation model stores seconds. Editing rounds to a composition frame; playback may be subframe. */
export const timeToFrame = (time: number, fps: number) =>
  Math.round(time * fps);
export const frameToTime = (frame: number, fps: number) => frame / fps;
export const snapToFrame = (time: number, fps: number) =>
  frameToTime(timeToFrame(time, fps), fps);
export function formatTimecode(time: number, fps: number): string {
  const frame = Math.max(0, timeToFrame(time, fps));
  const whole = Math.floor(frame / fps);
  return [
    Math.floor(whole / 3600),
    Math.floor(whole / 60) % 60,
    whole % 60,
    frame % fps,
  ]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
/** Integer-frame ticks with enough room for labels; never emit one label per frame at low zoom. */
export function timelineTicks(
  duration: number,
  fps: number,
  width: number,
  timecode = false,
) {
  const required = Math.max(
    1,
    (duration * fps * (timecode ? 110 : 70)) / Math.max(1, width),
  );
  const candidates = [
    ...new Set([
      1,
      2,
      5,
      10,
      15,
      ...[1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600].map((s) =>
        Math.round(s * fps),
      ),
    ]),
  ].sort((a, b) => a - b);
  const major =
    candidates.find((f) => f >= required) ?? Math.ceil(required / fps) * fps;
  const minor = Math.max(
    1,
    major / (major % 5 === 0 ? 5 : major % 2 === 0 ? 2 : 1),
  );
  const ticks: { time: number; major: boolean; label: string }[] = [];
  for (let frame = 0; frame <= Math.round(duration * fps); frame += minor) {
    const isMajor = frame % major === 0;
    const time = frameToTime(frame, fps);
    ticks.push({
      time,
      major: isMajor,
      label: !isMajor
        ? ''
        : timecode
          ? formatTimecode(time, fps)
          : `${Number(time.toFixed(3))} 秒`,
    });
    if (ticks.length >= 2000) break;
  }
  return ticks;
}
