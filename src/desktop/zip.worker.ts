import { zipArchive } from '../core/zip-archive';
import type { ZipEntry } from '../core/zip-archive';
const scope = self as unknown as {
  onmessage: (event: MessageEvent<ZipEntry[]>) => void;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};
scope.onmessage = (event) => {
  try {
    const bytes = zipArchive(event.data);
    scope.postMessage({ bytes }, [bytes.buffer]);
  } catch (error) {
    scope.postMessage({
      error: error instanceof Error ? error.message : '后台归档失败',
    });
  }
};
