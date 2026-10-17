import { mediaMetadata } from '../importers/media-metadata';
import { mediaMime } from '../shared/media-formats';
import { desktopService } from '../desktop/service';
import {
  importNativeAssets,
  assertAssetImportCurrent,
} from '../desktop/asset-service';
import { activeComposition, createLayer } from '../core/project-model';
import { newId } from '../core/core-types';
import { command } from '../core/command-system';
import { readFile } from './file-utils';
import type { EditorStore } from './editor-store';
export async function importImageFile(
  store: EditorStore,
  file: File,
  addLayer = true,
  signal?: AbortSignal,
): Promise<void> {
  if (desktopService.native) {
    await importNativeAssets(store, addLayer, [file], false, signal);
    return;
  }
  const revision = store.commands.getSnapshot();
  const mime = mediaMime(file.name) ?? file.type;
  if (mime.startsWith('audio/') || mime.startsWith('video/')) {
    if (file.size > 10_000_000)
      throw Error('Web 版内嵌素材限制为 10 MB，请在桌面版导入大文件');
    const media = await mediaMetadata(file, mime),
      dataUrl = (await readFile(file, 'dataUrl')).replace(
        /^data:[^;]*;/,
        `data:${mime};`,
      );
    assertAssetImportCurrent(store, revision, signal);
    const asset = {
      id: newId(),
      name: file.name,
      mimeType: mime,
      dataUrl,
      media,
    };
    const v = store.getSnapshot(),
      c = activeComposition(v.project);
    const layer = createLayer(media.kind, {
      name: file.name,
      assetId: asset.id,
      width: media.width,
      height: media.height,
      position: { x: c.width / 2, y: c.height / 2 },
    });
    const timed = {
      ...layer,
      editor: {
        ...layer.editor!,
        outPoint: Math.min(c.duration, media.duration),
      },
    };
    const ops = [
      command({ type: 'asset.add', asset }),
      ...(addLayer
        ? [command({ type: 'layer.create', compositionId: c.id, layer: timed })]
        : []),
    ];
    if (store.run('导入音视频', ops).ok && addLayer) store.select(layer.id);
    return;
  }
  if (file.size > 10_000_000) throw new Error('图片超过 10 MB');
  if (
    ![
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/avif',
    ].includes(mime)
  )
    throw new Error('请选择 PNG、JPEG、WebP、GIF、BMP 或 AVIF 图片');
  const dataUrl = (await readFile(file, 'dataUrl')).replace(
      /^data:[^;]*;/,
      `data:${mime};`,
    ),
    p = store.getSnapshot().project,
    c = activeComposition(p),
    existing = p.assets.find((a) => a.dataUrl === dataUrl),
    bitmap = await createImageBitmap(file);
  try {
    assertAssetImportCurrent(store, revision, signal);
    const ratio = Math.min(1, 600 / bitmap.width, 600 / bitmap.height),
      asset = existing ?? {
        id: newId(),
        name: file.name,
        mimeType: mime,
        dataUrl,
      },
      layer = createLayer('image', {
        assetId: asset.id,
        width: bitmap.width * ratio,
        height: bitmap.height * ratio,
        position: { x: c.width / 2, y: c.height / 2 },
      });
    const commands = [
      ...(!existing ? [command({ type: 'asset.add', asset })] : []),
      ...(addLayer
        ? [command({ type: 'layer.create', compositionId: c.id, layer })]
        : []),
    ];
    if (commands.length && store.run('导入图片', commands).ok && addLayer)
      store.select(layer.id);
    else if (!commands.length) store.setStatus('素材已存在');
  } finally {
    bitmap.close();
  }
}
export async function dropAssets(
  store: EditorStore,
  event: React.DragEvent,
): Promise<void> {
  event.preventDefault();
  const assetId = event.dataTransfer.getData('application/x-motion-asset');
  try {
    if (assetId) {
      await addAssetLayer(store, assetId);
      return;
    }
    if (desktopService.native) {
      await importNativeAssets(
        store,
        true,
        Array.from(event.dataTransfer.files),
        !!(event.target as Element).closest('.timeline-panel'),
      );
      return;
    }
    for (const file of Array.from(event.dataTransfer.files))
      await importImageFile(store, file);
  } catch (e) {
    store.setStatus(e instanceof Error ? e.message : '素材导入失败', true);
  }
}
export async function addAssetLayer(
  store: EditorStore,
  assetId: string,
  signal?: AbortSignal,
): Promise<void> {
  const p = store.getSnapshot().project,
    c = activeComposition(p),
    asset = p.assets.find((a) => a.id === assetId);
  assertAssetImportCurrent(store, p, signal);
  if (!asset) throw new Error('素材不存在');
  if (asset.mesh) {
    const layer = createLayer('model', {
      width: 240,
      height: 240,
      assetId: asset.id,
      name: asset.name,
      position: { x: c.width / 2, y: c.height / 2 },
    });
    if (
      store.run('添加模型图层', [
        command({ type: 'layer.create', compositionId: c.id, layer }),
      ]).ok
    )
      store.select(layer.id);
    return;
  }
  if (asset.media) {
    const layer = createLayer(asset.media.kind, {
      assetId: asset.id,
      name: asset.name,
      width: asset.media.width,
      height: asset.media.height,
      position: { x: c.width / 2, y: c.height / 2 },
    });
    if (
      store.run('添加媒介图层', [
        command({
          type: 'layer.create',
          compositionId: c.id,
          layer: {
            ...layer,
            editor: {
              ...layer.editor!,
              outPoint: Math.min(c.duration, asset.media.duration),
            },
          },
        }),
      ]).ok
    )
      store.select(layer.id);
    return;
  }
  const bitmap = await createImageBitmap(
    await (await fetch(asset.dataUrl)).blob(),
  );
  try {
    assertAssetImportCurrent(store, p, signal);
    const ratio = Math.min(1, 600 / bitmap.width, 600 / bitmap.height),
      layer = createLayer('image', {
        assetId,
        width: bitmap.width * ratio,
        height: bitmap.height * ratio,
        position: { x: c.width / 2, y: c.height / 2 },
      });
    if (
      store.run('添加素材图层', [
        command({ type: 'layer.create', compositionId: c.id, layer }),
      ]).ok
    )
      store.select(layer.id);
  } finally {
    bitmap.close();
  }
}
