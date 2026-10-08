import { resolutionPresets, frameRates } from '../core/output-settings';
import { ModelImportInput } from './ModelImportInput';
import { useEditorSlice } from './use-editor-slice';
import { getProjectService } from '../desktop/project-service';
import { dispatchShortcut, focusContext } from './workspace/shortcuts';
import type { Shortcut, FocusContext } from './workspace/shortcuts';
import { CommandPalette } from './workspace/palette';
import {
  editorCommands,
  contributionItems,
} from './workspace/feature-contributions';
import { features } from '../shared/feature-catalog';
import { contextKeys } from './workspace/context-keys';
import type { IconName } from './workspace/icons';
import { ApplicationMenus } from './workspace/ApplicationMenus';
import { desktopService } from '../desktop/service';
import { importNativeAssets } from '../desktop/asset-service';
import { Modal as HelpModal } from './workspace/primitives';
import { ProductMetadata } from '../desktop/product';
import { tools, useTools } from './workspace/tools';
import { Icon } from './workspace/icons';
import { Modal, IconButton } from './workspace/primitives';
import { ExportDialog } from './ExportDialog';
import { readFile } from './file-utils';
import { importImageFile } from './asset-import';
import { saveProject } from '../core/project-io';
export { readFile } from './file-utils';
import { displayName } from './labels';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { command } from '../core/command-system';
import {
  activeComposition,
  createComposition,
  createDefaultProject,
} from '../core/project-model';
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
  const { tool, setSpace } = useTools();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const actionContext = useRef<FocusContext>('global');
  useEffect(() => {
    const remember = (event: Event) => {
      const context = focusContext(event.target);
      if (!['global', 'text', 'numeric'].includes(context))
        actionContext.current = context;
    };
    window.addEventListener('pointerdown', remember, true);
    window.addEventListener('focusin', remember, true);
    return () => {
      window.removeEventListener('pointerdown', remember, true);
      window.removeEventListener('focusin', remember, true);
    };
  }, []);

  const view = useEditorSlice(store, [
    'project',
    'selection',
    'frames',
    'selectedProperties',
    'graphSelection',
  ]);
  const c = activeComposition(view.project);
  const openRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const importAsLayer = useRef(false);
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
  const [helpOpen, setHelpOpen] = useState<'help' | 'shortcuts' | 'about'>();
  const nudgeGroup = useRef<
    { id: string; selection: string; time: number } | undefined
  >(undefined);
  const registry: Shortcut[] = [
    {
      id: 'new-project',
      label: '新建工程',
      key: 'n',
      modifier: true,
      inInput: true,
      action: () => execute('new'),
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
      action: () => execute('save'),
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
      action: () => execute('undo'),
    },
    {
      id: 'redo',
      label: '重做',
      key: 'z',
      modifier: true,
      shift: true,
      action: () => execute('redo'),
    },
    {
      id: 'redo-alt',
      label: '重做',
      key: 'y',
      modifier: true,
      action: () => execute('redo'),
    },
    {
      id: 'cut',
      label: '剪切',
      key: 'x',
      modifier: true,
      action: () => execute('cut'),
    },
    {
      id: 'open-graph',
      label: '曲线编辑器',
      key: 'f3',
      shift: true,
      action: () => execute('graph'),
    },
    {
      id: 'copy',
      label: '复制',
      key: 'c',
      modifier: true,
      action: () => execute('copy'),
    },
    {
      id: 'paste',
      label: '粘贴',
      key: 'v',
      modifier: true,
      action: () => execute('paste'),
    },
    {
      id: 'duplicate',
      label: '复制选中',
      key: 'd',
      modifier: true,
      action: () => execute('duplicate'),
    },
    {
      id: 'all',
      label: '全选',
      key: 'a',
      modifier: true,
      action: (_, context) => {
        actionContext.current = context;
        execute('select-all');
      },
    },
    ...tools.map((tool) => ({
      id: tool.id,
      label: tool.label,
      key: tool.key.toLowerCase(),
      contexts: ['canvas', 'layers', 'global'] as const,
      action: () => execute(`tool-${tool.id}`),
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
      label: `筛选 ${{ position: '位置', scale: '缩放', rotation: '旋转', opacity: '透明度', animated: '已有动画' }[filter]}`,
      key,
      contexts: ['timeline'] as const,
      action: () => store.setPropertyFilter(filter),
    })),
    ...(
      [
        ['j', 'previous'],
        ['k', 'next'],
      ] as const
    ).map(([key, direction]) => ({
      id: `timeline-${direction}-key`,
      label: direction === 'previous' ? '上一个关键帧' : '下一个关键帧',
      key,
      contexts: ['timeline'] as const,
      action: () => window.dispatchEvent(new Event(`motion:${direction}-key`)),
    })),
    ...['delete', 'backspace'].map((key) => ({
      id: key,
      label: '删除选中',
      key,
      action: () => execute('delete'),
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
    ...[
      { key: '0', label: '适合窗口', event: 'motion:fit' },
      { key: '1', label: '100% 实际尺寸', event: 'motion:actual-size' },
      { key: '=', label: '放大', event: 'motion:zoom-in' },
      { key: '-', label: '缩小', event: 'motion:zoom-out' },
    ].map((item) => ({
      id: item.event,
      label: item.label,
      key: item.key,
      modifier: true,
      action: () => window.dispatchEvent(new Event(item.event)),
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
          } else {
            const previous = nudgeGroup.current;
            const startId = store.commands.undoStack.at(-1)?.transaction.id;
            store.nudge(
              key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0,
              key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0,
            );
            const nextId = store.commands.undoStack.at(-1)?.transaction.id;
            const selection = store.getSnapshot().selection.join(',');
            const time = store.getSnapshot().time;
            if (nextId && nextId !== startId) {
              const merged =
                event.repeat &&
                !!previous &&
                previous.id === startId &&
                previous.selection === selection &&
                previous.time === time &&
                store.commands.coalesceRecent(previous.id, nextId);
              nudgeGroup.current = {
                id: merged ? previous!.id : nextId,
                selection,
                time,
              };
            }
          }
        },
      })),
    ),
  ];
  const handleShortcut = useEffectEvent((event: KeyboardEvent) =>
    dispatchShortcut(event, registry),
  );
  useEffect(() => {
    const handler = (event: KeyboardEvent) => handleShortcut(event);
    const release = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpace(false);
      if (event.key.startsWith('Arrow')) nudgeGroup.current = undefined;
    };
    const blur = () => {
      setSpace(false);
      nudgeGroup.current = undefined;
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', release);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', blur);
    };
  }, []);
  useEffect(() => {
    const open = () => setExportOpen(true);
    window.addEventListener('motion:export', open);
    return () => window.removeEventListener('motion:export', open);
  }, []);
  const composeDialog = (editing: boolean) => {
    const live = activeComposition(store.getSnapshot().project);
    setEditingComposition(editing);
    setSettings(
      editing
        ? {
            name: live.name,
            width: live.width,
            height: live.height,
            fps: live.fps,
            duration: live.duration,
          }
        : {
            name: `合成 ${String(store.getSnapshot().project.compositions.length + 1).padStart(2, '0')}`,
            width: 1920,
            height: 1080,
            fps: 30,
            duration: 5,
          },
    );
    setNewDialog(true);
  };
  const uiActions = {
    new: newProject,
    open: () => {
      const service = getProjectService(store);
      if (service) void service.open();
      else openRef.current?.click();
    },
    save: () => downloadProject(store),
    'save-as': () => {
      const service = getProjectService(store);
      if (service) void service.save(true);
      else downloadProject(store);
    },
    'new-composition': () => composeDialog(false),
    'composition-settings': () => composeDialog(true),
    'create-image': () => {
      importAsLayer.current = true;
      if (desktopService.native) void importNativeAssets(store);
      else imageRef.current?.click();
    },
    import: () => {
      importAsLayer.current = false;
      window.dispatchEvent(new Event('motion:show-project'));
      if (desktopService.native) void importNativeAssets(store, false);
      else imageRef.current?.click();
    },
    export: () => setExportOpen(true),
    settings: () => window.dispatchEvent(new Event('swayframe:ai-settings')),
    palette: () => setPaletteOpen(true),
    help: () => setHelpOpen('help' as const),
    shortcuts: () => setHelpOpen('shortcuts' as const),
    about: () => setHelpOpen('about' as const),
  };
  const commands = editorCommands(
    store,
    uiActions,
    () => actionContext.current,
  );
  const actions = commands.definitions().map((action) => {
    const feature = features.get(action.id);
    return {
      ...commands.entry(action.id)!,
      id: action.id,
      label: feature?.title ?? action.label,
      keywords: [
        feature?.domain,
        ...(feature?.objectTypes ?? []),
        ...(feature?.keywords ?? []),
      ].join(' '),
      action: () => {
        commands.execute(action.id);
      },
    };
  });
  const execute = useEffectEvent((id: string) => {
    if (!commands.execute(id))
      store.setStatus('请先选择适用的对象、属性或关键帧');
  });
  useEffect(() => {
    const handler = (event: Event) =>
      execute((event as CustomEvent<string>).detail);
    window.addEventListener('motion:editor-action', handler);
    return () => window.removeEventListener('motion:editor-action', handler);
  }, []);
  const paletteCommands = actions.filter((a) => !a.children);
  const importImage = async (file?: File) => {
    if (!file) return;
    try {
      await importImageFile(store, file, importAsLayer.current);
    } catch (error) {
      store.setStatus(
        error instanceof Error ? error.message : '图片导入失败',
        true,
      );
    }
  };

  return (
    <>
      <ModelImportInput store={store} />
      {paletteOpen && (
        <CommandPalette
          commands={paletteCommands}
          context={contextKeys(view, actionContext.current)}
          onClose={() => setPaletteOpen(false)}
        />
      )}
      <header className="topbar">
        <span className="application-name">
          <img
            src="./branding/wordmark.png"
            alt="Swayframe"
            draggable={false}
          />
        </span>
        <ApplicationMenus actions={actions} />
        <div className="project-title">
          {displayName(c.name)}
          <span>{displayName(view.project.name)}</span>
        </div>
        <div className="file-actions">
          {contributionItems(
            'toolbar.global',
            commands,
            contextKeys(view, actionContext.current),
          ).map((item) => {
            const feature = features.all().find((f) => f.title === item.label)!;
            return feature.id === 'export' ? (
              <button
                key={feature.id}
                className="toolbar-action"
                onClick={item.action}
              >
                <Icon name="export" />
                导出
              </button>
            ) : (
              <IconButton
                key={feature.id}
                label={item.label}
                shortcut={feature.shortcut}
                disabled={item.disabled}
                onClick={item.action}
              >
                <Icon name={feature.icon as IconName} />
              </IconButton>
            );
          })}
        </div>
      </header>
      <div className="editor-tool-strip">
        <ToolButtons />
        <span className="tool-context">
          {tools.find((item) => item.id === tool)?.label}
        </span>
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
      {helpOpen && (
        <HelpModal onClose={() => setHelpOpen(undefined)}>
          <section
            className="new-dialog entry-help"
            role="dialog"
            aria-label={
              helpOpen === 'help'
                ? '操作指引'
                : helpOpen === 'shortcuts'
                  ? '快捷键'
                  : '关于 Swayframe'
            }
          >
            <h2>
              {helpOpen === 'help'
                ? '操作指引'
                : helpOpen === 'shortcuts'
                  ? '快捷键'
                  : `Swayframe ${ProductMetadata.version}`}
            </h2>
            {helpOpen === 'help' ? (
              <dl>
                <dt>项目</dt>
                <dd>合成、素材与导入；双击合成打开。</dd>
                <dt>图层</dt>
                <dd>
                  “创建对象”添加图层；对象右键进行父级、预合成和结构操作。
                </dd>
                <dt>画布 / 属性</dt>
                <dd>
                  画布绘制和变换；右侧修改属性，秒表开启动画，菱形记录当前时刻。
                </dd>
                <dt>时间轴 / 曲线</dt>
                <dd>
                  底部编辑时间与关键帧；关键帧右键设置缓动，标签切换曲线和节点。
                </dd>
                <dt>效果 / 合成节点</dt>
                <dd>属性中的“效果与遮罩”添加效果，可直接打开合成节点。</dd>
                <dt>助手 / 设置</dt>
                <dd>助手处理 AI 任务；文件 → 设置 · AI 配置服务。</dd>
                <dt>搜索 / 导出</dt>
                <dd>Cmd/Ctrl+K 搜索操作；文件 → 导出或右上角导出。</dd>
              </dl>
            ) : helpOpen === 'shortcuts' ? (
              <table>
                <tbody>
                  {registry
                    .filter(
                      (a) =>
                        !a.id.startsWith('nudge-') && !a.id.endsWith('alt'),
                    )
                    .map((a) => (
                      <tr key={a.id}>
                        <td>{a.label}</td>
                        <td>
                          <kbd>
                            {a.modifier ? 'Cmd/Ctrl+' : ''}
                            {a.shift ? 'Shift+' : ''}
                            {a.key.toUpperCase()}
                          </kbd>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p>
                本地动效创作编辑器 · 工程与动画操作支持撤销。当前版本{' '}
                {ProductMetadata.version}。
              </p>
            )}
            <button onClick={() => setHelpOpen(undefined)}>关闭</button>
          </section>
        </HelpModal>
      )}
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
              画面预设
              <select
                aria-label="合成分辨率预设"
                value={
                  resolutionPresets.find(
                    (p) =>
                      p.width === settings.width &&
                      p.height === settings.height,
                  )?.id ?? 'custom'
                }
                onChange={(e) => {
                  const p = resolutionPresets.find(
                    (p) => p.id === e.target.value,
                  );
                  if (p)
                    setSettings({
                      ...settings,
                      width: p.width,
                      height: p.height,
                    });
                }}
              >
                <option value="custom">自定义尺寸</option>
                {resolutionPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} · {p.width} × {p.height}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              帧率预设
              <select
                aria-label="合成帧率预设"
                value={
                  frameRates.includes(settings.fps) ? settings.fps : 'custom'
                }
                onChange={(e) => {
                  if (e.target.value !== 'custom')
                    setSettings({ ...settings, fps: Number(e.target.value) });
                }}
              >
                <option value="custom">自定义帧率</option>
                {frameRates.map((f) => (
                  <option key={f} value={f}>
                    {f} fps
                  </option>
                ))}
              </select>
            </label>
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
                    step={key === 'duration' ? 0.1 : key === 'fps' ? 0.001 : 1}
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
  const { tool } = useTools();
  return (
    <div className="tool-buttons" role="toolbar" aria-label="绘图工具">
      {features
        .contributions('toolbar.canvas')
        .map((feature) => tools.find((t) => `tool-${t.id}` === feature.id)!)
        .filter(Boolean)
        .map((item) => (
          <IconButton
            key={item.id}
            label={item.label}
            shortcut={item.key}
            aria-pressed={tool === item.id}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('motion:editor-action', {
                  detail: `tool-${item.id}`,
                }),
              )
            }
          >
            <Icon name={item.icon} />
          </IconButton>
        ))}
    </div>
  );
}
