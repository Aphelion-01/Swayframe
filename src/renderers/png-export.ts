import type { Project } from '../core/project-model';
import { createRenderSnapshot } from '../core/renderer-core';
import { Canvas2DRenderer } from './canvas2d';
import { surface } from './layer-compositing';
import { backgroundTasks } from '../desktop/background-tasks';
import type { ZipEntry } from '../core/zip-archive';
export function frameTimes(
  start: number,
  end: number,
  fps: number,
): readonly number[] {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(fps) ||
    start < 0 ||
    end <= start ||
    fps <= 0
  )
    throw new Error('导出范围无效');
  return Array.from(
    { length: Math.ceil((end - start) * fps - 1e-8) },
    (_, i) => start + i / fps,
  );
}
const png = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG 编码失败'))),
      'image/png',
    ),
  );
export async function exportPngSequence(
  project: Project,
  compositionId: string,
  start: number,
  end: number,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const c = project.compositions.find((c) => c.id === compositionId);
  if (!c || end > c.duration) throw new Error('导出范围超出合成');
  const times = frameTimes(start, end, c.fps);
  if (times.length > 3000) throw new Error('请分段导出，每次最多 3000 帧');
  const renderer = new Canvas2DRenderer(),
    canvas = surface(c.width, c.height),
    entries: ZipEntry[] = [];
  let bytes = 0;
  try {
    await renderer.syncAssets(project.assets);
    for (const [i, time] of times.entries()) {
      if (signal?.aborted) throw new Error('导出已取消');
      renderer.render(
        createRenderSnapshot(c, time, [], undefined, project),
        canvas,
      );
      const data = new Uint8Array(await (await png(canvas)).arrayBuffer());
      bytes += data.length;
      if (bytes > 512_000_000) throw new Error('序列超过 512 MB，请分段导出');
      entries.push({ name: `frames/${String(i).padStart(6, '0')}.png`, data });
      onProgress(i + 1, times.length);
      if (i % 3 === 0)
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
    }
    entries.push({
      name: 'manifest.json',
      data: new TextEncoder().encode(
        JSON.stringify(
          {
            compositionId,
            width: c.width,
            height: c.height,
            fps: c.fps,
            start,
            end,
            frameCount: times.length,
            times,
          },
          null,
          2,
        ),
      ),
    });
    return new Blob([await backgroundTasks.archive(entries, signal)], {
      type: 'application/zip',
    });
  } finally {
    renderer.dispose();
  }
}
export async function exportCurrentFrame(
  project: Project,
  compositionId: string,
  time: number,
): Promise<Blob> {
  const c = project.compositions.find((c) => c.id === compositionId);
  if (!c) throw new Error('合成不存在');
  const renderer = new Canvas2DRenderer(),
    canvas = surface(c.width, c.height);
  try {
    await renderer.syncAssets(project.assets);
    renderer.render(
      createRenderSnapshot(c, time, [], undefined, project),
      canvas,
    );
    return await png(canvas);
  } finally {
    renderer.dispose();
  }
}
