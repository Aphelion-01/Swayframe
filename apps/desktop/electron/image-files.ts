import { mediaTypes } from '../../../src/shared/media-formats';
import fs from 'node:fs/promises';
import path from 'node:path';
export const imageTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  ...Object.fromEntries(
    Object.entries(mediaTypes).map(([ext, mime]) => ['.' + ext, mime]),
  ),
};
export function imageSignature(bytes: Uint8Array, mime: string): boolean {
  const starts = (...values: number[]) =>
    values.every((v, i) => bytes[i] === v);
  if (mime === 'image/png') return starts(137, 80, 78, 71, 13, 10, 26, 10);
  if (mime === 'image/jpeg') return starts(255, 216, 255);
  if (mime === 'image/gif')
    return (
      starts(71, 73, 70, 56) &&
      (bytes[4] === 55 || bytes[4] === 57) &&
      bytes[5] === 97
    );
  if (mime === 'image/bmp') return starts(66, 77);
  if (mime === 'image/avif')
    return (
      bytes.length > 16 &&
      new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp' &&
      new TextDecoder().decode(bytes.slice(8, 32)).includes('avif')
    );
  if (mime.startsWith('audio/') || mime.startsWith('video/'))
    return bytes.length > 8; // Track parsing and codec validation are performed before asset.add.
  return (
    mime === 'image/webp' &&
    starts(82, 73, 70, 70) &&
    [87, 69, 66, 80].every((v, i) => bytes[i + 8] === v)
  );
}
export async function readImage(file: string) {
  const mime = imageTypes[path.extname(file).toLowerCase()];
  if (!mime) throw new Error('请选择 PNG、JPEG、WebP 或 GIF 图片');
  const limit = mime.startsWith('image/') ? 10_000_000 : 256_000_000;
  const handle = await fs.open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit)
      throw new Error('媒介无效或超过大小限制（图片 10 MB，音视频 256 MB）');
    // Read the same open descriptor after validation; renamed paths cannot redirect this request.
    const bytes = await handle.readFile();
    if (bytes.length > limit || !imageSignature(bytes, mime))
      throw new Error('图片内容与文件格式不一致');
    return { bytes, mime, stat };
  } finally {
    await handle.close();
  }
}
