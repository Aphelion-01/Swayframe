import fs from 'node:fs/promises';
import path from 'node:path';
export const imageTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
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
  return (
    mime === 'image/webp' &&
    starts(82, 73, 70, 70) &&
    [87, 69, 66, 80].every((v, i) => bytes[i + 8] === v)
  );
}
export async function readImage(file: string) {
  const mime = imageTypes[path.extname(file).toLowerCase()];
  if (!mime) throw new Error('请选择 PNG、JPEG、WebP 或 GIF 图片');
  const handle = await fs.open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 10_000_000)
      throw new Error('图片无效或超过 10 MB');
    // Read the same open descriptor after validation; renamed paths cannot redirect this request.
    const bytes = await handle.readFile();
    if (bytes.length > 10_000_000 || !imageSignature(bytes, mime))
      throw new Error('图片内容与文件格式不一致');
    return { bytes, mime, stat };
  } finally {
    await handle.close();
  }
}
