import { decodeAiffPcm } from './aiff-pcm';
/** Web Audio has decoders (including FLAC) that WebCodecs may not expose. */
export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  if (blob.size > 256_000_000) throw Error('音频超过 256 MB 解码预算');
  if (typeof AudioContext === 'undefined')
    throw Error('当前环境没有可用音频解码器');
  const context = new AudioContext();
  try {
    const bytes = await blob.arrayBuffer();
    const aiff =
      bytes.byteLength >= 12 &&
      new TextDecoder().decode(new Uint8Array(bytes, 0, 4)) === 'FORM';
    const buffer = aiff
      ? decodeAiffPcm(bytes, context)
      : await context.decodeAudioData(bytes);
    if (
      !buffer.length ||
      !Number.isFinite(buffer.duration) ||
      buffer.duration <= 0
    )
      throw Error('音频时长无效');
    if (buffer.length * buffer.numberOfChannels * 4 > 256_000_000)
      throw Error('解码音频超过 256 MB 内存预算');
    return buffer;
  } finally {
    await context.close();
  }
}
