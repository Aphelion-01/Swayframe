import { protocol } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { ImportedAsset } from '../../../src/desktop/contracts';
import type { FileGrants } from './files';
import { imageTypes, readImage } from './image-files';
export class NativeAssets {
  readonly resources = new Map<string, string>();
  constructor(readonly grants: FileGrants) {}
  register(file: string): string {
    if (!imageTypes[path.extname(file).toLowerCase()])
      throw new Error('Invalid image path');
    const token = createHash('sha256').update(file).digest('hex');
    this.resources.set(token, file);
    return `swayframe-asset://local/${token}`;
  }
  async exists(file: string) {
    try {
      return (await fs.stat(file)).isFile();
    } catch {
      return false;
    }
  }
  async import(file: string): Promise<ImportedAsset> {
    file = this.grants.requireRead(file);
    const { stat, mime: mimeType } = await readImage(file);
    return {
      path: file,
      name: path.basename(file),
      mimeType,
      url: this.register(file),
      metadata: {
        width: 0,
        height: 0,
        size: stat.size,
        modifiedAt: stat.mtimeMs,
      },
    };
  }
  installProtocol() {
    protocol.handle('swayframe-asset', async (request) => {
      const url = new URL(request.url);
      const file =
        url.hostname === 'local'
          ? this.resources.get(url.pathname.slice(1))
          : undefined;
      if (!file) return new Response('Not found', { status: 404 });
      try {
        const { bytes, mime } = await readImage(file);
        return new Response(new Uint8Array(bytes), {
          headers: { 'Content-Type': mime },
        });
      } catch {
        return new Response('Missing media', { status: 404 });
      }
    });
  }
}
