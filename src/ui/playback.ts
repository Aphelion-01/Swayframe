export const advancePlayback = (
  time: number,
  elapsed: number,
  duration: number,
): number => (time + Math.max(0, elapsed)) % duration;
