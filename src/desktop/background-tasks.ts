import type { ZipEntry } from '../core/zip-archive';
import { zipArchive } from '../core/zip-archive';
export interface BackgroundTaskService {
  archive(
    entries: ZipEntry[],
    signal?: AbortSignal,
  ): Promise<Uint8Array<ArrayBuffer>>;
}
export class BrowserBackgroundTasks implements BackgroundTaskService {
  async archive(
    entries: ZipEntry[],
    signal?: AbortSignal,
  ): Promise<Uint8Array<ArrayBuffer>> {
    // Node unit tests do not have browser Workers. Production browsers use the worker below.
    if (typeof Worker === 'undefined') return zipArchive(entries);
    const worker = new Worker(new URL('./zip.worker.ts', import.meta.url), {
      type: 'module',
    });
    return new Promise((resolve, reject) => {
      const stop = () => {
        worker.terminate();
        signal?.removeEventListener('abort', abort);
      };
      const abort = () => {
        stop();
        reject(new Error('导出已取消'));
      };
      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener('abort', abort, { once: true });
      worker.onmessage = (
        event: MessageEvent<{
          bytes?: Uint8Array<ArrayBuffer>;
          error?: string;
        }>,
      ) => {
        stop();
        if (event.data.bytes) resolve(event.data.bytes);
        else reject(new Error(event.data.error ?? '归档失败'));
      };
      worker.onerror = () => {
        stop();
        reject(new Error('后台归档失败'));
      };
      worker.postMessage(
        entries,
        entries.map((e) => e.data.buffer as ArrayBuffer),
      );
    });
  }
}
export interface MediaService {
  readonly capabilities: readonly string[];
}
export interface NativeCore {
  readonly available: boolean;
  readonly media: MediaService;
}
export class NativeCoreAdapter implements NativeCore {
  readonly available = false;
  readonly media: MediaService = { capabilities: [] };
}
export const backgroundTasks = new BrowserBackgroundTasks();
