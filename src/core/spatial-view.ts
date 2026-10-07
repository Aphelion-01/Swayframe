import type { Point3, CameraSnapshot } from './perspective';
export interface SpatialView {
  yaw: number;
  pitch: number;
  distance: number;
  target: Point3;
  orthographic: boolean;
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
