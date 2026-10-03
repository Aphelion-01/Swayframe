import { z } from 'zod';
import type { AnimValue } from './core-types';
import type {
  Keyframe,
  Property,
  Project,
  Interpolation,
} from './project-model';
import { findProperty } from './project-model';
import { cubicBezier } from './cubic-bezier';

export const motionCurveSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('linear') }).strict(),
  z
    .object({
      type: z.literal('cubic-bezier'),
      x1: z.number().min(0).max(1),
      y1: z.number().min(-10).max(10),
      x2: z.number().min(0).max(1),
      y2: z.number().min(-10).max(10),
    })
    .strict(),
]);
export type MotionCurve = z.infer<typeof motionCurveSchema>;
export type CubicBezierCurve = Extract<MotionCurve, { type: 'cubic-bezier' }>;
export type MotionCurveApplyMode = 'both' | 'out' | 'in';
/** Reserved generator contract; these are not executable timing functions yet. */
export interface MotionCurveGenerator<P> {
  readonly type: string;
  generate(parameters: P): MotionCurve;
}
export interface SpringCurveParameters {
  readonly mass: number;
  readonly stiffness: number;
  readonly damping: number;
  readonly initialVelocity: number;
}
export interface BounceCurveParameters {
  readonly strength: number;
  readonly decay: number;
  readonly frequency: number;
}
export type FutureMotionCurve =
  | { readonly type: 'spring'; readonly parameters: SpringCurveParameters }
  | {
      readonly type: 'bounce' | 'elastic';
      readonly parameters: BounceCurveParameters;
    }
  | {
      readonly type: 'custom';
      readonly generatorId: string;
      readonly parameters: Readonly<Record<string, number>>;
    };
export const linearCurve: MotionCurve = Object.freeze({ type: 'linear' });
export function cubicCoordinates(curve: MotionCurve): CubicBezierCurve {
  return curve.type === 'linear'
    ? { type: 'cubic-bezier', x1: 0, y1: 0, x2: 1, y2: 1 }
    : curve;
}
export function evaluateMotionCurve(curve: MotionCurve, u: number): number {
  if (!Number.isFinite(u)) throw new Error('进度必须有限');
  return curve.type === 'linear'
    ? Math.max(0, Math.min(1, u))
    : cubicBezier(curve)(u);
}
export function motionCurveVelocity(curve: MotionCurve, u: number): number {
  const a = Math.max(0, u - 1e-5),
    b = Math.min(1, u + 1e-5);
  return b > a
    ? (evaluateMotionCurve(curve, b) - evaluateMotionCurve(curve, a)) / (b - a)
    : 0;
}
export function curveInterpolation(curve: MotionCurve): Interpolation {
  const c = motionCurveSchema.parse(curve);
  return c.type === 'linear'
    ? { type: 'linear' }
    : { type: 'bezier', out: { x: c.x1, y: c.y1 }, in: { x: c.x2, y: c.y2 } };
}
/** Equivalent segment representation backed by the existing left-out / right-in fields. */
export function segmentMotionCurve(
  left: Keyframe<AnimValue>,
  right: Keyframe<AnimValue>,
): MotionCurve | null {
  if (left.interpolation.type === 'linear') return linearCurve;
  if (left.interpolation.type !== 'bezier') return null;
  const out = left.outgoing ?? left.interpolation.out,
    input = right.incoming ?? left.interpolation.in;
  return {
    type: 'cubic-bezier',
    x1: out.x,
    y1: out.y,
    x2: input.x,
    y2: input.y,
  };
}
export interface MotionSegment {
  readonly id: string;
  readonly propertyId: string;
  readonly from: Keyframe<AnimValue>;
  readonly to: Keyframe<AnimValue>;
  readonly curve: MotionCurve | null;
}
export function motionSegments(
  property: Property<AnimValue>,
): readonly MotionSegment[] {
  const frames = [...property.keyframes].sort((a, b) => a.time - b.time);
  return frames.slice(0, -1).map((from, i) => {
    const to = frames[i + 1]!;
    return {
      id: `${property.id}/${from.id}/${to.id}`,
      propertyId: property.id,
      from,
      to,
      curve: segmentMotionCurve(from, to),
    };
  });
}
export function resolveMotionSegment(
  project: Project,
  id: string,
): MotionSegment {
  const propertyId = id.split('/')[0]!;
  const segment = motionSegments(
    findProperty(project, propertyId).property,
  ).find((s) => s.id === id);
  if (!segment) throw new Error('动画区间不存在或关键帧已不相邻');
  return segment;
}
