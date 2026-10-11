import { decodeAudioBlob } from '../importers/audio-decode';
import { Input, ALL_FORMATS, BlobSource, AudioBufferSink } from 'mediabunny';
import type { Project, Composition } from '../core/project-model';
import { assetImageBlob } from './canvas2d';
/** Mix trimmed media tracks against the composition clock, independently of preview playback. */
export async function mixCompositionAudio(
  project: Project,
  c: Composition,
  start: number,
  end: number,
  signal?: AbortSignal,
) {
  const layers = c.layers.filter(
    (l) =>
      (l.type === 'audio' || l.type === 'video') &&
      l.visible &&
      (l.editor?.outPoint ?? c.duration) > start &&
      (l.editor?.inPoint ?? 0) < end,
  );
  if (!layers.length) return null;
  const rate = 48000,
    length = Math.ceil((end - start) * rate);
  if (length * 2 * 4 > 256 * 1024 * 1024)
    throw Error('音频混音超过 256 MB 内存预算，请分段导出');
  const context = new OfflineAudioContext(2, length, rate);
  let tracks = 0;
  for (const layer of layers) {
    signal?.throwIfAborted();
    if (!('assetId' in layer)) continue;
    const asset = project.assets.find((a) => a.id === layer.assetId);
    if (!asset) throw Error('音频素材失联');
    const blob = await assetImageBlob(asset);
    if (asset.mimeType.startsWith('audio/')) {
      const decoded = await decodeAudioBlob(blob);
      const from = Math.max(start, layer.editor?.inPoint ?? 0);
      const to = Math.min(end, layer.editor?.outPoint ?? c.duration);
      const offset = layer.editor?.startTime ?? 0;
      const local = Math.max(0, from - offset);
      const duration = Math.min(to - from, decoded.duration - local);
      if (duration > 0) {
        const source = context.createBufferSource();
        source.buffer = decoded;
        source.connect(context.destination);
        source.start(from - start, local, duration);
        tracks++;
      }
      continue;
    }
    const input = new Input({
      source: new BlobSource(blob),
      formats: ALL_FORMATS,
    });
    try {
      const track = await input.getPrimaryAudioTrack();
      if (!track) continue;
      if (!(await track.canDecode())) {
        const decoded = await decodeAudioBlob(blob);
        const from = Math.max(start, layer.editor?.inPoint ?? 0);
        const to = Math.min(end, layer.editor?.outPoint ?? c.duration);
        const offset = layer.editor?.startTime ?? 0;
        const local = Math.max(0, from - offset);
        const duration = Math.min(to - from, decoded.duration - local);
        if (duration > 0) {
          const source = context.createBufferSource();
          source.buffer = decoded;
          source.connect(context.destination);
          source.start(from - start, local, duration);
          tracks++;
        }
        continue;
      }
      tracks++;
      const inPoint = layer.editor?.inPoint ?? 0,
        outPoint = layer.editor?.outPoint ?? c.duration,
        offset = layer.editor?.startTime ?? 0;
      const from = Math.max(start, inPoint),
        to = Math.min(end, outPoint);
      const localStart = Math.max(0, from - offset),
        localEnd = Math.max(localStart, to - offset);
      for await (const chunk of new AudioBufferSink(track).buffers(
        localStart,
        localEnd,
      )) {
        signal?.throwIfAborted();
        const clipStart = Math.max(localStart, chunk.timestamp),
          clipEnd = Math.min(localEnd, chunk.timestamp + chunk.duration);
        if (clipEnd <= clipStart) continue;
        const source = context.createBufferSource();
        source.buffer = chunk.buffer;
        source.connect(context.destination);
        source.start(
          clipStart + offset - start,
          clipStart - chunk.timestamp,
          clipEnd - clipStart,
        );
      }
    } finally {
      input.dispose();
    }
  }
  if (!tracks) return null;
  signal?.throwIfAborted();
  const buffer = await context.startRendering();
  signal?.throwIfAborted();
  return buffer;
}
