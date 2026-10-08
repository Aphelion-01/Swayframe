import type { Point3, CameraSnapshot } from './perspective';
export interface SpatialView {
  yaw: number;
  pitch: number;
  distance: number;
  target: Point3;
  orthographic: boolean;
  orbitOrigin?: Point3;
}
export const defaultSpatialView: SpatialView = {
  yaw: -0.55,
  pitch: 0.35,
  distance: 2200,
  target: [0, 0, 0],
  orthographic: false,
};
export function spatialBasis(v: SpatialView) {
  const sy = Math.sin(v.yaw),
    cy = Math.cos(v.yaw),
    sp = Math.sin(v.pitch),
    cp = Math.cos(v.pitch);
  return {
    right: [cy, 0, -sy] as Point3,
    down: [sy * sp, cp, cy * sp] as Point3,
    forward: [sy * cp, -sp, cy * cp] as Point3,
  };
}
export function spatialProject(
  p: Point3,
  v: SpatialView,
  width: number,
  height: number,
) {
  const b = spatialBasis(v),
    d = p.map((n, i) => n - v.target[i]!) as unknown as Point3;
  const dot = (a: Point3) => a.reduce((s, n, i) => s + n * d[i]!, 0);
  const z = dot(b.forward) + v.distance;
  if (z <= 1) return null;
  const scale =
    (Math.min(width, height) * 1.25) / (v.orthographic ? v.distance : z);
  return {
    x: width / 2 + dot(b.right) * scale,
    y: height / 2 + dot(b.down) * scale,
    z,
  };
}
/** Project pointer displacement onto the displayed axis. Units are local parent-space pixels. */
export function axisDragAmount(
  dx: number,
  dy: number,
  ax: number,
  ay: number,
  units: number,
) {
  const n = ax * ax + ay * ay;
  return n < 1e-8 ? 0 : ((dx * ax + dy * ay) / n) * units;
}
export function rulerStep(unitsPerPixel: number) {
  const desired = Math.max(1, unitsPerPixel * 64),
    power = 10 ** Math.floor(Math.log10(desired));
  return [1, 2, 5, 10].map((n) => n * power).find((n) => n >= desired)!;
}

/** Clip grid lines at the observer's near plane instead of losing the whole line. */
export function spatialSegment(
  a: Point3,
  b: Point3,
  view: SpatialView,
  width: number,
  height: number,
) {
  const forward = spatialBasis(view).forward;
  const depth = (p: Point3) =>
    forward.reduce(
      (sum, n, i) => sum + n * (p[i]! - view.target[i]!),
      view.distance,
    );
  const za = depth(a),
    zb = depth(b),
    near = 2;
  if (za < near && zb < near) return null;
  const interpolate = (t: number) =>
    a.map((n, i) => n + (b[i]! - n) * t) as unknown as Point3;
  const p = spatialProject(
    za < near ? interpolate((near - za) / (zb - za)) : a,
    view,
    width,
    height,
  );
  const q = spatialProject(
    zb < near ? interpolate((near - za) / (zb - za)) : b,
    view,
    width,
    height,
  );
  return p && q ? ([p, q] as const) : null;
}

/** Observer camera is transient UI state; it never replaces the composition camera. */
export function spatialCamera(
  view: SpatialView,
  width: number,
  height: number,
): CameraSnapshot {
  const forward = spatialBasis(view).forward;
  const focal = Math.min(width, height) * 1.25;
  return {
    position: view.target.map(
      (n, i) => n - forward[i]! * view.distance,
    ) as unknown as Point3,
    rotation: [(view.pitch * 180) / Math.PI, (view.yaw * 180) / Math.PI, 0],
    zoom: view.orthographic ? focal / view.distance : focal,
    orthographic: view.orthographic,
    width,
    height,
  };
}

export interface SpatialWheelInput {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  shiftKey: boolean;
}
/** Chromium exposes trackpad pinch as ctrl+wheel. Continuous pixel deltas orbit. */
export function navigateSpatialWheel(
  view: SpatialView,
  input: SpatialWheelInput,
  width: number,
  height: number,
): SpatialView {
  const coarseWheel =
    input.deltaMode !== 0 ||
    (input.deltaX === 0 &&
      Math.abs(input.deltaY) >= 100 &&
      Number.isInteger(input.deltaY / 100));
  const multiplier =
    input.deltaMode === 1 ? 16 : input.deltaMode === 2 ? height : 1;
  const dx = input.deltaX * multiplier,
    dy = input.deltaY * multiplier;
  if (input.ctrlKey || (!input.shiftKey && coarseWheel)) {
    const sensitivity = input.ctrlKey ? 0.018 : 0.0025;
    return {
      ...view,
      distance: Math.max(
        10,
        Math.min(
          1000000,
          view.distance *
            Math.exp(Math.max(-1.5, Math.min(1.5, dy * sensitivity))),
        ),
      ),
    };
  }
  if (input.shiftKey) {
    const basis = spatialBasis(view),
      scale = view.distance / (Math.max(1, Math.min(width, height)) * 1.25);
    // Follow fingers in screen space; no easing or artificial inertia.
    return {
      ...view,
      target: view.target.map(
        (n, i) => n + (dx * basis.right[i]! + dy * basis.down[i]!) * scale,
      ) as unknown as Point3,
    };
  }
  return orbitSpatialView(view, -dx * 0.006, dy * 0.006);
}
export function unwrapAngle(next: number, previous: number) {
  return Math.atan2(Math.sin(next - previous), Math.cos(next - previous));
}

/** Preserve the screen-space pan offset while orbiting the chosen world pivot. */
export function orbitSpatialView(
  view: SpatialView,
  deltaYaw: number,
  deltaPitch: number,
): SpatialView {
  const next = {
    ...view,
    yaw: view.yaw + deltaYaw,
    pitch: Math.max(
      -Math.PI / 2 + 0.001,
      Math.min(Math.PI / 2 - 0.001, view.pitch + deltaPitch),
    ),
  };
  const pivot = view.orbitOrigin ?? [0, 0, 0],
    before = spatialBasis(view),
    after = spatialBasis(next);
  const coordinates = [before.right, before.down, before.forward].map((axis) =>
    axis.reduce((sum, n, i) => sum + n * (view.target[i]! - pivot[i]!), 0),
  );
  return {
    ...next,
    target: pivot.map(
      (n, i) =>
        n +
        after.right[i]! * coordinates[0]! +
        after.down[i]! * coordinates[1]! +
        after.forward[i]! * coordinates[2]!,
    ) as unknown as Point3,
  };
}
