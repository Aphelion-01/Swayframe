import {
  point4,
  projectPoint,
  cameraView,
  type Point3,
  type CameraSnapshot,
  type Matrix4,
} from '../core/perspective';
import type { ModelGeometry } from '../core/project-model';
export function projectedModel(
  mesh: ModelGeometry,
  world: Matrix4,
  camera: CameraSnapshot,
) {
  const faces: {
    points: { x: number; y: number; z: number }[];
    color: string;
    depth: number;
  }[] = [];
  const view = cameraView(camera);
  for (let i = 0; i < mesh.vertices.length; i += 9) {
    const p = [0, 3, 6].map((k) =>
      point4(world, mesh.vertices.slice(i + k, i + k + 3) as unknown as Point3),
    );
    const q = p.map((p) => projectPoint(p, camera, view));
    if (q.some((p) => !p)) continue;
    const a = p[1]!.map((n, k) => n - p[0]![k]!),
      b = p[2]!.map((n, k) => n - p[0]![k]!);
    const normal = [
        a[1]! * b[2]! - a[2]! * b[1]!,
        a[2]! * b[0]! - a[0]! * b[2]!,
        a[0]! * b[1]! - a[1]! * b[0]!,
      ],
      length = Math.hypot(...normal);
    const shade =
      0.4 +
      0.6 *
        Math.abs(
          (normal[0]! * 0.3 - normal[1]! * 0.6 - normal[2]! * 0.74) /
            Math.max(1e-12, length),
        );
    const rgb = mesh.colors
      .slice(i / 3, i / 3 + 3)
      .map((n) => Math.round(255 * n * shade));
    faces.push({
      points: q as NonNullable<(typeof q)[number]>[],
      color: `rgb(${rgb.join(',')})`,
      depth: q.reduce((sum, p) => sum + p!.z, 0) / 3,
    });
  }
  return faces.sort((a, b) => b.depth - a.depth);
}
export function drawModelMesh(
  ctx: CanvasRenderingContext2D,
  mesh: ModelGeometry,
  world: Matrix4,
  camera: CameraSnapshot,
) {
  for (const face of projectedModel(mesh, world, camera)) {
    ctx.beginPath();
    face.points.forEach((p, i) =>
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
    );
    ctx.closePath();
    ctx.fillStyle = face.color;
    ctx.fill();
  }
}
