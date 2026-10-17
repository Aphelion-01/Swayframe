import {
  parseLayerPackManifest,
  LayerPackError,
  type PreparedLayerPack,
} from './layerpack-manifest';
import { CommandSystem, transaction, command } from '../core/command-system';
import {
  createComposition,
  createLayer,
  activeComposition,
  type Asset,
} from '../core/project-model';
import { newId } from '../core/core-types';
import { assetImageBlob } from '../renderers/canvas2d';
import { assertAssetImportCurrent } from '../desktop/asset-service';
import { desktopService } from '../desktop/service';
import type { EditorStore } from '../ui/editor-store';
const pending = new WeakMap<EditorStore, AbortController>();
export const isLayerPackImporting = (store: EditorStore) => pending.has(store);
export function cancelLayerPackImport(store: EditorStore) {
  pending.get(store)?.abort();
}
export interface LayerPackImportOptions {
  directory?: string;
  targetCompositionId?: string;
  signal?: AbortSignal;
  onPhase?: (phase: 'selecting' | 'validating' | 'importing') => void;
  confirm?: (
    prepared: PreparedLayerPack,
    signal: AbortSignal,
  ) => Promise<boolean>;
}
/** One existing Scene transaction, embedded assets. No disk writes or alternate asset registry. */
export async function importLayerPack(
  store: EditorStore,
  options: LayerPackImportOptions = {},
) {
  const api = desktopService.api;
  if (!api) throw new LayerPackError('请在桌面版导入图层包');
  cancelLayerPackImport(store);
  const controller = new AbortController(),
    requestId = newId();
  pending.set(store, controller);
  const revision = store.commands.getSnapshot(),
    anchorId = options.targetCompositionId ?? revision.activeCompositionId;
  const check = () => {
    assertAssetImportCurrent(store, revision, controller.signal);
    if (
      pending.get(store) !== controller ||
      !store.getSnapshot().project.compositions.some((c) => c.id === anchorId)
    )
      throw new LayerPackError('导入目标已失效');
  };
  const unsubscribe = store.commands.subscribe(() => {
    if (store.commands.getSnapshot() !== revision)
      controller.abort(new Error('工程已改变，请重新选择分层合成。'));
  });
  const abort = () => controller.abort();
  const cancelNative = () => {
    void api.assets.cancelLayerPack(requestId).catch(() => {});
  };
  options.signal?.addEventListener('abort', abort, { once: true });
  controller.signal.addEventListener('abort', cancelNative, { once: true });
  if (options.signal?.aborted) controller.abort();
  store.setStatus('正在导入图层包…可在文件菜单取消');
  try {
    check();
    options.onPhase?.('selecting');
    const directory =
      options.directory ??
      (await api.dialog.openFolder({
        title: '导入分层合成：选择文件夹',
      }));
    check();
    if (!directory) {
      store.setStatus('已取消图层包导入');
      return null;
    }
    options.onPhase?.('validating');
    const prepared: PreparedLayerPack = await api.assets.readLayerPack(
      directory,
      requestId,
    );
    check();
    const manifest = parseLayerPackManifest(prepared.manifest);
    const target = revision.compositions.find(
      (c) => c.id === options.targetCompositionId,
    );
    if (
      options.targetCompositionId &&
      (!target ||
        target.width !== manifest.canvas.width ||
        target.height !== manifest.canvas.height)
    )
      throw new LayerPackError('目标合成尺寸必须与包画布一致');
    const composition =
      target ??
      createComposition({
        name: 'Layer Package',
        width: manifest.canvas.width,
        height: manifest.canvas.height,
        fps: activeComposition(revision).fps,
        duration: activeComposition(revision).duration,
      });
    const assets: Asset[] = [],
      mapping = new Map<string, Asset>();
    // Decode each unique PNG using the same production asset decoder before any Scene mutation.
    for (const image of prepared.images) {
      check();
      if (
        mapping.has(image.asset) ||
        !manifest.layers.some((l) => l.asset === image.asset) ||
        !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(image.dataUrl)
      )
        throw new LayerPackError('资产准备结果无效');
      const existing = [...revision.assets, ...assets].find(
        (a) =>
          a.mimeType === 'image/png' &&
          !a.source &&
          a.dataUrl === image.dataUrl,
      );
      const asset: Asset = existing ?? {
        id: newId(),
        name: image.asset.split('/').at(-1)!,
        mimeType: 'image/png',
        dataUrl: image.dataUrl,
      };
      const bitmap = await createImageBitmap(await assetImageBlob(asset));
      try {
        check();
        if (
          manifest.layers.some(
            (l) =>
              l.asset === image.asset &&
              (bitmap.width !== l.bounds.width ||
                bitmap.height !== l.bounds.height),
          )
        )
          throw new LayerPackError('解码图片尺寸与 bounds 不符');
      } finally {
        bitmap.close();
      }
      if (!existing) assets.push(asset);
      mapping.set(image.asset, asset);
    }
    const layers = manifest.layers.map((entry) => {
      const asset = mapping.get(entry.asset);
      if (!asset) throw new LayerPackError(`图片缺失：${entry.asset}`);
      const layer = createLayer('image', {
        name: entry.name,
        assetId: asset.id,
        width: entry.bounds.width,
        height: entry.bounds.height,
        position: {
          x: entry.bounds.x + entry.bounds.width / 2,
          y: entry.bounds.y + entry.bounds.height / 2,
        },
      });
      return {
        ...layer,
        transform: {
          ...layer.transform,
          opacity: { ...layer.transform.opacity, baseValue: entry.opacity },
        },
      };
    });
    check();
    const commands = [
      ...assets.map((asset) => command({ type: 'asset.add', asset })),
      ...(target
        ? layers.map((layer) =>
            command({ type: 'layer.create', compositionId: target.id, layer }),
          )
        : [
            command({
              type: 'composition.add',
              composition: { ...composition, layers },
            }),
            command({
              type: 'project.activate',
              compositionId: composition.id,
            }),
          ]),
    ];
    if (options.confirm) {
      // Reuse the real kernel for bounded preflight; never publish this temporary candidate.
      const candidate = new CommandSystem(revision).executeTransaction(
        transaction('预检分层合成', 'human', commands),
      );
      if (!candidate.ok) throw new LayerPackError(candidate.error);
      if (!(await options.confirm(prepared, controller.signal))) {
        controller.abort();
        check();
      }
      check();
      options.onPhase?.('importing');
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      check();
    }
    // The following synchronous transaction is our own publication, not a stale external edit.
    unsubscribe();
    const result = store.run('导入 Layer Package', commands);
    if (!result.ok)
      throw new LayerPackError(`提交失败，工程未更改：${result.error}`);
    if (store.commands.getSnapshot().activeCompositionId === composition.id)
      store.select(layers.at(-1)!.id);
    return {
      compositionId: composition.id,
      layerIds: layers.map((l) => l.id),
      addedAssetIds: assets.map((a) => a.id),
    };
  } catch (error) {
    if (pending.get(store) === controller)
      store.setStatus(
        controller.signal.aborted
          ? '已取消图层包导入'
          : error instanceof Error
            ? error.message
            : '图层包导入失败',
        !controller.signal.aborted,
      );
    throw error;
  } finally {
    unsubscribe();
    options.signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', cancelNative);
    if (pending.get(store) === controller) pending.delete(store);
  }
}
