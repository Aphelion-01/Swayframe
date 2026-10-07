import { useEditorSlice } from './use-editor-slice';
import { desktopService } from '../desktop/service';
import { importNativeAssets } from '../desktop/asset-service';
import { getProjectService } from '../desktop/project-service';
import { dispatchShortcut } from './workspace/shortcuts';
import type { Shortcut } from './workspace/shortcuts';
import { CommandPalette } from './workspace/palette';
import { layerActions } from './workspace/layer-actions';
import { tools, useTools } from './workspace/tools';
import { Icon } from './workspace/icons';
import { MenuDropdown, Modal, IconButton } from './workspace/primitives';
import { ExportDialog } from './ExportDialog';
import { readFile } from './file-utils';
import { importImageFile } from './asset-import';
import { saveProject } from '../core/project-io';
export { readFile } from './file-utils';
import { layerKindLabels, displayName } from './labels';
import { useEffect, useRef, useState } from 'react';
import { command } from '../core/command-system';
import {
  activeComposition,
  createComposition,
  createLayer,
  createDefaultProject,
  layerProperties,
} from '../core/project-model';
import type { LayerKind } from '../core/project-model';
import type { EditorStore } from './editor-store';

export function downloadProject(store: EditorStore): void {
  const native = getProjectService(store);
  if (native) {
    void native.save();
    return;
  }
  try {
    const url = URL.createObjectURL(
      new Blob([store.save()], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${store.getSnapshot().project.name.replace(/[^\p{L}\p{N}_-]/gu, '_')}.motion.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    store.setStatus('工程文件已保存');
  } catch (error) {
    store.setStatus(error instanceof Error ? error.message : '保存失败', true);
  }
}
export function Toolbar({ store }: { store: EditorStore }) {
  const { tool, setTool, setSpace } = useTools();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const view = useEditorSlice(store, ['project', 'selection', 'playing']);
  const c = activeComposition(view.project);
  const openRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [newDialog, setNewDialog] = useState(false);
  const [resetDialog, setResetDialog] = useState(false);
  const [editingComposition, setEditingComposition] = useState(false);
  const [settings, setSettings] = useState({
    name: '合成 01',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
  });
  const newProject = () => {
    const service = getProjectService(store);
    if (service) void service.newProject();
    else setResetDialog(true);
  };
  const create = (kind: Exclude<LayerKind, 'image'>) => {
    const layer = createLayer(kind, {
      position: { x: c.width / 2, y: c.height / 2 },
    });
    const result = store.run(`创建 ${layerKindLabels[kind]}`, [
      command({ type: 'layer.create', compositionId: c.id, layer }),
    ]);
    if (result.ok) store.select(layer.id);
  };
  const registry: Shortcut[] = [
    {
      id: 'new-project',
      label: '新建工程',
      key: 'n',
      modifier: true,
      inInput: true,
      action: newProject,
    },
    {
      id: 'open-project',
      label: '打开工程',
      key: 'o',
      modifier: true,
      inInput: true,
      action: () => {
        const service = getProjectService(store);
        if (service) void service.open();
        else openRef.current?.click();
      },
    },
    {
      id: 'save-as',
      label: '工程另存为',
      key: 's',
      modifier: true,
      shift: true,
      inInput: true,
      action: () => {
        const service = getProjectService(store);
        if (service) void service.save(true);
        else downloadProject(store);
      },
    },
    {
      id: 'panels',
      label: '切换侧面板',
      key: 'tab',
      contexts: ['canvas'] as const,
      action: () => window.dispatchEvent(new Event('motion:toggle-panels')),
    },
    {
      id: 'save',
      shift: false,
      label: '保存工程',
      key: 's',
      modifier: true,
      inInput: true,
      action: () => downloadProject(store),
    },
    {
      id: 'palette',
      label: '命令搜索',
      key: 'k',
      modifier: true,
      inInput: true,
      action: () => setPaletteOpen((v) => !v),
    },
    {
      id: 'undo',
      label: '撤销',
      key: 'z',
      modifier: true,
      shift: false,
      action: () => store.undo(),
    },
    {
      id: 'redo',
      label: '重做',
      key: 'z',
      modifier: true,
      shift: true,
      action: () => store.redo(),
    },
    {
      id: 'redo-alt',
      label: '重做',
      key: 'y',
      modifier: true,
      action: () => store.redo(),
    },
    {
      id: 'copy',
      label: '复制',
      key: 'c',
      modifier: true,
      action: () => store.copySelection(),
    },
    {
      id: 'paste',
      label: '粘贴',
      key: 'v',
      modifier: true,
      action: () => store.pasteSelection(),
    },
    {
      id: 'duplicate',
      label: '复制选中',
      key: 'd',
      modifier: true,
      action: () => store.duplicateSelection(),
    },
    {
      id: 'all',
      label: '全选',
      key: 'a',
      modifier: true,
      action: (_, context) => {
        if (context === 'timeline')
          store.selectFrames(
            activeComposition(store.getSnapshot().project).layers.flatMap(
              (layer) =>
                layerProperties(layer).flatMap(({ property }) =>
                  property.keyframes.map((frame) => ({
                    propertyId: property.id,
                    keyframeId: frame.id,
                  })),
                ),
            ),
          );
        else store.selectAll();
      },
    },
    ...tools.map((tool) => ({
      id: tool.id,
      label: tool.label,
      key: tool.key.toLowerCase(),
      contexts: ['canvas', 'layers', 'global'] as const,
      action: () => setTool(tool.id),
    })),
    ...(
      [
        ['p', 'position'],
        ['s', 'scale'],
        ['r', 'rotation'],
        ['t', 'opacity'],
        ['u', 'animated'],
      ] as const
    ).map(([key, filter]) => ({
      id: `filter-${key}`,
      label: `筛选 ${filter}`,
      key,
      contexts:
        key === 'u' || key === 's'
          ? (['timeline', 'global'] as const)
          : (['timeline'] as const),
      action: () => store.setPropertyFilter(filter),
    })),
    ...['delete', 'backspace'].map((key) => ({
      id: key,
      label: '删除选中',
      key,
      action: () => store.deleteSelected(),
    })),
    ...['enter', 'f2'].map((key) => ({
      id: `rename-${key}`,
      label: '重命名',
      key,
      contexts: ['layers', 'canvas'] as const,
      action: () =>
        window.dispatchEvent(
          new Event(
            key === 'enter' && tool === 'pen'
              ? 'motion:finish-path'
              : 'motion:rename',
          ),
        ),
    })),
    {
      id: 'space',
      label: '播放 / 平移',
      key: 'space',
      action: (event, context) => {
        if (context === 'canvas') setSpace(true);
        else if (!event.repeat) store.setPlaying(!store.getSnapshot().playing);
      },
    },
    {
      id: 'escape',
      inInput: true,
      label: '取消操作',
      key: 'escape',
      action: () => {
        store.cancelDrag();
        store.setPropertyPreview(undefined);
        store.setPropertyPreviews(undefined);
        window.dispatchEvent(new Event('motion:cancel'));
      },
    },
    ...['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].flatMap((key) =>
      [false, true].map((modifier) => ({
        id: `nudge-${key}-${modifier}`,
        label: '移动 / 步进',
        key,
        modifier,
        action: (
          event: KeyboardEvent,
          context: import('./workspace/shortcuts').FocusContext,
        ) => {
          const step = event.shiftKey ? 10 : 1;
          if (context === 'timeline' || modifier) {
            store.setPlaying(false);
            store.setTime(
              store.getSnapshot().time +
                (key === 'arrowleft' ? -step : step) /
                  activeComposition(store.getSnapshot().project).fps,
            );
          } else
            store.nudge(
              key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0,
              key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0,
            );
        },
      })),
    ),
  ];
  useEffect(() => {
    const handler = (event: KeyboardEvent) => dispatchShortcut(event, registry);
    const release = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpace(false);
    };
    const blur = () => setSpace(false);
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', release);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', blur);
    };
  });
  useEffect(() => {
    const open = () => setExportOpen(true);
    window.addEventListener('motion:export', open);
    return () => window.removeEventListener('motion:export', open);
  }, []);
  const paletteCommands = [
    {
      label: '设置 · AI 服务',
      keywords: 'settings provider model API',
      action: () => window.dispatchEvent(new Event('swayframe:ai-settings')),
    },
    ...(['rectangle', 'ellipse', 'text', 'path', 'null'] as const).map(
      (kind) => ({
        label: `创建 ${layerKindLabels[kind]}`,
        keywords: `create ${kind}`,
        action: () => create(kind),
      }),
    ),
    {
      label: '适合画布',
      keywords: 'fit canvas',
      action: () => window.dispatchEvent(new Event('motion:fit')),
    },
    {
      label: '打开曲线编辑器',
      keywords: 'graph editor',
      action: () => window.dispatchEvent(new Event('motion:graph')),
    },
    {
      label: '导出',
      keywords: 'export png',
      action: () => setExportOpen(true),
    },
    {
      label: '保存工程',
      keywords: 'save',
      action: () => downloadProject(store),
    },
    {
      label: '添加高斯模糊',
      keywords: 'add blur gaussian',
      disabled: !view.selection.length,
      action: () => window.dispatchEvent(new Event('motion:add-blur')),
    },
    ...layerActions(store, () =>
      window.dispatchEvent(new Event('motion:rename')),
    ),
  ];
  const importImage = async (file?: File) => {
    if (!file) return;
    try {
      await importImageFile(store, file);
    } catch (error) {
      store.setStatus(
        error instanceof Error ? error.message : '图片导入失败',
        true,
      );
    }
  };

  return (
    <>
      {paletteOpen && (
        <CommandPalette
          commands={paletteCommands}
          onClose={() => setPaletteOpen(false)}
        />
      )}
      <header className="topbar">
        <MenuDropdown>
          <summary title="工程与创建命令">
            <span className="application-name">
              <img
                src="./branding/wordmark.png"
                alt="Swayframe"
                draggable={false}
              />
            </span>
            <span>文件</span>
            <Icon name="chevron" />
          </summary>
          <div
            className="dropdown-menu"
            onClick={(event) => {
              if ((event.target as Element).closest('button'))
                event.currentTarget.closest('details')?.removeAttribute('open');
            }}
          >
            <button
              onClick={() => {
                setEditingComposition(false);
                setSettings({
                  name: `合成 ${String(view.project.compositions.length + 1).padStart(2, '0')}`,
                  width: 1920,
                  height: 1080,
                  fps: 30,
                  duration: 5,
                });
                setNewDialog(true);
              }}
            >
              新建合成
            </button>
            <button
              onClick={() => {
                const service = getProjectService(store);
                if (service) void service.open();
                else openRef.current?.click();
              }}
            >
              打开工程
            </button>
            <button onClick={newProject}>新建工程</button>
            <button
              onClick={() => {
                const service = getProjectService(store);
                if (service) void service.save(true);
                else downloadProject(store);
              }}
            >
              工程另存为
            </button>
            <button onClick={() => downloadProject(store)}>保存工程 ↗</button>
            <button
              onClick={() => {
                setEditingComposition(true);
                setSettings({
                  name: c.name,
                  width: c.width,
                  height: c.height,
                  fps: c.fps,
                  duration: c.duration,
                });
                setNewDialog(true);
              }}
            >
              合成设置
            </button>
            <button
              onClick={() =>
                window.dispatchEvent(new Event('swayframe:ai-settings'))
              }
            >
              设置 · AI
            </button>
            <hr />
            {(
              [
                'rectangle',
                'ellipse',
                'polygon',
                'star',
                'path',
                'text',
                'camera',
                'solid',
                'null',
              ] as const
            ).map((kind) => (
              <button
                key={kind}
                aria-label={`创建 ${layerKindLabels[kind]}`}
                onClick={() => create(kind)}
              >
                创建 {layerKindLabels[kind]}
              </button>
            ))}
            <button
              aria-label="导入 图片"
              onClick={() =>
                desktopService.native
                  ? void importNativeAssets(store)
                  : imageRef.current?.click()
              }
            >
              导入图片
            </button>
          </div>
        </MenuDropdown>
        <div className="project-title">
          {displayName(c.name)}
          <span>{displayName(view.project.name)}</span>
        </div>
        <div className="file-actions">
          <IconButton
            label="搜索命令"
            shortcut="⌘K"
            onClick={() => setPaletteOpen(true)}
          >
            <Icon name="search" />
          </IconButton>
          <button
            className="toolbar-action"
            onClick={() => setExportOpen(true)}
          >
            <Icon name="export" />
            导出
          </button>
          <IconButton
            label="播放预览"
            shortcut="Space"
            onClick={() => store.setPlaying(!view.playing)}
          >
            <Icon name={view.playing ? 'pause' : 'play'} />
          </IconButton>
          <IconButton
            label="撤销"
            shortcut="⌘Z"
            disabled={!store.commands.undoStack.length}
            onClick={() => store.undo()}
          >
            <Icon name="undo" />
          </IconButton>
          <IconButton
            label="重做"
            shortcut="⌘⇧Z"
            disabled={!store.commands.redoStack.length}
            onClick={() => store.redo()}
          >
            <Icon name="redo" />
          </IconButton>
        </div>
      </header>
      <div className="editor-tool-strip">
        <ToolButtons />
        <span className="tool-context">
          {tools.find((item) => item.id === tool)?.label}
        </span>
        <button
          className="assistant-entry"
          onClick={() => window.dispatchEvent(new Event('motion:assistant'))}
        >
          <Icon name="assistant" />
          创作助手
        </button>
      </div>
      <input
        ref={openRef}
        type="file"
        hidden
        aria-label="打开工程文件"
        accept=".json,application/json"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          try {
            if (file.size > 20_000_000) throw new Error('工程文件超过 20 MB');
            store.load(await readFile(file, 'text'));
          } catch (error) {
            store.setStatus(
              error instanceof Error ? error.message : '文件打开失败',
              true,
            );
          }
        }}
      />
      <input
        ref={imageRef}
        type="file"
        hidden
        aria-label="导入图片文件"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          void importImage(file);
        }}
      />
      {exportOpen && (
        <ExportDialog store={store} onClose={() => setExportOpen(false)} />
      )}
      {resetDialog && (
        <Modal onClose={() => setResetDialog(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="新建工程"
            className="new-dialog"
          >
            <h2>新建工程</h2>
            <p>
              新建会清空当前工程与撤销历史。需要保留当前作品，请先保存工程。
            </p>
            <div className="dialog-actions">
              <button onClick={() => setResetDialog(false)}>取消</button>
              <button onClick={() => downloadProject(store)}>
                保存当前工程
              </button>
              <button
                className="primary"
                onClick={() => {
                  if (store.load(saveProject(createDefaultProject()))) {
                    store.setStatus('新工程已创建');
                    setResetDialog(false);
                  }
                }}
              >
                创建空白工程
              </button>
            </div>
          </section>
        </Modal>
      )}
      {newDialog && (
        <Modal onClose={() => setNewDialog(false)}>
          <form
            aria-modal="true"
            role="dialog"
            aria-label={editingComposition ? '合成设置' : '新建合成'}
            className="new-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                const composition = editingComposition
                  ? { ...c, ...settings }
                  : createComposition({
                      ...settings,
                      name: settings.name.trim(),
                    });
                const result = store.run(
                  editingComposition ? '修改合成设置' : '新建合成',
                  editingComposition
                    ? [command({ type: 'composition.replace', composition })]
                    : [
                        command({ type: 'composition.add', composition }),
                        command({
                          type: 'project.activate',
                          compositionId: composition.id,
                        }),
                      ],
                );
                if (!result.ok) throw new Error(result.error);
                store.cancelDrag();
                store.select(null);
                store.setPlaying(false);
                store.setTime(0);
                store.setStatus(
                  editingComposition ? '合成设置已更新' : '新合成已创建',
                );
                setNewDialog(false);
              } catch (error) {
                store.setStatus(
                  error instanceof Error ? error.message : '新建失败',
                  true,
                );
              }
            }}
          >
            <h2>{editingComposition ? '合成设置' : '新建合成'}</h2>
            <p>设置画面尺寸与时间。</p>
            <label className="field">
              名称
              <input
                aria-label="合成名称"
                required
                maxLength={200}
                value={settings.name}
                onChange={(event) =>
                  setSettings({ ...settings, name: event.target.value })
                }
              />
            </label>
            <div className="field-grid">
              {(['width', 'height', 'fps', 'duration'] as const).map((key) => (
                <label className="field" key={key}>
                  <span>
                    {
                      {
                        width: '宽度',
                        height: '高度',
                        fps: '帧率',
                        duration: '时长（秒）',
                      }[key]
                    }
                  </span>
                  <input
                    aria-label={`新合成 ${{ width: '宽度', height: '高度', fps: '帧率', duration: '时长' }[key]}`}
                    type="number"
                    required
                    min={1}
                    max={
                      key === 'fps' ? 240 : key === 'duration' ? 3600 : 16384
                    }
                    step={key === 'duration' ? 0.1 : 1}
                    value={settings[key]}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        [key]: Number(event.target.value),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            {editingComposition && (
              <label className="field">
                背景颜色
                <input
                  type="color"
                  aria-label="合成背景颜色"
                  value={
                    '#' +
                    [
                      c.backgroundColor?.r ?? 0.067,
                      c.backgroundColor?.g ?? 0.094,
                      c.backgroundColor?.b ?? 0.153,
                    ]
                      .map((v) =>
                        Math.round(v * 255)
                          .toString(16)
                          .padStart(2, '0'),
                      )
                      .join('')
                  }
                  onChange={(e) => {
                    const h = e.target.value.slice(1);
                    store.run('修改背景颜色', [
                      command({
                        type: 'composition.replace',
                        composition: {
                          ...c,
                          backgroundColor: {
                            r: parseInt(h.slice(0, 2), 16) / 255,
                            g: parseInt(h.slice(2, 4), 16) / 255,
                            b: parseInt(h.slice(4, 6), 16) / 255,
                            a: 1,
                          },
                        },
                      }),
                    ]);
                  }}
                />
              </label>
            )}
            <div className="dialog-actions">
              <button type="button" onClick={() => setNewDialog(false)}>
                取消
              </button>
              <button className="primary" type="submit">
                {editingComposition ? '应用合成设置' : '创建合成'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function ToolButtons() {
  const { tool, setTool } = useTools();
  return (
    <div className="tool-buttons" role="toolbar" aria-label="绘图工具">
      {tools.map((item) => (
        <IconButton
          key={item.id}
          label={item.label}
          shortcut={item.key}
          aria-pressed={tool === item.id}
          onClick={() => setTool(item.id)}
        >
          <Icon name={item.icon} />
        </IconButton>
      ))}
    </div>
  );
}
