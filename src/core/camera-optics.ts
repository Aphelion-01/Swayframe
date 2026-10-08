import { evaluateProperty } from './animation-engine';
import type { Layer } from './project-model';
import {
  transform4,
  point4,
  cameraView,
  type CameraSnapshot,
  type Point3,
  type Matrix4,
} from './perspective';
export function cameraForLayer(
  layer: Layer,
  time: number,
  width: number,
  height: number,
  world?: Matrix4,
): CameraSnapshot {
  const value = (key: string, fallback: number) =>
    layer.editor?.properties[key]
      ? (evaluateProperty(layer.editor.properties[key]!, time) as number)
      : fallback;
  const vector = (key: string, fallback: Point3) =>
    layer.editor?.properties[key]
      ? (evaluateProperty(layer.editor.properties[key]!, time) as Point3)
      : fallback;
  let rotation = vector('cameraRotation', [0, 0, 0]);
  if (world) {
    const sx = Math.hypot(world[0]!, world[4]!, world[8]!) || 1,
      sy = Math.hypot(world[1]!, world[5]!, world[9]!) || 1,
      sz = Math.hypot(world[2]!, world[6]!, world[10]!) || 1;
    const y = Math.asin(Math.max(-1, Math.min(1, -world[8]! / sx))),
      x =
        Math.abs(Math.cos(y)) > 1e-6
          ? Math.atan2(world[9]! / sy, world[10]! / sz)
          : 0,
      z =
        Math.abs(Math.cos(y)) > 1e-6
          ? Math.atan2(world[4]! / sx, world[0]! / sx)
          : Math.atan2(-world[1]! / sy, world[5]! / sy);
    rotation = [(x * 180) / Math.PI, (y * 180) / Math.PI, (z * 180) / Math.PI];
  }
  return {
    layerId: layer.id,
    position: world
      ? point4(world, [0, 0, 0])
      : vector('cameraPosition', [0, 0, -1000]),
    rotation,
    zoom: Math.max(1, value('cameraZoom', 1000)),
    width,
    height,
    depthOfField: value('cameraDepthOfField', 0) === 1,
    focusDistance: value('cameraFocusDistance', 1000),
    aperture: value('cameraAperture', 2.8),
    exposure: value('cameraExposure', 0),
  };
}
export function cameraFrustum(
  camera: CameraSnapshot,
  distance = camera.focusDistance ?? 1000,
): readonly Point3[] {
  const world = transform4(camera.position, camera.rotation),
    halfX = (camera.width * distance) / (2 * camera.zoom),
    halfY = (camera.height * distance) / (2 * camera.zoom);
  return [
    [-halfX, -halfY, distance],
    [halfX, -halfY, distance],
    [halfX, halfY, distance],
    [-halfX, halfY, distance],
  ].map((p) => point4(world, p as unknown as Point3));
}
/** Circle-of-confusion approximation at a layer depth; world units are treated as mm. */
export function cameraBlur(camera: CameraSnapshot, worldPoint: Point3): number {
  if (!camera.depthOfField || camera.orthographic) return 0;
  const z = point4(cameraView(camera), worldPoint)[2],
    focus = camera.focusDistance ?? 1000,
    f = (camera.zoom * 24) / camera.height;
  return Math.min(
    64,
    (Math.abs(
      (f * f * (focus - z)) /
        (Math.max(0.1, camera.aperture ?? 2.8) *
          Math.max(1, z) *
          Math.max(1, focus - f)),
    ) *
      camera.height) /
      24 /
      2,
  );
}
