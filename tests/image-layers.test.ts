import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  encodeLayerPNG,
  splitVisibleLayers,
  LocalImageLayers,
} from '../apps/desktop/electron/image-layers';
import { FileGrants } from '../apps/desktop/electron/files';
import { requestSchema } from '../src/desktop/contracts';

describe('local image-to-layers: real bytes and bounded staging', () => {
  it('preserves raw subject alpha, leaves hidden background empty and records uncertain edges', () => {
    const rgb = Buffer.from([
      10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255,
    ]);
    const result = splitVisibleLayers(rgb, Buffer.from([0, 128, 255]));
    expect([...result.subject]).toEqual([
      0, 0, 0, 0, 40, 50, 60, 128, 70, 80, 90, 255,
    ]);
    expect([...result.background]).toEqual([
      10, 20, 30, 255, 40, 50, 60, 255, 0, 0, 0, 0,
    ]);
    expect([result.core, result.soft, result.empty]).toEqual([1, 1, 1]);
    expect([...result.hole.subarray(8)]).toEqual([255, 255, 255, 255]);
    expect([...result.uncertain.subarray(4, 8)]).toEqual([255, 255, 255, 255]);
    expect([...rgb]).toEqual([
      10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255,
    ]);
  });
  it('does not fabricate layers from empty/full masks, mismatched or pre-cut inputs', () => {
    expect(() =>
      splitVisibleLayers(Buffer.alloc(4), Buffer.from([128])),
    ).toThrow('opaque');
    expect(() =>
      splitVisibleLayers(Buffer.from([1, 2, 3, 255]), Buffer.from([0])),
    ).toThrow('分割');
    expect(() =>
      splitVisibleLayers(Buffer.from([1, 2, 3, 255]), Buffer.from([255])),
    ).toThrow('分割');
    expect(() => splitVisibleLayers(Buffer.alloc(3), Buffer.alloc(2))).toThrow(
      'size',
    );
  });
  it('encodes exact straight RGBA8 PNG scanline bytes with sRGB metadata and no ICC profile', () => {
    const rgba = Buffer.from([10, 20, 30, 128, 0, 0, 0, 0]),
      png = encodeLayerPNG(2, 1, rgba);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    let p = 8;
    const types: string[] = [],
      compressed: Buffer[] = [];
    while (p < png.length) {
      const n = png.readUInt32BE(p),
        type = png.toString('ascii', p + 4, p + 8);
      types.push(type);
      if (type === 'IHDR') {
        expect(png[p + 16]).toBe(8);
        expect(png[p + 17]).toBe(6);
      }
      if (type === 'IDAT') compressed.push(png.subarray(p + 8, p + 8 + n));
      p += n + 12;
    }
    expect(types).toEqual(['IHDR', 'sRGB', 'IDAT', 'IEND']);
    expect(inflateSync(Buffer.concat(compressed))).toEqual(
      Buffer.concat([Buffer.from([0]), rgba]),
    );
    expect(() => encodeLayerPNG(1025, 1, Buffer.alloc(4))).toThrow();
  });
  it('requires typed request IDs, explicit authorized input/output and rejects extra script fields', () => {
    expect(
      requestSchema.safeParse({
        method: 'imageLayers.generate',
        input: '/image.png',
        parent: '/output',
        requestId: crypto.randomUUID(),
      }).success,
    ).toBe(true);
    expect(
      requestSchema.safeParse({
        method: 'imageLayers.generate',
        input: '/image.png',
        parent: '/output',
        requestId: 'selection',
        script: 'eval',
      }).success,
    ).toBe(false);
  });
  it('reports an absent local backend without creating any output', async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'sf-segment-unit-'));
    try {
      const grants = new FileGrants();
      grants.grantWrite(temp);
      const generator = new LocalImageLayers(
        grants,
        path.join(temp, 'missing-helper'),
      );
      expect((await generator.status()).available).toBe(false);
      await expect(
        generator.generate('/not-granted.png', temp, crypto.randomUUID()),
      ).rejects.toThrow();
      expect(await fs.readdir(temp)).toEqual([]);
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });
});
