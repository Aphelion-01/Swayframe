import fs from 'node:fs/promises';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  importLayerPack,
  isLayerPackImporting,
} from '../src/importers/layerpack-import';
import {
  parseLayerPackManifest,
  type PreparedLayerPack,
} from '../src/importers/layerpack-manifest';
import { desktopService } from '../src/desktop/service';
import type { DesktopAPI } from '../src/desktop/contracts';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  createComposition,
} from '../src/core/project-model';
let prepared: PreparedLayerPack;
beforeEach(async () => {
  const root = 'docs/qa/ai2comp/packages/B';
  const manifest = parseLayerPackManifest(
    JSON.parse(await fs.readFile(root + '/manifest.json', 'utf8')),
  );
  prepared = {
    manifest,
    images: await Promise.all(
      manifest.layers.map(async (l) => ({
        asset: l.asset,
        dataUrl:
          'data:image/png;base64,' +
          (await fs.readFile(root + '/' + l.asset)).toString('base64'),
      })),
    ),
  } as PreparedLayerPack;
  vi.spyOn(desktopService, 'api', 'get').mockReturnValue({
    assets: {
      readLayerPack: async () => prepared,
      cancelLayerPack: async () => {},
    },
    dialog: { openFolder: async () => root },
  } as unknown as DesktopAPI);
  // Unit decoder substitute only. Real native PNG decoding/rendering is covered in Electron evidence.
  vi.stubGlobal('createImageBitmap', async (blob: Blob) => {
    const b = Buffer.from(await blob.arrayBuffer());
    return {
      width: b.readUInt32BE(16),
      height: b.readUInt32BE(20),
      close() {},
    };
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const editor = () =>
  new EditorStore(
    createDefaultProject(createComposition({ width: 64, height: 48 })),
  );
it('preflights without publishing; confirmation creates exactly one undoable transaction', async () => {
  const store = editor(),
    before = store.save(),
    phases: string[] = [];
  await importLayerPack(store, {
    onPhase: (p) => phases.push(p),
    confirm: async (data) => {
      expect(data.manifest.layers.length).toBe(3);
      expect(store.save()).toBe(before);
      expect(store.commands.undoStack).toHaveLength(0);
      return true;
    },
  });
  expect(phases).toEqual(['selecting', 'validating', 'importing']);
  expect(store.commands.undoStack).toHaveLength(1);
  const after = store.save();
  store.undo();
  expect(store.save()).toBe(before);
  store.redo();
  expect(store.save()).toBe(after);
  expect(isLayerPackImporting(store)).toBe(false);
});
it('declining confirmation leaves Scene and history unchanged', async () => {
  const store = editor(),
    before = store.save();
  await expect(
    importLayerPack(store, { confirm: async () => false }),
  ).rejects.toThrow();
  expect(store.save()).toBe(before);
  expect(store.commands.undoStack).toHaveLength(0);
  expect(isLayerPackImporting(store)).toBe(false);
});
it('project replacement aborts a pending preview and cannot publish the old candidate', async () => {
  const store = editor();
  let entered!: () => void;
  const ready = new Promise<void>((r) => (entered = r));
  const pending = importLayerPack(store, {
    confirm: async (_data, signal) =>
      new Promise((_resolve, reject) => {
        entered();
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
      }),
  });
  const rejected = expect(pending).rejects.toThrow('工程已改变');
  await ready;
  store.load(store.save());
  const replacement = store.save();
  await rejected;
  expect(store.save()).toBe(replacement);
  expect(store.commands.undoStack).toHaveLength(0);
});
it('explicit cancellation while preview is pending never enters the undo stack', async () => {
  const store = editor(),
    controller = new AbortController(),
    before = store.save();
  let entered!: () => void;
  const ready = new Promise<void>((r) => (entered = r));
  const pending = importLayerPack(store, {
    signal: controller.signal,
    confirm: async (_data, signal) =>
      new Promise((_resolve, reject) => {
        entered();
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
      }),
  });
  const rejected = expect(pending).rejects.toThrow();
  await ready;
  controller.abort();
  await rejected;
  expect(store.save()).toBe(before);
  expect(store.commands.undoStack).toHaveLength(0);
});
it('cancellation at importing notification prevents the synchronous publication', async () => {
  const store = editor(),
    controller = new AbortController(),
    before = store.save();
  await expect(
    importLayerPack(store, {
      signal: controller.signal,
      confirm: async () => true,
      onPhase: (p) => {
        if (p === 'importing') controller.abort();
      },
    }),
  ).rejects.toThrow();
  expect(store.save()).toBe(before);
  expect(store.commands.undoStack).toHaveLength(0);
});
