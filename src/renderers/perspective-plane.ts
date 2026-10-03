import { planeMesh } from '../core/perspective';
import type { Matrix4, CameraSnapshot } from '../core/perspective';
export function drawPerspectivePlane(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  world: Matrix4,
  camera: CameraSnapshot,
  width: number,
  height: number,
  padding: number,
): void {
  for (const [a, b, c] of planeMesh(world, camera, width, height, padding)) {
    const du1 = b.u - a.u,
      dv1 = b.v - a.v,
      du2 = c.u - a.u,
      dv2 = c.v - a.v,
      det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-9) continue;
    const dx1 = b.x - a.x,
      dy1 = b.y - a.y,
      dx2 = c.x - a.x,
      dy2 = c.y - a.y,
      A = (dx1 * dv2 - dx2 * dv1) / det,
      B = (dy1 * dv2 - dy2 * dv1) / det,
      C = (dx2 * du1 - dx1 * du2) / det,
      D = (dy2 * du1 - dy1 * du2) / det,
      E = a.x - A * a.u - C * a.v,
      F = a.y - B * a.u - D * a.v;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.closePath();
    ctx.clip();
    ctx.transform(A, B, C, D, E, F);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }
}
