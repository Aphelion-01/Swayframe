export type Matrix4 = readonly number[];
export type Point3 = readonly [number, number, number];
export interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
export interface CameraSnapshot {
  readonly position: Point3;
  readonly rotation: Point3;
  readonly zoom: number;
  readonly width: number;
  readonly height: number;
}
export const identity4: Matrix4 = [
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
];
export function multiply4(a: Matrix4, b: Matrix4): Matrix4 {
  return Array.from({ length: 16 }, (_, i) => {
    const row = Math.floor(i / 4),
      col = i % 4;
    return [0, 1, 2, 3].reduce(
      (sum, k) => sum + a[row * 4 + k]! * b[k * 4 + col]!,
      0,
    );
  });
}
export function point4(m: Matrix4, p: Point3): Point3 {
  return [
    m[0]! * p[0] + m[1]! * p[1] + m[2]! * p[2] + m[3]!,
    m[4]! * p[0] + m[5]! * p[1] + m[6]! * p[2] + m[7]!,
    m[8]! * p[0] + m[9]! * p[1] + m[10]! * p[2] + m[11]!,
  ];
}
export function transform4(
  position: Point3,
  rotation: Point3,
  scale: Point3 = [1, 1, 1],
  anchor: Point3 = [0, 0, 0],
): Matrix4 {
  const [x, y, z] = rotation.map((v) => (v * Math.PI) / 180),
    cx = Math.cos(x!),
    sx = Math.sin(x!),
    cy = Math.cos(y!),
    sy = Math.sin(y!),
    cz = Math.cos(z!),
    sz = Math.sin(z!);
  const rx = [1, 0, 0, 0, 0, cx, -sx, 0, 0, sx, cx, 0, 0, 0, 0, 1],
    ry = [cy, 0, sy, 0, 0, 1, 0, 0, -sy, 0, cy, 0, 0, 0, 0, 1],
    rz = [cz, -sz, 0, 0, sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const translation = [
      1,
      0,
      0,
      position[0],
      0,
      1,
      0,
      position[1],
      0,
      0,
      1,
      position[2],
      0,
      0,
      0,
      1,
    ],
    s = [scale[0], 0, 0, 0, 0, scale[1], 0, 0, 0, 0, scale[2], 0, 0, 0, 0, 1],
    a = [
      1,
      0,
      0,
      -anchor[0],
      0,
      1,
      0,
      -anchor[1],
      0,
      0,
      1,
      -anchor[2],
      0,
      0,
      0,
      1,
    ];
  return multiply4(
    multiply4(multiply4(translation, multiply4(rz, multiply4(ry, rx))), s),
    a,
  );
}
export function cameraView(camera: CameraSnapshot): Matrix4 {
  const [x, y, z] = camera.rotation.map((v) => -v),
    rx = transform4([0, 0, 0], [x!, 0, 0]),
    ry = transform4([0, 0, 0], [0, y!, 0]),
    rz = transform4([0, 0, 0], [0, 0, z!]),
    translation = transform4(
      camera.position.map((v) => -v) as unknown as Point3,
      [0, 0, 0],
    );
  return multiply4(multiply4(rx, multiply4(ry, rz)), translation);
}
export function projectPoint(
  point: Point3,
  camera: CameraSnapshot,
  view = cameraView(camera),
): ProjectedPoint | null {
  const [x, y, z] = point4(view, point);
  if (z <= 1) return null;
  const ratio = camera.zoom / z;
  return {
    x: camera.width / 2 + x * ratio,
    y: camera.height / 2 + y * ratio,
    z,
  };
}
export interface MeshPoint extends ProjectedPoint {
  readonly u: number;
  readonly v: number;
}
export function planeMesh(
  world: Matrix4,
  camera: CameraSnapshot,
  width: number,
  height: number,
  padding = 0,
  steps = 12,
): readonly (readonly [MeshPoint, MeshPoint, MeshPoint])[] {
  const sw = width + padding * 2,
    sh = height + padding * 2,
    view = cameraView(camera),
    vertices = Array.from({ length: (steps + 1) ** 2 }, (_, i) => {
      const u = ((i % (steps + 1)) / steps) * sw,
        v = (Math.floor(i / (steps + 1)) / steps) * sh,
        point = projectPoint(
          point4(world, [u - sw / 2, v - sh / 2, 0]),
          camera,
          view,
        );
      return point ? { ...point, u, v } : null;
    });
  const triangles: (readonly [MeshPoint, MeshPoint, MeshPoint])[] = [];
  for (let y = 0; y < steps; y++)
    for (let x = 0; x < steps; x++) {
      const a = vertices[y * (steps + 1) + x],
        b = vertices[y * (steps + 1) + x + 1],
        d = vertices[(y + 1) * (steps + 1) + x],
        e = vertices[(y + 1) * (steps + 1) + x + 1];
      if (a && b && d && e) {
        triangles.push([a, b, e], [a, e, d]);
      }
    }
  return triangles;
}
export function pointInQuad(
  points: readonly ProjectedPoint[],
  point: { x: number; y: number },
): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!,
      b = points[j]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
