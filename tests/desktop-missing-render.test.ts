import { it, expect, vi } from 'vitest';
import { Canvas2DRenderer } from '../src/renderers/canvas2d';
import type { Asset } from '../src/core/project-model';
it('missing linked media preserves other images and relink retries without failing the frame', async () => {
  const renderer = new Canvas2DRenderer();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValue({ ok: true, blob: async () => new Blob() });
  vi.stubGlobal('fetch', fetcher);
  const decode = vi.fn(async () => ({ close: () => {} }));
  vi.stubGlobal('createImageBitmap', decode);
  const asset = {
    id: 'missing',
    name: 'image',
    mimeType: 'image/png',
    dataUrl: 'swayframe-asset://local/missing',
    source: {
      kind: 'linked',
      path: '/tmp/missing.png',
      metadata: { width: 1, height: 1, size: 1, modifiedAt: 1 },
    },
  } as Asset;
  const good = {
    id: 'good',
    name: 'good',
    mimeType: 'image/png',
    dataUrl: 'data:image/png;base64,AQIDBA==',
  } as Asset;
  try {
    await expect(renderer.syncAssets([asset, good])).resolves.toBeUndefined();
    await renderer.syncAssets([asset, good]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledTimes(1);
    await renderer.syncAssets([
      { ...asset, dataUrl: 'swayframe-asset://local/relinked' },
      good,
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith(
      'swayframe-asset://local/relinked',
    );
    expect(decode).toHaveBeenCalledTimes(2);
  } finally {
    renderer.dispose();
    vi.unstubAllGlobals();
  }
});
