import { afterEach, expect, it, vi } from 'vitest';
import { Canvas2DRenderer } from '../src/renderers/canvas2d';
import { newId } from '../src/core/core-types';

afterEach(() => vi.unstubAllGlobals());
it('移除资源或卸载时，尚未解码完成的图片不会遗留缓存', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, blob: async () => new Blob() })),
  );
  let finish!: (value: ImageBitmap) => void;
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(
      () =>
        new Promise<ImageBitmap>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const renderer = new Canvas2DRenderer();
  const loading = renderer.syncAssets([
    {
      id: newId(),
      name: 'image',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AA==',
    },
  ]);
  await vi.waitFor(() => expect(finish).toBeDefined());
  await renderer.syncAssets([]);
  renderer.dispose();
  const close = vi.fn();
  finish({ close } as unknown as ImageBitmap);
  await loading;
  expect(close).toHaveBeenCalledTimes(1);
  renderer.dispose();
  expect(close).toHaveBeenCalledTimes(1);
});
