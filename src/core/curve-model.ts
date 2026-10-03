import { motionCurveVelocity, segmentMotionCurve } from './motion-curve';
import { spatialControls } from './spatial-path';
import type { AnimValue, Vec2 } from './core-types';
import type { Interpolation, Property, Keyframe } from './project-model';
import { evaluateProperty } from './animation-engine';
export const easePresets: Readonly<Record<string, Interpolation>> = {
  linear: { type: 'linear' },
  hold: { type: 'hold' },
  easeIn: { type: 'bezier', out: { x: 0.42, y: 0 }, in: { x: 1, y: 1 } },
  easeOut: { type: 'bezier', out: { x: 0, y: 0 }, in: { x: 0.58, y: 1 } },
  easeInOut: { type: 'bezier', out: { x: 0.42, y: 0 }, in: { x: 0.58, y: 1 } },
};
export function components(v: AnimValue): readonly number[] {
  return typeof v === 'number'
    ? [v]
    : Array.isArray(v)
      ? v
      : [(v as Vec2).x, (v as Vec2).y];
}
export function valueComponent(v: AnimValue, index = 0): number {
  return components(v)[index] ?? 0;
}
export function valueDistance(a: AnimValue, b: AnimValue): number {
  const x = components(a),
    y = components(b);
  return Math.hypot(...x.map((v, i) => (y[i] ?? v) - v));
}
export function propertySpeed(
  property: Property<AnimValue>,
  time: number,
): number {
  const frames = [...property.keyframes].sort((a, b) => a.time - b.time),
    first = frames[0],
    last = frames.at(-1);
  if (
    !first ||
    !last ||
    time < first.time ||
    time > last.time ||
    frames.length < 2
  )
    return 0;
  const dt = Math.max(1e-7, (last.time - first.time) * 1e-5),
    a = Math.max(first.time, time - dt),
    b = Math.min(last.time, time + dt);
  return b > a
    ? valueDistance(
        evaluateProperty(property, a),
        evaluateProperty(property, b),
      ) /
        (b - a)
    : 0;
}
export function sampleCurve(
  property: Property<AnimValue>,
  start: number,
  end: number,
  mode: 'value' | 'speed',
  component = 0,
  count = 200,
): readonly { time: number; value: number }[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const time = start + ((end - start) * i) / count;
    return {
      time,
      value:
        mode === 'speed'
          ? propertySpeed(property, time)
          : valueComponent(evaluateProperty(property, time), component),
    };
  });
}
export function segmentControls(
  frame: Keyframe<AnimValue>,
  next?: Keyframe<AnimValue>,
): { out: Vec2; in: Vec2 } {
  const basic =
    frame.interpolation.type === 'bezier'
      ? frame.interpolation
      : { out: { x: 1 / 3, y: 1 / 3 }, in: { x: 2 / 3, y: 2 / 3 } };
  return frame.interpolation.type === 'bezier'
    ? { out: frame.outgoing ?? basic.out, in: next?.incoming ?? basic.in }
    : { out: basic.out, in: basic.in };
}

export function spatialEndpointDistances(
  frame: Keyframe<AnimValue>,
  next: Keyframe<AnimValue>,
): { out: number; in: number } {
  if (frame.spatialOutgoing || next.spatialIncoming) {
    const controls = spatialControls(frame, next);
    return {
      out: 3 * valueDistance(frame.value, controls.out),
      in: 3 * valueDistance(controls.in, next.value),
    };
  }
  const distance = valueDistance(frame.value, next.value);
  return { out: distance, in: distance };
}
export function controlsFromSpeed(
  frame: Keyframe<AnimValue>,
  next: Keyframe<AnimValue>,
  outInfluence: number,
  inInfluence: number,
  outSpeed: number,
  inSpeed: number,
): { out: Vec2; in: Vec2 } {
  const duration = next.time - frame.time,
    distance = spatialEndpointDistances(frame, next),
    previous = speedsFromControls(frame, next);
  const ox = Math.max(0.001, Math.min(1, outInfluence / 100)),
    ix = 1 - Math.max(0.001, Math.min(1, inInfluence / 100));
  const clamp = (v: number) => Math.max(-10, Math.min(10, v));
  const outVelocity = outSpeed * (Math.sign(previous.outVelocity) || 1),
    inVelocity = inSpeed * (Math.sign(previous.inVelocity) || 1);
  return {
    out: {
      x: ox,
      y: clamp(distance.out ? (outVelocity * duration * ox) / distance.out : 0),
    },
    in: {
      x: ix,
      y: clamp(
        distance.in ? 1 - (inVelocity * duration * (1 - ix)) / distance.in : 1,
      ),
    },
  };
}
export function speedsFromControls(
  frame: Keyframe<AnimValue>,
  next: Keyframe<AnimValue>,
): {
  outSpeed: number;
  inSpeed: number;
  outVelocity: number;
  inVelocity: number;
  outInfluence: number;
  inInfluence: number;
} {
  const c = segmentControls(frame, next),
    duration = next.time - frame.time,
    distance = spatialEndpointDistances(frame, next),
    curve = segmentMotionCurve(frame, next) ?? { type: 'linear' as const };
  const outSlope =
      c.out.x > 1e-8 ? c.out.y / c.out.x : motionCurveVelocity(curve, 0),
    inSlope =
      1 - c.in.x > 1e-8
        ? (1 - c.in.y) / (1 - c.in.x)
        : motionCurveVelocity(curve, 1);
  const outVelocity = (distance.out / duration) * outSlope,
    inVelocity = (distance.in / duration) * inSlope;
  return {
    outSpeed: Math.abs(outVelocity),
    inSpeed: Math.abs(inVelocity),
    outVelocity,
    inVelocity,
    outInfluence: c.out.x * 100,
    inInfluence: (1 - c.in.x) * 100,
  };
}
export function propertySpeedUnit(key: string): {
  label: string;
  factor: number;
} {
  if (/scale|opacity/i.test(key)) return { label: '%/s', factor: 100 };
  if (/rotation/i.test(key)) return { label: 'deg/s', factor: 1 };
  if (
    /position|anchor|path|feather|radius|width|fontSize|tracking|cameraZoom/i.test(
      key,
    )
  )
    return { label: 'px/s', factor: 1 };
  return { label: '单位/s', factor: 1 };
}
