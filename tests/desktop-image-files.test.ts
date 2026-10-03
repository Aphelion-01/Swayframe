import { it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  readImage,
  imageSignature,
} from '../apps/desktop/electron/image-files';
it('rejects renamed text and symlinks to non-image content', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'swayframe-images-'));
  try {
    const secret = path.join(dir, 'private.txt');
    await fs.writeFile(secret, 'not an image');
    const linked = path.join(dir, 'linked.png');
    await fs.symlink(secret, linked);
    await expect(readImage(linked)).rejects.toThrow('图片内容');
    await expect(readImage(secret)).rejects.toThrow('请选择');
    expect(
      imageSignature(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        'image/png',
      ),
    ).toBe(true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
