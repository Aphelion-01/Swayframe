import { decodeAudioBlob } from './audio-decode';
import { Input, ALL_FORMATS, BlobSource } from 'mediabunny';
export async function mediaMetadata(blob: Blob, mime = blob.type) {
  const input = new Input({
    source: new BlobSource(blob),
    formats: ALL_FORMATS,
  });
  try {
    const video = await input.getPrimaryVideoTrack(),
      audio = await input.getPrimaryAudioTrack();
    if (!video && !audio) throw Error('文件没有可导入的音视频轨道');
    if (!(await (video ?? audio)!.canDecode()))
      throw Error(
        '此设备不支持文件内的编码，请转换为 H.264/AAC MP4、WebM 或 PCM WAV 后导入',
      );
    const duration = await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0)
      throw Error('媒介时长无效');
    return {
      kind: video ? ('video' as const) : ('audio' as const),
      duration,
      width: video ? await video.getDisplayWidth() : 240,
      height: video ? await video.getDisplayHeight() : 60,
    };
  } catch (error) {
    if (!mime.startsWith('audio/')) throw error;
    try {
      const decoded = await decodeAudioBlob(blob);
      return {
        kind: 'audio' as const,
        duration: decoded.duration,
        width: 240,
        height: 60,
      };
    } catch (fallback) {
      throw Error(
        '音频无法解码：' +
          (fallback instanceof Error
            ? fallback.message
            : '当前设备不支持此编码'),
      );
    }
  } finally {
    input.dispose();
  }
}
