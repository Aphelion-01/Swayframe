import { deepFreeze } from './core-types';
import { cubicCoordinates, motionCurveSchema } from './motion-curve';
import type { MotionCurve } from './motion-curve';
/** Exact time/progress reversal: 1 - f(1-u). */
export function reverseMotionCurve(input: MotionCurve): MotionCurve {
  const curve = motionCurveSchema.parse(input);
  if (curve.type === 'linear') return curve;
  return {
    type: 'cubic-bezier',
    x1: 1 - curve.x2,
    y1: 1 - curve.y2,
    x2: 1 - curve.x1,
    y2: 1 - curve.y1,
  };
}
/** Keep one side, copy its center reflection to the other (not a reversal). */
export function mirrorMotionCurve(
  input: MotionCurve,
  from: 'out' | 'in' = 'out',
): MotionCurve {
  const c = cubicCoordinates(motionCurveSchema.parse(input));
  return from === 'out'
    ? { ...c, x2: 1 - c.x1, y2: 1 - c.y1 }
    : { ...c, x1: 1 - c.x2, y1: 1 - c.y2 };
}
export class MotionCurveClipboard {
  #curve?: MotionCurve;
  copy(curve: MotionCurve): void {
    this.#curve = deepFreeze(motionCurveSchema.parse(curve));
  }
  read(): MotionCurve | undefined {
    return this.#curve;
  }
}
