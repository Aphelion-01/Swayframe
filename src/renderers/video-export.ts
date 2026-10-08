import {
  Output,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  WebMOutputFormat,
  MovOutputFormat,
  canEncodeVideo,
  Quality,
} from 'mediabunny';
import type { Project } from '../core/project-model';
import { validateOutputSettings } from '../core/output-settings';
import type { OutputSettings } from '../core/output-settings';
import { frameTimes } from './png-export';
import { OutputFrameRenderer } from './output-frame';
export type VideoFormat = 'mp4' | 'webm' | 'mov';
export interface VideoOutputSettings extends OutputSettings {
  format: VideoFormat;
  codec: 'avc' | 'hevc' | 'vp9';
  bitrate: number;
  bitrateMode: 'variable' | 'constant';
  keyFrameInterval: number;
}
export async function exportVideo(
  project: Project,
  compositionId: string,
  start: number,
  end: number,
  settings: VideoOutputSettings,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
) {
  validateOutputSettings(settings);
  if (signal?.aborted) throw Error('导出已取消');
  const c = project.compositions.find((c) => c.id === compositionId);
  if (!c || end > c.duration) throw Error('导出范围超出合成');
  if (settings.width % 2 || settings.height % 2)
    throw Error('视频宽高需要是偶数');
  if (
    !Number.isFinite(settings.bitrate) ||
    settings.bitrate < 0.1 ||
    settings.bitrate > 200
  )
    throw Error('视频码率必须是 0.1–200 Mbps');
  if (
    !Number.isFinite(settings.keyFrameInterval) ||
    settings.keyFrameInterval < 0.1 ||
    settings.keyFrameInterval > 30
  )
    throw Error('关键帧间隔必须在 0.1–30 秒之间');
  if (settings.transparent)
    throw Error('当前视频导出不保留透明度，请使用 PNG 序列');
  if ((settings.format === 'webm') !== (settings.codec === 'vp9'))
    throw Error('编码器与封装格式不兼容');
  const times = frameTimes(start, end, settings.fps);
  if (
    times.length > 18000 ||
    (end - start) * settings.bitrate * 125000 > 480_000_000
  )
    throw Error('单次导出最多 18,000 帧或预计 480 MB，请分段导出');
  if (
    !(await canEncodeVideo(settings.codec, {
      width: settings.width,
      height: settings.height,
      bitrate: settings.bitrate * 1e6,
    }))
  )
    throw Error(
      `此设备不支持所选编码器/分辨率。请尝试 MP4 H.264、WebM VP9 或 PNG 序列。`,
    );
  const frames = new OutputFrameRenderer(project, c, settings),
    target = new BufferTarget();
  const output = new Output({
    target,
    format:
      settings.format === 'webm'
        ? new WebMOutputFormat()
        : settings.format === 'mov'
          ? new MovOutputFormat()
          : new Mp4OutputFormat({ fastStart: 'in-memory' }),
  });
  const video = new CanvasSource(frames.canvas, {
    codec: settings.codec,
    quality: new Quality({
      bitrate: settings.bitrate * 1e6,
      bitrateMode: settings.bitrateMode,
    }),
    keyFrameInterval: settings.keyFrameInterval,
    latencyMode: 'quality',
  });
  output.addVideoTrack(video, { frameRate: settings.fps });
  try {
    await frames.init();
    await output.start();
    for (const [i, time] of times.entries()) {
      if (signal?.aborted) throw Error('导出已取消');
      frames.draw(time);
      await video.add(i / settings.fps, Math.min(1 / settings.fps, end - time));
      onProgress(i + 1, times.length);
      if (i % 3 === 0) await new Promise<void>((r) => setTimeout(r, 0));
    }
    video.close();
    await output.finalize();
    if (signal?.aborted) throw Error('导出已取消');
    if (!target.buffer || target.buffer.byteLength > 512_000_000)
      throw Error('视频超过 512 MB，请分段导出');
    return new Blob([target.buffer], {
      type:
        settings.format === 'webm'
          ? 'video/webm'
          : settings.format === 'mov'
            ? 'video/quicktime'
            : 'video/mp4',
    });
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  } finally {
    video.close();
    frames.dispose();
  }
}
