import { decodeAudioBlob } from './audio-decode';
/** Preview-only PCM proxy for containers that HTMLAudioElement cannot open. Original asset stays intact. */
export async function audioPreviewUrl(url: string, mime: string) {
  if (mime !== 'audio/aiff') return url;
  const response = await fetch(url);
  if (!response.ok) throw Error('音频素材无法读取');
  const buffer = await decodeAudioBlob(await response.blob());
  const size = buffer.length * buffer.numberOfChannels * 2;
  if (size > 256000000) throw Error('音频预览超过内存预算');
  const bytes = new ArrayBuffer(44 + size),
    v = new DataView(bytes);
  const put = (p: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(p + i, c.charCodeAt(0)));
  put(0, 'RIFF');
  v.setUint32(4, 36 + size, true);
  put(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, buffer.numberOfChannels, true);
  v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
  v.setUint16(32, buffer.numberOfChannels * 2, true);
  v.setUint16(34, 16, true);
  put(36, 'data');
  v.setUint32(40, size, true);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
    buffer.getChannelData(c),
  );
  for (let i = 0; i < buffer.length; i++)
    for (let c = 0; c < channels.length; c++)
      v.setInt16(
        44 + (i * channels.length + c) * 2,
        Math.max(-32768, Math.min(32767, Math.round(channels[c]![i]! * 32767))),
        true,
      );
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}
