import { resolveTransformBasis, deltaInBasis } from './transform-resolvers';
import { apply2D, inverse2D, multiply2D, identity2D } from './matrix2d';
import type { Matrix2D } from './matrix2d';
import type { Vec2 } from './core-types';
import type { TransformContext } from './transform-context';
import type { RenderLayer } from './renderer-core';
import { evaluateProperty } from './animation-engine';
export type TransformOperation =
  | { readonly kind: 'move'; readonly delta: Vec2 }
  | { readonly kind: 'scale'; readonly factor: Vec2 }
  | { readonly kind: 'rotate'; readonly angle: number };
function around(linear: Matrix2D, pivot: Vec2): Matrix2D {
  const p = apply2D(linear, pivot);
  return [
    linear[0],
    linear[1],
    linear[2],
    linear[3],
    pivot.x - p.x,
    pivot.y - p.y,
  ];
}
/** Reject affine shear rather than silently distort the existing TRS animation model. */
function decompose(m: Matrix2D, item: RenderLayer, time: number, flipX = 1) {
  const anchor = item.anchor ?? { x: 0, y: 0 },
    reference = evaluateProperty(item.source.transform.rotation, time),
    oldScale = evaluateProperty(item.source.transform.scale, time);
  const nx = Math.hypot(m[0], m[1]),
    ny = Math.hypot(m[2], m[3]);
  if (
    nx < 1e-9 ||
    ny < 1e-9 ||
    Math.abs(m[0] * m[2] + m[1] * m[3]) > 1e-6 * nx * ny
  )
    throw Error(
      '当前轴向的变换会产生工程模型不支持的剪切。请切换局部轴向或使用等比缩放。',
    );
  const sx = nx * (Math.sign(oldScale.x * flipX) || 1),
    sy = (m[0] * m[3] - m[1] * m[2]) / sx;
  let rotation = (Math.atan2(m[1] / sx, m[0] / sx) * 180) / Math.PI;
  rotation += 360 * Math.round((reference - rotation) / 360);
  const clean = (n: number) => Number(n.toPrecision(14));
  if (Math.abs(rotation - reference) < 1e-9) rotation = reference;
  return {
    position: apply2D(m, anchor),
    scale: { x: clean(sx), y: clean(sy) },
    rotation: clean(rotation),
  };
}
export function transformItems(
  context: TransformContext,
  operation: TransformOperation,
): readonly RenderLayer[] {
  const initial = [...context.initialTransforms.values()],
    targets = new Map<string, Matrix2D>();
  for (const item of initial) {
    const pivot = context.pivots.get(item.source.id) ?? context.pivot;
    let affine: Matrix2D;
    if (operation.kind === 'move')
      affine = [1, 0, 0, 1, operation.delta.x, operation.delta.y];
    else if (operation.kind === 'rotate') {
      const r = (operation.angle * Math.PI) / 180;
      affine = around(
        [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0],
        pivot,
      );
    } else {
      const basis = (
          context.settings.pivotMode === 'individual-origins'
            ? resolveTransformBasis(
                context.snapshot,
                context.settings.orientation,
                item,
              )
            : context.basis
        ).matrix,
        inverse = inverse2D(basis) ?? identity2D;
      affine = around(
        multiply2D(
          multiply2D(basis, [
            operation.factor.x,
            0,
            0,
            operation.factor.y,
            0,
            0,
          ]),
          inverse,
        ),
        pivot,
      );
    }
    targets.set(item.source.id, multiply2D(affine, item.matrix!));
  }
  return initial.map((item) => {
    const world = targets.get(item.source.id)!,
      parentId = item.source.editor?.parentId;
    const parent = parentId
      ? (targets.get(parentId) ??
        context.snapshot.layers.find((l) => l.source.id === parentId)?.matrix)
      : undefined;
    const inverse = parent ? inverse2D(parent) : identity2D;
    if (!inverse) throw Error('父级缩放为零，无法计算变换。');
    const local =
      operation.kind === 'move'
        ? {
            position: apply2D(
              multiply2D(inverse, world),
              item.anchor ?? { x: 0, y: 0 },
            ),
            scale: evaluateProperty(
              item.source.transform.scale,
              context.snapshot.time,
            ),
            rotation: evaluateProperty(
              item.source.transform.rotation,
              context.snapshot.time,
            ),
          }
        : decompose(
            multiply2D(inverse, world),
            item,
            context.snapshot.time,
            operation.kind === 'scale' &&
              context.settings.orientation === 'local'
              ? operation.factor.x
              : 1,
          );
    return {
      ...item,
      matrix: world,
      position: apply2D(world, item.anchor ?? { x: 0, y: 0 }),
      scale: local.scale,
      rotation: local.rotation,
      localTransform: local,
    };
  });
}

export function pointerTransformOperation(
  context: TransformContext,
  kind: 'scale' | 'rotate',
  start: Vec2,
  end: Vec2,
  direction: Vec2 = { x: 1, y: 1 },
  uniform = false,
): TransformOperation {
  const pivot = context.pivot;
  const a = deltaInBasis(context.basis, {
      x: start.x - pivot.x,
      y: start.y - pivot.y,
    }),
    b = deltaInBasis(context.basis, { x: end.x - pivot.x, y: end.y - pivot.y });
  if (kind === 'rotate') {
    let angle =
      Math.atan2(end.y - pivot.y, end.x - pivot.x) -
      Math.atan2(start.y - pivot.y, start.x - pivot.x);
    if (angle > Math.PI) angle -= 2 * Math.PI;
    if (angle < -Math.PI) angle += 2 * Math.PI;
    return { kind, angle: (angle * 180) / Math.PI };
  }
  const ratio = (axis: 'x' | 'y') =>
    !direction[axis] || Math.abs(a[axis]) < 1e-9 ? 1 : b[axis] / a[axis];
  let x = ratio('x'),
    y = ratio('y');
  if (uniform) {
    const n =
      direction.x && direction.y
        ? Math.abs(x - 1) >= Math.abs(y - 1)
          ? x
          : y
        : direction.x
          ? x
          : y;
    x = n;
    y = n;
  }
  const clamp = (n: number) =>
    Math.abs(n) < 0.001 ? (n < 0 ? -0.001 : 0.001) : n;
  return { kind, factor: { x: clamp(x), y: clamp(y) } };
}
