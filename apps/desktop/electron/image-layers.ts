import type { GeneratedLayerPackage } from '../../../src/desktop/contracts';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { constants } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { z } from 'zod';
import {
  parseLayerPackManifest,
  layerPackLimits,
} from '../../../src/importers/layerpack-manifest';
import type { FileGrants } from './files';
export class ImageLayersError extends Error {}
export const localSegmentationWarning =
  '本地分层原型：Background 的主体内部保留透明缺口，未推测或修补隐藏背景。柔边仍含原背景颜色，移动后可能留有残边；发丝、胡须、透明物体请人工检查。';
const responseSchema = z
  .object({
    width: z.number().int().min(1).max(1024),
    height: z.number().int().min(1).max(1024),
    originalWidth: z.number().int(),
    originalHeight: z.number().int(),
    rgba: z.string().max(6_000_000),
    alpha: z.string().max(1_500_000),
    instances: z.number().int().min(1),
    revision: z.number().int(),
    seconds: z.number().nonnegative(),
  })
  .strict();
function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, bytes: Buffer) {
  const name = Buffer.from(type),
    size = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  size.writeUInt32BE(bytes.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([size, name, bytes, crc]);
}
/** Byte encoder only, no alternate Scene/Renderer. Always PNG RGBA8, straight sRGB. */
export function encodeLayerPNG(
  width: number,
  height: number,
  rgba: Uint8Array,
) {
  if (
    width < 1 ||
    height < 1 ||
    width > 1024 ||
    height > 1024 ||
    rgba.length !== width * height * 4
  )
    throw Error('PNG dimensions exceed prototype limits');
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      rows,
      y * (width * 4 + 1) + 1,
    );
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('sRGB', Buffer.from([0])),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
export function splitVisibleLayers(rgba: Buffer, alpha: Buffer) {
  if (rgba.length !== alpha.length * 4 || !alpha.length)
    throw Error('Model payload size mismatch');
  const background = Buffer.from(rgba),
    subject = Buffer.from(rgba),
    hole = Buffer.alloc(rgba.length),
    uncertain = Buffer.alloc(rgba.length);
  let core = 0,
    soft = 0,
    empty = 0;
  for (let p = 0; p < alpha.length; p++) {
    const a = alpha[p]!,
      i = p * 4;
    if (rgba[i + 3] !== 255) throw Error('Input must be opaque');
    subject[i + 3] = a;
    if (a === 0) {
      subject.fill(0, i, i + 4);
      empty++;
    }
    if (a === 255) {
      background.fill(0, i, i + 4);
      hole.fill(255, i, i + 4);
      core++;
    }
    if (a > 0 && a < 255) {
      uncertain.fill(255, i, i + 4);
      soft++;
    }
  }
  if (core === 0 || empty === 0)
    throw Error('分割未产生有效的主体内部和背景区域，请换一张边界清晰的照片。');
  return { background, subject, hole, uncertain, core, soft, empty };
}
export class LocalImageLayers {
  private job?: { id: string; controller: AbortController };
  constructor(
    private grants: FileGrants,
    private helper: string,
  ) {}
  async status() {
    if (
      process.platform !== 'darwin' ||
      process.arch !== 'arm64' ||
      Number(os.release().split('.')[0]) < 23
    )
      return {
        available: false,
        reason:
          '本地图片分层仅支持 Apple Silicon Mac / macOS 14+。此平台仍可导入已有分层包。',
      };
    try {
      await fs.access(this.helper, constants.X_OK);
      return {
        available: true,
        reason:
          'Apple Vision 本机分割，无图片外发；最长边1024像素，不补全遮挡背景。',
      };
    } catch {
      return {
        available: false,
        reason: '未安装本地分割组件，请重新安装 Mac 版本。',
      };
    }
  }
  cancel(id?: string) {
    if (!id || this.job?.id === id) this.job?.controller.abort();
  }
  async generate(
    input: string,
    parent: string,
    id: string,
  ): Promise<GeneratedLayerPackage> {
    if (this.job) throw Error('已有图片分层任务，请先取消或等待完成。');
    const controller = new AbortController();
    this.job = { id, controller };
    const signal = controller.signal;
    let staging: string | undefined;
    try {
      const availability = await this.status();
      if (!availability.available) throw Error(availability.reason);
      const source = this.grants.requireRead(input),
        destination = this.grants.requireWrite(parent);
      const [stat, parentStat] = await Promise.all([
        fs.lstat(source),
        fs.lstat(destination),
      ]);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.size > 12_000_000 ||
        !parentStat.isDirectory() ||
        parentStat.isSymbolicLink()
      )
        throw Error('请选择12 MB以内的本地照片与普通输出文件夹。');
      const actualParent = await fs.realpath(destination);
      signal.throwIfAborted();
      const handle = await fs.open(
        source,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
      );
      let sourceBytes: Buffer;
      try {
        const before = await handle.stat();
        if (before.size > 12_000_000 || !before.isFile())
          throw Error('Input file limit');
        const buffer = Buffer.alloc(before.size + 1);
        let bytesRead = 0;
        while (bytesRead < buffer.length) {
          const read = await handle.read(
            buffer,
            bytesRead,
            buffer.length - bytesRead,
            bytesRead,
          );
          if (!read.bytesRead) break;
          bytesRead += read.bytesRead;
        }
        const after = await handle.stat();
        if (
          bytesRead !== before.size ||
          before.size !== after.size ||
          before.mtimeMs !== after.mtimeMs
        )
          throw Error('图片读取期间发生变化，请重试。');
        sourceBytes = buffer.subarray(0, bytesRead);
      } finally {
        await handle.close();
      }
      const extension = sourceBytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? 'png'
        : sourceBytes[0] === 255 && sourceBytes[1] === 216
          ? 'jpg'
          : null;
      if (!extension) throw Error('仅支持不透明 PNG / JPEG 照片。');
      signal.throwIfAborted();
      staging = await fs.mkdtemp(path.join(actualParent, '.sf-image-layers-'));
      await fs.mkdir(path.join(staging, 'analysis'));
      const snapshot = path.join(staging, 'analysis', 'source.' + extension);
      await fs.writeFile(snapshot, sourceBytes, { flag: 'wx' });
      const stdout = await new Promise<string>((resolve, reject) =>
        execFile(
          this.helper,
          [snapshot],
          { maxBuffer: 12_000_000, timeout: 60_000, signal },
          (error, out, stderr) =>
            error
              ? reject(
                  new Error(
                    signal.aborted
                      ? '图片分层已取消。'
                      : stderr.trim().slice(0, 600) || '本机分割失败。',
                  ),
                )
              : resolve(out),
        ),
      );
      signal.throwIfAborted();
      const r = responseSchema.parse(JSON.parse(stdout));
      const rgba = Buffer.from(r.rgba, 'base64'),
        alpha = Buffer.from(r.alpha, 'base64');
      if (
        alpha.length !== r.width * r.height ||
        rgba.length !== r.width * r.height * 4
      )
        throw Error('分割组件返回尺寸不匹配。');
      const split = splitVisibleLayers(rgba, alpha),
        png = (b: Buffer) => encodeLayerPNG(r.width, r.height, b);
      const full = { x: 0, y: 0, width: r.width, height: r.height };
      const manifest = parseLayerPackManifest({
        format: 'swayframe.layerpack',
        version: 1,
        colorSpace: 'srgb',
        alphaMode: 'straight',
        order: 'bottom-to-top',
        canvas: { width: r.width, height: r.height },
        layers: [
          {
            id: 'background',
            name: 'Background（遮挡区域未补全）',
            type: 'raster',
            asset: 'layers/background.png',
            bounds: full,
            opacity: 1,
          },
          {
            id: 'main-subject',
            name: 'Main Subject',
            type: 'raster',
            asset: 'layers/main-subject.png',
            bounds: full,
            opacity: 1,
          },
        ],
      });
      const maskRGBA = Buffer.alloc(rgba.length);
      for (let p = 0; p < alpha.length; p++) {
        maskRGBA.fill(alpha[p]!, p * 4, p * 4 + 3);
        maskRGBA[p * 4 + 3] = 255;
      }
      const files = new Map([
        ['composition/reference.png', png(rgba)],
        ['composition/layers/background.png', png(split.background)],
        ['composition/layers/main-subject.png', png(split.subject)],
        [
          'composition/manifest.json',
          Buffer.from(JSON.stringify(manifest, null, 2)),
        ],
        ['analysis/model-alpha.png', png(maskRGBA)],
        ['analysis/unfilled-background-region.png', png(split.hole)],
        ['analysis/uncertain-edges.png', png(split.uncertain)],
      ]);
      const packageFiles = [...files].filter(([n]) =>
        n.startsWith('composition/'),
      );
      if (
        packageFiles.some(
          ([n, b]) =>
            n.endsWith('.png') && b.length > layerPackLimits.fileBytes,
        ) ||
        packageFiles.reduce((n, [, b]) => n + b.length, 0) >
          layerPackLimits.totalBytes
      )
        throw Error('生成的分层包超过原导入器容量限制。');
      const provenance = {
        backend: 'Apple Vision VNGenerateForegroundInstanceMaskRequest',
        revision: r.revision,
        instances: r.instances,
        seconds: r.seconds,
        width: r.width,
        height: r.height,
        originalWidth: r.originalWidth,
        originalHeight: r.originalHeight,
        sourceHash: createHash('sha256').update(sourceBytes).digest('hex'),
        warning: localSegmentationWarning,
        inpainting: false,
        generatedHiddenPixels: 0,
        unfilledPixels: split.core,
        uncertainPixels: split.soft,
        backgroundPolicy:
          'transparent only at alpha=255; retain original mixed pixels in uncertain edge',
        subjectPolicy:
          'original RGB and raw quantized model alpha; no RGB decontamination',
        optionalForeground:
          'not inferred; detected instances grouped as one Main Subject',
      };
      files.set(
        'analysis/provenance.json',
        Buffer.from(JSON.stringify(provenance, null, 2)),
      );
      signal.throwIfAborted();
      for (const [name, bytes] of files) {
        signal.throwIfAborted();
        const file = path.join(staging, name);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, bytes, { flag: 'wx' });
      }
      signal.throwIfAborted();
      const final = path.join(actualParent, 'SF-Layers-' + randomUUID());
      await fs.rename(staging, final);
      staging = undefined;
      const directory = this.grants.grantRead(path.join(final, 'composition'));
      return {
        directory,
        analysisDirectory: path.join(final, 'analysis'),
        warning: localSegmentationWarning,
        width: r.width,
        height: r.height,
        instances: r.instances,
      };
    } finally {
      if (staging) await fs.rm(staging, { recursive: true, force: true });
      if (this.job?.id === id) this.job = undefined;
    }
  }
}
