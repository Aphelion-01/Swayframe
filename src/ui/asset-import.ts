import { desktopService } from '../desktop/service';
import { importNativeAssets } from '../desktop/asset-service';
import { activeComposition, createLayer } from '../core/project-model';
import { newId } from '../core/core-types';
import { command } from '../core/command-system';
import { readFile } from './file-utils';
import type { EditorStore } from './editor-store';
export async function importImageFile(
  store: EditorStore,
  file: File,
  addLayer = true,
): Promise<void> {
  if (desktopService.native) {
    await importNativeAssets(store, addLayer, [file]);
    return;
  }
  if (file.size > 10_000_000) throw new Error('图片超过 10 MB');
  if (
    !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)
  )
    throw new Error('请选择 PNG、JPEG、WebP 或 GIF 图片');
  const dataUrl = await readFile(file, 'dataUrl'),
    p = store.getSnapshot().project,
    c = activeComposition(p),
    existing = p.assets.find((a) => a.dataUrl === dataUrl),
    bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 600 / bitmap.width, 600 / bitmap.height),
      asset = existing ?? {
        id: newId(),
        name: file.name,
        mimeType: file.type,
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
): Promise<void> {
  const p = store.getSnapshot().project,
    c = activeComposition(p),
    asset = p.assets.find((a) => a.id === assetId);
  if (!asset) throw new Error('素材不存在');
  const bitmap = await createImageBitmap(
    await (await fetch(asset.dataUrl)).blob(),
  );
  try {
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
