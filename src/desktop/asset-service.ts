import type { EditorStore } from '../ui/editor-store';
import type { ImportedAsset } from './contracts';
import { desktopService } from './service';
import { command } from '../core/command-system';
import { activeComposition, createLayer } from '../core/project-model';
import type { Asset } from '../core/project-model';
import { newId } from '../core/core-types';
async function linkedAsset(input: ImportedAsset, id = newId()): Promise<Asset> {
  const bitmap = await createImageBitmap(await (await fetch(input.url)).blob());
  try {
    return {
      id,
      name: input.name,
      mimeType: input.mimeType,
      dataUrl: input.url,
      source: {
        kind: 'linked',
        path: input.path,
        metadata: {
          ...input.metadata,
          width: bitmap.width,
          height: bitmap.height,
        },
      },
    };
  } finally {
    bitmap.close();
  }
}
export async function importNativeAssets(
  store: EditorStore,
  addLayer = true,
  files?: File[],
  atTime = false,
) {
  const api = desktopService.api;
  if (!api) return;
  try {
    const paths = files ? await api.assets.pathsForFiles(files) : undefined;
    const imported = await api.assets.importFiles(paths);
    for (const input of imported) {
      const p = store.getSnapshot().project,
        c = activeComposition(p),
        existing = p.assets.find((a) => a.source?.path === input.path),
        asset = existing ?? (await linkedAsset(input));
      const w = asset.source?.metadata.width ?? 600,
        h = asset.source?.metadata.height ?? 600,
        ratio = Math.min(1, 600 / w, 600 / h);
      const layer = createLayer('image', {
        assetId: asset.id,
        width: w * ratio,
        height: h * ratio,
        position: { x: c.width / 2, y: c.height / 2 },
      });
      const timed = atTime
        ? {
            ...layer,
            editor: { ...layer.editor!, inPoint: store.getSnapshot().time },
          }
        : layer;
      const commands = [
        ...(!existing ? [command({ type: 'asset.add', asset })] : []),
        ...(addLayer
          ? [
              command({
                type: 'layer.create',
                compositionId: c.id,
                layer: timed,
              }),
            ]
          : []),
      ];
      if (commands.length && store.run('导入链接素材', commands).ok && addLayer)
        store.select(layer.id);
    }
  } catch (error) {
    store.setStatus(
      error instanceof Error ? error.message : '素材导入失败',
      true,
    );
  }
}
export async function relinkAsset(store: EditorStore, id: string) {
  const api = desktopService.api;
  if (!api) return;
  try {
    const input = await api.assets.relink(id);
    if (input)
      store.run('重新链接素材', [
        command({ type: 'asset.replace', asset: await linkedAsset(input, id) }),
      ]);
  } catch {
    store.setStatus('重新链接失败，请选择有效的图片文件。', true);
  }
}
