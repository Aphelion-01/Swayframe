import { importModelFiles, isModelFile } from '../importers/model-import';
import { editorCommands } from './workspace/feature-contributions';
import { Icon } from './workspace/icons';
import { CommandRegistry } from './workspace/command-registry';
import { useCommandScope } from './workspace/scoped-commands';
import { editorContributions } from './workspace/feature-contributions';
import { desktopService } from '../desktop/service';
import { importNativeAssets, relinkAsset } from '../desktop/asset-service';
import { useRef, useSyncExternalStore, useState, useEffect } from 'react';
import { activeComposition, createLayer } from '../core/project-model';
import { command } from '../core/command-system';
import { addAssetLayer, importImageFile } from './asset-import';
import type { EditorStore } from './editor-store';
import { ContextMenu } from './workspace/primitives';
export function AssetsPanel({ store }: { store: EditorStore }) {
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot),
    ref = useRef<HTMLInputElement>(null),
    c = activeComposition(view.project);
  const [missing, setMissing] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string }>();
  const assetCommands = (assetId?: string) =>
    new CommandRegistry(() => {
      const target = store
        .getSnapshot()
        .project.assets.find((a) => a.id === assetId);
      return [
        {
          id: 'asset.add',
          label: '添加到当前合成',
          disabled: !target,
          action: () => {
            if (target)
              void addAssetLayer(store, target.id).catch((e) =>
                store.setStatus(String(e), true),
              );
          },
        },
        {
          id: 'asset.relink',
          label: '重新链接',
          disabled: !target?.source || !desktopService.native,
          action: () => {
            if (target) void relinkAsset(store, target.id);
          },
        },
        {
          id: 'asset.delete',
          label: '删除素材',
          disabled: !target,
          action: () => {
            if (target)
              store.run('删除素材', [
                command({ type: 'asset.remove', assetId: target.id }),
              ]);
          },
        },
      ];
    });
  useCommandScope(store, assetCommands(menu?.id).definitions());
  useEffect(() => {
    let live = true;
    void Promise.all(
      view.project.assets
        .filter((a) => a.source)
        .map(async (a) => {
          const exists = await desktopService.api?.assets
            .exists(a.source!.path)
            .catch(() => false);
          return exists ? null : a.id;
        }),
    ).then((ids) => {
      if (live) setMissing(ids.filter((id): id is string => !!id));
    });
    return () => {
      live = false;
    };
  }, [view.project.assets]);
  return (
    <details
      className="assets-panel"
      open
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('drop-target');
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove('drop-target')}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drop-target');
        const files = Array.from(e.dataTransfer.files);
        if (files.some((f) => isModelFile(f.name)))
          void importModelFiles(store, files, false).catch((e) =>
            store.setStatus(String(e), true),
          );
        else
          for (const file of files)
            void importImageFile(store, file, false).catch((e) =>
              store.setStatus(String(e), true),
            );
      }}
    >
      <summary>项目 / 素材 · {view.project.assets.length}</summary>
      <button
        onClick={() =>
          desktopService.native
            ? void importNativeAssets(store, false)
            : ref.current?.click()
        }
      >
        导入到素材库
      </button>
      <button onClick={() => editorCommands(store).execute('import-model')}>
        <Icon name="cube" /> 导入三维模型…
      </button>
      <input
        ref={ref}
        type="file"
        hidden
        multiple
        aria-label="素材库导入文件"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          try {
            for (const f of files) await importImageFile(store, f, false);
          } catch (error) {
            store.setStatus(
              error instanceof Error ? error.message : '导入失败',
              true,
            );
          }
        }}
      />
      {!view.project.assets.length && (
        <p className="asset-empty">
          导入图片 / 三维模型或拖入此处，可在多个图层中复用。
        </p>
      )}
      <div className="asset-list">
        {view.project.assets.map((asset) => (
          <div
            className="asset-row"
            title={asset.name}
            key={asset.id}
            draggable
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu({ x: e.clientX, y: e.clientY, id: asset.id });
            }}
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-motion-asset', asset.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
          >
            {missing.includes(asset.id) ? (
              <>
                <span title={asset.source?.path}>素材失联</span>
                <button
                  onClick={() =>
                    assetCommands(asset.id).execute('asset.relink')
                  }
                >
                  重新链接
                </button>
              </>
            ) : asset.mesh ? (
              <span
                title={`${asset.mesh.format.toUpperCase()} · ${asset.mesh.vertices.length / 9} 个三角形`}
              >
                <Icon name="cube" />
              </span>
            ) : (
              <img src={asset.dataUrl} alt="" />
            )}
            <button
              aria-label={`添加素材 ${asset.name}`}
              onClick={() => assetCommands(asset.id).execute('asset.add')}
            >
              {asset.name}
            </button>
            <button
              aria-label={`删除素材 ${asset.name}`}
              onClick={() => assetCommands(asset.id).execute('asset.delete')}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <label className="field">
        嵌套合成
        <select
          aria-label="插入预合成"
          value=""
          onChange={(e) => {
            const target = view.project.compositions.find(
              (v) => v.id === e.target.value,
            );
            if (!target) return;
            const layer = createLayer('precomp', {
              compositionId: target.id,
              width: target.width,
              height: target.height,
              position: { x: c.width / 2, y: c.height / 2 },
              name: target.name,
            });
            if (
              store.run('插入预合成', [
                command({ type: 'layer.create', compositionId: c.id, layer }),
              ]).ok
            )
              store.select(layer.id);
          }}
        >
          <option value="">选择合成…</option>
          {view.project.compositions
            .filter((v) => v.id !== c.id)
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </select>
      </label>
      <small>
        拖入图片 / 模型及依赖文件，或把素材拖到画布 /
        时间轴。点击素材名称可重复使用。
      </small>
      {menu && (
        <ContextMenu
          {...menu}
          onClose={() => setMenu(undefined)}
          items={editorContributions(store, 'context.asset')}
        />
      )}
    </details>
  );
}
