import { expect, it, vi, afterEach } from 'vitest';
import { Canvas2DRenderer, assetImageBlob } from '../src/renderers/canvas2d';
import { newId } from '../src/core/core-types';
import type { Asset } from '../src/core/project-model';
afterEach(() => vi.unstubAllGlobals());
it('内嵌图片无需 fetch 即可解码，适用于桌面严格 CSP；位图随资源销毁', async () => {
  const fetch = vi.fn(() => {
    throw new Error('CSP 不允许 data: fetch');
  });
  vi.stubGlobal('fetch', fetch);
  const asset: Asset = {
    id: newId(),
    name: 'embedded.png',
    mimeType: 'image/png',
    dataUrl: 'data:image/png;base64,AQIDBA==',
  };
  const blob = await assetImageBlob(asset);
  expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3, 4]);
  expect(blob.type).toBe('image/png');
  const close = vi.fn(),
    decode = vi.fn(async () => ({ close }));
  vi.stubGlobal('createImageBitmap', decode);
  const renderer = new Canvas2DRenderer();
  await renderer.syncAssets([asset]);
  await renderer.syncAssets([asset]);
  expect(fetch).not.toHaveBeenCalled();
  expect(decode).toHaveBeenCalledTimes(1);
  renderer.dispose();
  expect(close).toHaveBeenCalledTimes(1);
});
