import { z } from 'zod';
import type { AgentToolRegistry } from './tool-registry';
export const referenceModeSchema = z.enum([
  'layout-only',
  'color-only',
  'typography-only',
  'shape-only',
  'overall',
]);
export type ReferenceMode = z.infer<typeof referenceModeSchema>;
export const agentReferenceSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().max(200),
    kind: z.enum(['image', 'gif-first-frame', 'video-samples']),
    frames: z
      .array(
        z
          .string()
          .max(2000000)
          .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
      )
      .min(1)
      .max(3),
  })
  .strict();
export type AgentReference = z.infer<typeof agentReferenceSchema>;
const allowed: Record<Exclude<ReferenceMode, 'overall'>, readonly string[]> = {
  'layout-only': ['setPosition', 'setScale', 'setTextAlignment'],
  'color-only': ['setFill', 'setTextColor', 'setStroke'],
  'typography-only': [
    'setFont',
    'setFontSize',
    'setTracking',
    'setLeading',
    'setTextAlignment',
  ],
  'shape-only': [
    'createRectangle',
    'createEllipse',
    'createPolygon',
    'createStar',
    'createPath',
  ],
};
export function referenceToolScope(
  registry: AgentToolRegistry,
  skill: readonly string[] | undefined,
  mode: ReferenceMode | undefined,
) {
  if (!mode || mode === 'overall') return skill;
  const reads = new Set(registry.readDefinitions().map((t) => t.name));
  return registry
    .definitions(skill)
    .map((t) => t.name)
    .filter((name) => reads.has(name) || allowed[mode].includes(name));
}
function frame(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement('canvas'),
    s = Math.min(720 / Math.max(width, height), 1);
  canvas.width = Math.max(1, Math.round(width * s));
  canvas.height = Math.max(1, Math.round(height * s));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('无法生成参考预览');
  try {
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    canvas.width = canvas.height = 1;
  }
}
/** Only File objects explicitly selected by the user enter here. No disk path API. */
export async function importAgentReference(
  file: File,
  signal: AbortSignal,
): Promise<AgentReference> {
  signal.throwIfAborted();
  if (file.size > 200 * 1024 * 1024) throw Error('参考素材超过200 MB');
  const base = { id: crypto.randomUUID(), name: file.name.slice(0, 200) };
  if (
    ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)
  ) {
    const bitmap = await createImageBitmap(file);
    try {
      signal.throwIfAborted();
      return agentReferenceSchema.parse({
        ...base,
        kind: file.type === 'image/gif' ? 'gif-first-frame' : 'image',
        frames: [frame(bitmap, bitmap.width, bitmap.height)],
      });
    } finally {
      bitmap.close();
    }
  }
  if (!file.type.startsWith('video/'))
    throw Error('请选择PNG/JPEG/WebP/GIF或可解码视频');
  const video = document.createElement('video'),
    url = URL.createObjectURL(file);
  video.preload = 'auto';
  video.muted = true;
  video.src = url;
  const wait = (event: string) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => finish(Error('参考视频解码超时')), 15000);
      const success = () => finish(),
        failure = () => finish(Error('无法解码参考视频')),
        abort = () => finish(Error('参考导入已取消'));
      const finish = (error?: Error) => {
        clearTimeout(timer);
        video.removeEventListener(event, success);
        video.removeEventListener('error', failure);
        signal.removeEventListener('abort', abort);
        if (error) reject(error);
        else resolve();
      };
      video.addEventListener(event, success, { once: true });
      video.addEventListener('error', failure, { once: true });
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  try {
    await wait('loadeddata');
    if (!Number.isFinite(video.duration) || video.duration <= 0)
      throw Error('参考视频时长无效');
    const frames: string[] = [];
    for (const fraction of [0.05, 0.5, 0.95]) {
      signal.throwIfAborted();
      const seeking = wait('seeked');
      video.currentTime = Math.min(
        video.duration - 0.001,
        video.duration * fraction,
      );
      await seeking;
      frames.push(frame(video, video.videoWidth, video.videoHeight));
    }
    return agentReferenceSchema.parse({
      ...base,
      kind: 'video-samples',
      frames,
    });
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
