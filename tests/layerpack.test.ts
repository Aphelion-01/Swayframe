import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { crc32, deflateSync } from 'node:zlib';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  parseLayerPackManifest,
  safeLayerPackPath,
} from '../src/importers/layerpack-manifest';
import {
  readLayerPack,
  validateLayerPackPNG,
} from '../apps/desktop/electron/layerpack';
const decode = vi.hoisted(() =>
  vi.fn((bytes: Buffer) => ({
    isEmpty: () => false,
    getSize: () => ({
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    }),
  })),
);
// Unit-only decoder stub; actual native decoder and rendering are tested in Electron QA.
vi.mock('electron', () => ({ nativeImage: { createFromBuffer: decode } }));
type FixtureManifest = {
  [key: string]: unknown;
  canvas: { width: number; height: number };
  layers: {
    id: string;
    name: string;
    type: string;
    asset: string;
    opacity: number;
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation?: number;
    };
  }[];
};
let root: string;
const source = 'docs/qa/ai2comp/packages/B';
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'sf-layerpack-'));
  await fs.cp(source, root, { recursive: true });
  decode.mockClear();
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});
const manifest = async () =>
  JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
const save = (m: unknown) =>
  fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify(m));
it('maps minimal v1 defaults and retains explicit bottom-to-top order', async () => {
  const m = await manifest();
  delete m.colorSpace;
  delete m.alphaMode;
  delete m.order;
  const parsed = parseLayerPackManifest(m);
  expect(parsed.colorSpace).toBe('srgb');
  expect(parsed.alphaMode).toBe('straight');
  expect(parsed.layers.map((l) => l.id)).toEqual([
    'background',
    'subject',
    'foreground',
  ]);
  const prepared = await readLayerPack(root);
  expect(prepared.images).toHaveLength(3);
  expect(
    prepared.images.every((i) =>
      i.dataUrl.startsWith('data:image/png;base64,'),
    ),
  ).toBe(true);
});
it.each([
  ['version', 2],
  ['format', 'other'],
  ['script', 'alert(1)'],
  ['colorSpace', 'display-p3'],
  ['alphaMode', 'premultiplied'],
  ['order', 'top-to-bottom'],
])('rejects unsupported manifest %s', async (key, value) => {
  const m = await manifest();
  m[key] = value;
  expect(() => parseLayerPackManifest(m)).toThrow();
});
it.each([
  '../outside.png',
  'layers/../outside.png',
  '/tmp/a.png',
  'C:/a.png',
  '\\server\\a.png',
  'https://x/a.png',
  '//host/a.png',
  'layers/%2e%2e/a.png',
  'layers/a.jpg',
  'layers/a.png?x=1',
])('rejects unsafe asset path %s', async (asset) => {
  const m = await manifest();
  m.layers[0]!.asset = asset;
  await save(m);
  await expect(readLayerPack(root)).rejects.toThrow();
  expect(decode).not.toHaveBeenCalled();
});
it('rejects duplicate IDs, empty layers, too many layers, bad dimensions, opacity and unknown fields', async () => {
  const original = await manifest();
  for (const patch of [
    (m: FixtureManifest) => (m.layers[1]!.id = m.layers[0]!.id),
    (m: FixtureManifest) => (m.layers = []),
    (m: FixtureManifest) =>
      (m.layers = Array.from({ length: 33 }, (_, n) => ({
        ...m.layers[0]!,
        id: `layer${n}`,
      }))),
    (m: FixtureManifest) => (m.canvas.width = 0),
    (m: FixtureManifest) => (m.layers[0]!.bounds.x = -1),
    (m: FixtureManifest) => (m.layers[0]!.bounds.x = 100),
    (m: FixtureManifest) => (m.layers[0]!.bounds.rotation = 15),
    (m: FixtureManifest) => (m.layers[0]!.opacity = 1.1),
  ]) {
    const m = structuredClone(original);
    patch(m);
    expect(() => parseLayerPackManifest(m)).toThrow();
  }
});
it('rejects per-image, canvas and total pixel limits', async () => {
  const original = await manifest();
  const m = structuredClone(original);
  m.canvas = { width: 8192, height: 8192 };
  expect(() => parseLayerPackManifest(m)).toThrow();
  m.canvas = { width: 4096, height: 4096 };
  m.layers[0]!.bounds = { x: 0, y: 0, width: 4096, height: 4096 };
  expect(() => parseLayerPackManifest(m)).toThrow();
  m.layers = Array.from({ length: 4 }, (_, n) => ({
    ...original.layers[0]!,
    id: `layer${n}`,
    bounds: { x: 0, y: 0, width: 4096, height: 2048 },
  }));
  expect(() => parseLayerPackManifest(m)).toThrow();
});
it('rejects wrong actual dimensions before committing anything', async () => {
  const m = await manifest();
  m.layers[1]!.bounds.width--;
  await save(m);
  await expect(readLayerPack(root)).rejects.toThrow('bounds');
});
it('rejects missing asset and undeclared script file', async () => {
  await fs.rm(path.join(root, 'layers/subject.png'));
  await expect(readLayerPack(root)).rejects.toThrow('不存在');
  await fs.writeFile(
    path.join(root, 'danger.js'),
    'throw Error("must never execute")',
  );
  await expect(readLayerPack(root)).rejects.toThrow('未声明');
});
it('rejects symlink file and directory escapes', async () => {
  const external = await fs.mkdtemp(path.join(os.tmpdir(), 'sf-outside-'));
  try {
    await fs.writeFile(path.join(external, 'outside.png'), 'not read');
    await fs.rm(path.join(root, 'layers/subject.png'));
    await fs.symlink(
      path.join(external, 'outside.png'),
      path.join(root, 'layers/subject.png'),
    );
    await expect(readLayerPack(root)).rejects.toThrow('符号链接');
    await fs.rm(path.join(root, 'layers'), { recursive: true });
    await fs.symlink(external, path.join(root, 'layers'));
    await expect(readLayerPack(root)).rejects.toThrow('符号链接');
    expect(decode).not.toHaveBeenCalled();
  } finally {
    await fs.rm(external, { recursive: true, force: true });
  }
});
it('rejects manifest bytes, single file and aggregate bytes without reading PNGs', async () => {
  await fs.writeFile(path.join(root, 'manifest.json'), ' '.repeat(128001));
  await expect(readLayerPack(root)).rejects.toThrow('大小');
  await fs.cp(source, root, { recursive: true });
  await fs.truncate(path.join(root, 'layers/subject.png'), 8000001);
  await expect(readLayerPack(root)).rejects.toThrow('大小');
  await fs.truncate(path.join(root, 'layers/subject.png'), 4000000);
  await fs.truncate(path.join(root, 'layers/background.png'), 4000000);
  await fs.truncate(path.join(root, 'layers/foreground.png'), 4000000);
  await expect(readLayerPack(root)).rejects.toThrow('总大小');
  expect(decode).not.toHaveBeenCalled();
});
it('rejects malformed JSON and cancelled reads', async () => {
  await fs.writeFile(path.join(root, 'manifest.json'), '{broken');
  await expect(readLayerPack(root)).rejects.toThrow('语法');
  const c = new AbortController();
  c.abort();
  await expect(readLayerPack(root, c.signal)).rejects.toThrow();
  expect(decode).not.toHaveBeenCalled();
});
it('rejects damaged CRC and giant IHDR before decoding', async () => {
  const b = await fs.readFile(path.join(root, 'layers/subject.png'));
  const damaged = Buffer.from(b);
  damaged[damaged.length - 1] = damaged[damaged.length - 1]! ^ 1;
  expect(() => validateLayerPackPNG(damaged)).toThrow('校验');
  const huge = Buffer.from(b);
  huge.writeUInt32BE(8192, 16);
  huge.writeUInt32BE(8192, 20);
  huge.writeUInt32BE(crc32(huge.subarray(12, 29)), 29);
  expect(() => validateLayerPackPNG(huge)).toThrow('像素');
  expect(decode).not.toHaveBeenCalled();
});
it('rejects a small header with decompression bomb before native decoding', async () => {
  const b = await fs.readFile(path.join(root, 'layers/subject.png'));
  const ihdr = Buffer.from(b.subarray(8, 33));
  ihdr.writeUInt32BE(1, 8);
  ihdr.writeUInt32BE(1, 12);
  ihdr.writeUInt32BE(crc32(ihdr.subarray(4, 21)), 21);
  const compressed = deflateSync(Buffer.alloc(1000000));
  const idat = Buffer.alloc(compressed.length + 12);
  idat.writeUInt32BE(compressed.length);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  idat.writeUInt32BE(crc32(idat.subarray(4, -4)), idat.length - 4);
  const bomb = Buffer.concat([b.subarray(0, 8), ihdr, idat, b.subarray(-12)]);
  expect(() => validateLayerPackPNG(bomb)).toThrow('像素数据');
  expect(decode).not.toHaveBeenCalled();
});
it('path validator refuses empty and control traversal forms', () => {
  expect(safeLayerPackPath('')).toBe(false);
  expect(safeLayerPackPath('layers//a.png')).toBe(false);
  expect(safeLayerPackPath('layers/a.png\0')).toBe(false);
});
