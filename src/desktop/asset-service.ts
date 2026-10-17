import { mediaMetadata } from '../importers/media-metadata';
import type { EditorStore } from '../ui/editor-store';
import type { ImportedAsset } from './contracts';
import { desktopService } from './service';
import { command } from '../core/command-system';
import { activeComposition, createLayer } from '../core/project-model';
import type { Project, Asset } from '../core/project-model';
import { newId } from '../core/core-types';
/** Existing imports share the same Project owner; late/cancelled IO cannot publish commands. */
export function assertAssetImportCurrent(
  store: EditorStore,
  revision: Project,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  if (store.commands.getSnapshot() !== revision)
    throw Error('导入期间工程已更改，素材未应用，请重新导入。');
}
export async function linkedAsset(
  input: ImportedAsset,
  id = newId(),
): Promise<Asset> {
  const response = await fetch(input.url);
  if (!response.ok) throw Error('素材文件不存在或无法读取');
  const blob = await response.blob();
  if (
    input.mimeType.startsWith('audio/') ||
    input.mimeType.startsWith('video/')
  ) {
    const media = await mediaMetadata(blob, input.mimeType);
    return {
      id,
      name: input.name,
      mimeType: input.mimeType,
      dataUrl: input.url,
      media,
      source: {
        kind: 'linked',
        path: input.path,
        metadata: {
          ...input.metadata,
          width: media.width,
          height: media.height,
        },
      },
    };
  }
  const bitmap = await createImageBitmap(blob);
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
  signal?: AbortSignal,
) {
  const api = desktopService.api;
  if (!api) return;
  let revision = store.commands.getSnapshot();
  const startTime = store.getSnapshot().time;
  try {
    const paths = files ? await api.assets.pathsForFiles(files) : undefined;
    const imported = await api.assets.importFiles(paths);
    assertAssetImportCurrent(store, revision, signal);
    for (const input of imported) {
      const p = store.getSnapshot().project,
        c = activeComposition(p),
        existing = p.assets.find((a) => a.source?.path === input.path),
        asset = existing ?? (await linkedAsset(input));
      assertAssetImportCurrent(store, revision, signal);
      const w = asset.source?.metadata.width ?? 600,
        h = asset.source?.metadata.height ?? 600,
        ratio = Math.min(1, 600 / w, 600 / h);
      const layer = createLayer(asset.media?.kind ?? 'image', {
        assetId: asset.id,
        width: w * ratio,
        height: h * ratio,
        position: { x: c.width / 2, y: c.height / 2 },
      });
      const timed = atTime
        ? {
            ...layer,
            editor: {
              ...layer.editor!,
              inPoint: startTime,
              startTime: startTime,
              outPoint: Math.min(
                c.duration,
                startTime + (asset.media?.duration ?? c.duration),
              ),
            },
          }
        : asset.media
          ? {
              ...layer,
              editor: {
                ...layer.editor!,
                outPoint: Math.min(c.duration, asset.media.duration),
              },
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
      if (commands.length && store.run('导入链接素材', commands).ok) {
        revision = store.commands.getSnapshot();
        if (addLayer) store.select(layer.id);
      }
    }
  } catch (error) {
    store.setStatus(
      error instanceof Error ? error.message : '素材导入失败',
      true,
    );
  }
}
export async function relinkAsset(
  store: EditorStore,
  id: string,
  signal?: AbortSignal,
) {
  const api = desktopService.api;
  if (!api) return;
  try {
    const revision = store.commands.getSnapshot();
    const input = await api.assets.relink(id);
    if (input) {
      const asset = await linkedAsset(input, id);
      assertAssetImportCurrent(store, revision, signal);
      store.run('重新链接素材', [command({ type: 'asset.replace', asset })]);
    }
  } catch {
    store.setStatus('重新链接失败，请选择有效的图片文件。', true);
  }
}
