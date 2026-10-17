import fs from 'node:fs/promises';
import { constants, type Stats } from 'node:fs';
import { inflateSync, crc32 } from 'node:zlib';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { nativeImage } from 'electron';
import {
  layerPackLimits as limits,
  LayerPackError,
  parseLayerPackManifest,
  type PreparedLayerPack,
} from '../../../src/importers/layerpack-manifest';
import { imageSignature } from './image-files';
/** Validate resource and color metadata before native decoding can allocate pixels. */
export function validateLayerPackPNG(bytes: Buffer) {
  if (!imageSignature(bytes, 'image/png'))
    throw new LayerPackError('PNG 签名无效');
  let width = 0,
    height = 0,
    offset = 8,
    ended = false,
    data = false,
    afterData = false;
  const seen = new Set<string>();
  const compressed: Buffer[] = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new LayerPackError('PNG 文件损坏');
    const size = bytes.readUInt32BE(offset),
      end = offset + 12 + size;
    if (end > bytes.length) throw new LayerPackError('PNG chunk 长度无效');
    const type = bytes.toString('ascii', offset + 4, offset + 8),
      payload = bytes.subarray(offset + 8, end - 4);
    if (
      crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)
    )
      throw new LayerPackError('PNG 校验失败');
    if (
      !['IHDR', 'IDAT', 'IEND', 'sRGB', 'gAMA', 'cHRM', 'pHYs'].includes(type)
    )
      throw new LayerPackError(
        `不支持 PNG 元数据 ${type}，请转换为非隔行 8-bit sRGB RGBA PNG`,
      );
    if (offset === 8 && type !== 'IHDR')
      throw new LayerPackError('PNG 缺少 IHDR');
    if (type !== 'IDAT' && seen.has(type))
      throw new LayerPackError('PNG chunk 重复');
    if (type === 'IHDR') {
      if (size !== 13) throw new LayerPackError('PNG IHDR 无效');
      width = payload.readUInt32BE(0);
      height = payload.readUInt32BE(4);
      if (
        !width ||
        !height ||
        width > 8192 ||
        height > 8192 ||
        width * height > limits.imagePixels
      )
        throw new LayerPackError('PNG 像素数超限');
      if (
        payload[8] !== 8 ||
        payload[9] !== 6 ||
        payload[10] !== 0 ||
        payload[11] !== 0 ||
        payload[12] !== 0
      )
        throw new LayerPackError('仅支持非隔行 8-bit RGBA PNG');
    }
    if (['sRGB', 'gAMA', 'cHRM'].includes(type) && data)
      throw new LayerPackError('PNG 颜色元数据顺序无效');
    if (type === 'sRGB' && (size !== 1 || payload[0]! > 3))
      throw new LayerPackError('sRGB 标记无效');
    if (type === 'gAMA' && (size !== 4 || payload.readUInt32BE(0) !== 45455))
      throw new LayerPackError('只支持 sRGB gamma');
    if (
      type === 'cHRM' &&
      (size !== 32 ||
        [31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000].some(
          (v, i) => payload.readUInt32BE(i * 4) !== v,
        ))
    )
      throw new LayerPackError('只支持 sRGB 色度');
    if (type === 'pHYs' && (size !== 9 || payload[8]! > 1))
      throw new LayerPackError('PNG pHYs 无效');
    if (type === 'IDAT') {
      if (afterData) throw new LayerPackError('PNG IDAT 顺序无效');
      data = true;
      compressed.push(payload);
    } else if (data) afterData = true;
    seen.add(type);
    offset = end;
    if (type === 'IEND') {
      if (size || !data || offset !== bytes.length)
        throw new LayerPackError('PNG 结束无效');
      ended = true;
      break;
    }
  }
  if (!ended) throw new LayerPackError('PNG 不完整');
  try {
    const packed = Buffer.concat(compressed);
    const expected = height * (width * 4 + 1);
    // Node's info option returns the engine as well as the bounded output.
    const decoded = inflateSync(packed, {
      maxOutputLength: expected + 1,
      info: true,
    }) as unknown as { buffer: Buffer; engine: { bytesWritten: number } };
    if (
      decoded.buffer.length !== expected ||
      decoded.engine.bytesWritten !== packed.length
    )
      throw new Error('PNG scanline length');
    for (let row = 0; row < height; row++)
      if (decoded.buffer[row * (width * 4 + 1)]! > 4)
        throw new Error('PNG filter');
  } catch {
    throw new LayerPackError('PNG 像素数据损坏或大小超限');
  }
  const image = nativeImage.createFromBuffer(bytes);
  if (
    image.isEmpty() ||
    image.getSize().width !== width ||
    image.getSize().height !== height
  )
    throw new LayerPackError('PNG 无法解码');
  return { width, height };
}
/** Read-only disk stage. No copies, user files, permission grants or physical assets are written. */
export async function readLayerPack(
  directory: string,
  signal?: AbortSignal,
): Promise<PreparedLayerPack> {
  const check = () => signal?.throwIfAborted();
  check();
  const root = await fs.realpath(directory);
  if (!(await fs.stat(root)).isDirectory())
    throw new LayerPackError('请选择包目录');
  const entries = new Map<string, Stats>();
  let total = 0,
    count = 0;
  async function scan(dir: string, relative: string, depth: number) {
    check();
    if (depth > limits.depth) throw new LayerPackError('目录层数超限');
    const iterator = await fs.opendir(dir);
    for await (const entry of iterator) {
      check();
      if (++count > limits.files + limits.depth)
        throw new LayerPackError('文件数量超限');
      const file = path.join(dir, entry.name),
        key = relative ? `${relative}/${entry.name}` : entry.name;
      const stat = await fs.lstat(file);
      if (stat.isSymbolicLink()) throw new LayerPackError('不支持符号链接');
      const resolved = await fs.realpath(file);
      if (
        path.relative(root, resolved).startsWith('..') ||
        path.isAbsolute(path.relative(root, resolved))
      )
        throw new LayerPackError('路径逃逸');
      if (stat.isDirectory()) {
        await scan(file, key, depth + 1);
        continue;
      }
      if (!stat.isFile()) throw new LayerPackError('不支持特殊文件');
      if (
        stat.size >
        (key === 'manifest.json' ? limits.manifestBytes : limits.fileBytes)
      )
        throw new LayerPackError('单文件大小超限');
      total += stat.size;
      if (total > limits.totalBytes || entries.size >= limits.files)
        throw new LayerPackError('包总大小或文件数量超限');
      entries.set(key, stat);
    }
  }
  await scan(root, '', 0);
  async function read(key: string) {
    check();
    const approved = entries.get(key);
    if (!approved) throw new LayerPackError(`文件不存在：${key}`);
    const file = path.join(root, key),
      resolved = await fs.realpath(file);
    if (
      path.relative(root, resolved).startsWith('..') ||
      path.isAbsolute(path.relative(root, resolved))
    )
      throw new LayerPackError('路径逃逸');
    // Reject changed parent links and use the same bounded descriptor after ownership checks.
    const pieces = key.split('/');
    let cursor = root;
    for (const piece of pieces) {
      cursor = path.join(cursor, piece);
      if ((await fs.lstat(cursor)).isSymbolicLink())
        throw new LayerPackError('不支持符号链接');
    }
    const handle = await fs.open(
      file,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
    try {
      const stat = await handle.stat();
      if (
        !stat.isFile() ||
        stat.dev !== approved.dev ||
        stat.ino !== approved.ino ||
        stat.size !== approved.size ||
        stat.mtimeMs !== approved.mtimeMs
      )
        throw new LayerPackError('文件在读取期间发生更改');
      const bytes = Buffer.alloc(stat.size + 1);
      let offset = 0;
      while (offset < bytes.length) {
        check();
        const r = await handle.read(
          bytes,
          offset,
          bytes.length - offset,
          offset,
        );
        if (!r.bytesRead) break;
        offset += r.bytesRead;
      }
      if (offset !== stat.size)
        throw new LayerPackError('文件在读取期间大小改变');
      check();
      return bytes.subarray(0, offset);
    } finally {
      await handle.close();
    }
  }
  let raw: unknown;
  try {
    raw = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        await read('manifest.json'),
      ),
    );
  } catch (error) {
    if (error instanceof LayerPackError) throw error;
    throw new LayerPackError('manifest.json 语法错误');
  }
  const manifest = parseLayerPackManifest(raw),
    assets = [...new Set(manifest.layers.map((l) => l.asset))];
  const allowed = new Set(['manifest.json', 'reference.png', ...assets]);
  if ([...entries.keys()].some((key) => !allowed.has(key)))
    throw new LayerPackError('包包含未声明的文件');
  const images: PreparedLayerPack['images'] = [];
  for (const asset of assets) {
    const bytes = await read(asset),
      size = validateLayerPackPNG(bytes);
    if (
      manifest.layers.some(
        (l) =>
          l.asset === asset &&
          (l.bounds.width !== size.width || l.bounds.height !== size.height),
      )
    )
      throw new LayerPackError(`图片尺寸与 bounds 不符：${asset}`);
    check();
    images.push({
      asset,
      ...size,
      dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  if (entries.has('reference.png')) {
    const size = validateLayerPackPNG(await read('reference.png'));
    if (
      size.width !== manifest.canvas.width ||
      size.height !== manifest.canvas.height
    )
      throw new LayerPackError('参考图尺寸与画布不符');
  }
  check();
  return { manifest, images };
}
