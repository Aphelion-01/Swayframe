import { LayerAccentChip } from './LayerAccentChip';
import { Icon } from './workspace/icons';
import { useEditorSlice } from './use-editor-slice';
import { AssetsPanel } from './AssetsPanel';
import { displayName } from './labels';
import { useEffect, useRef, useState } from 'react';
import { command } from '../core/command-system';
import { activeComposition } from '../core/project-model';
import type { EditorStore } from './editor-store';
import { AgentPanel } from './AgentPanel';
import { ProposalPanel } from './ProposalPanel';
import { ContextMenu, IconButton, Tabs } from './workspace/primitives';
import { layerActions } from './workspace/layer-actions';
export function LayerPanel({ store }: { store: EditorStore }) {
  const view = useEditorSlice(store, ['project', 'selection']),
    c = activeComposition(view.project);
  const [tab, setTab] = useState(() =>
      ['项目', '图层', '助手'].includes(
        localStorage.getItem('motion.active-left') ?? '',
      )
        ? localStorage.getItem('motion.active-left')!
        : '图层',
    ),
    [renaming, setRenaming] = useState<string>(),
    [name, setName] = useState(''),
    [menu, setMenu] = useState<{ x: number; y: number }>();
  const dragging = useRef<string | undefined>(undefined);
  const rename = () => {
    const layer = c.layers.find(
      (l) => l.id === store.getSnapshot().selection[0],
    );
    if (layer) {
      setRenaming(layer.id);
      setName(layer.name);
    }
  };
  useEffect(() => {
    window.addEventListener('motion:rename', rename);
    return () => window.removeEventListener('motion:rename', rename);
  });
  useEffect(() => {
    const row = document.querySelector('.layer-row.selected');
    row?.scrollIntoView?.({ block: 'nearest' });
  }, [view.selection]);
  useEffect(() => {
    const open = () => {
      setTab('助手');
      localStorage.setItem('motion.active-left', '助手');
      window.dispatchEvent(new Event('motion:show-left'));
    };
    window.addEventListener('motion:assistant', open);
    return () => window.removeEventListener('motion:assistant', open);
  }, []);
  const items = layerActions(store, rename);
  const finishRename = () => {
    if (renaming && name.trim())
      store.run('重命名图层', [
        command({
          type: 'layer.patch',
          compositionId: c.id,
          layerId: renaming,
          patch: { name: name.trim() },
        }),
      ]);
    setRenaming(undefined);
  };
  return (
    <aside className="layers-panel" aria-label="图层面板" tabIndex={0}>
      <Tabs
        items={['项目', '图层', '助手']}
        value={tab}
        onChange={(tab) => {
          setTab(tab);
          localStorage.setItem('motion.active-left', tab);
        }}
      />
      <div className="left-panel-content">
        {tab === '项目' ? (
          <>
            <div className="panel-heading">
              <h2>项目</h2>
            </div>
            <div className="composition-list">
              {view.project.compositions.map((comp) => (
                <button
                  key={comp.id}
                  title="双击打开合成"
                  aria-pressed={c.id === comp.id}
                  onDoubleClick={() => {
                    store.cancelDrag();
                    store.setPlaying(false);
                    store.select(null);
                    store.run('切换合成', [
                      command({
                        type: 'project.activate',
                        compositionId: comp.id,
                      }),
                    ]);
                  }}
                >
                  <Icon name="comp" /> {comp.name}
                </button>
              ))}
            </div>
            <AssetsPanel store={store} />
          </>
        ) : tab === '助手' ? null : (
          <>
            <div className="panel-heading">
              <h2>
                图层 <span className="count">{c.layers.length}</span>
              </h2>
              <IconButton
                label="图层操作"
                onClick={(event) => {
                  const r = event.currentTarget.getBoundingClientRect();
                  setMenu({ x: r.left, y: r.bottom });
                }}
              >
                <Icon name="more" />
              </IconButton>
            </div>
            {!c.layers.length && (
              <div className="empty-note">
                <p>在画布上绘制或导入素材</p>
              </div>
            )}
            <div className="layer-list">
              {[...c.layers].reverse().map((layer) => (
                <div
                  key={layer.id}
                  className={`layer-row ${view.selection.includes(layer.id) ? 'selected' : ''}`}
                  draggable={!renaming}
                  onDragStart={(event) => {
                    dragging.current = layer.id;
                    event.dataTransfer.setData(
                      'application/x-motion-layer',
                      layer.id,
                    );
                  }}
                  onDragOver={(event) => {
                    if (dragging.current) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!dragging.current) return;
                    event.preventDefault();
                    event.stopPropagation();
                    store.run('调整图层顺序', [
                      command({
                        type: 'layer.reorder',
                        compositionId: c.id,
                        layerId: dragging.current,
                        toIndex: c.layers.findIndex((l) => l.id === layer.id),
                      }),
                    ]);
                    dragging.current = undefined;
                  }}
                  onDragEnd={() => {
                    dragging.current = undefined;
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (!view.selection.includes(layer.id))
                      store.select(layer.id);
                    setMenu({ x: event.clientX, y: event.clientY });
                  }}
                >
                  <IconButton
                    label={`${layer.visible ? '隐藏' : '显示'} ${displayName(layer.name)}`}
                    onClick={() =>
                      store.run('切换图层可见性', [
                        command({
                          type: 'layer.patch',
                          compositionId: c.id,
                          layerId: layer.id,
                          patch: { visible: !layer.visible },
                        }),
                      ])
                    }
                  >
                    <Icon name={layer.visible ? 'eye' : 'eye-off'} />
                  </IconButton>
                  <IconButton
                    label={`${layer.locked ? '解锁' : '锁定'} ${displayName(layer.name)}`}
                    aria-pressed={layer.locked}
                    onClick={() =>
                      store.run('切换图层锁定', [
                        command({
                          type: 'layer.patch',
                          compositionId: c.id,
                          layerId: layer.id,
                          patch: { locked: !layer.locked },
                        }),
                      ])
                    }
                  >
                    <Icon name={layer.locked ? 'lock' : 'unlock'} />
                  </IconButton>
                  {renaming === layer.id ? (
                    <input
                      autoFocus
                      aria-label="重命名图层"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      onBlur={finishRename}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === 'Enter') finishRename();
                        if (event.key === 'Escape') setRenaming(undefined);
                      }}
                    />
                  ) : (
                    <button
                      className="layer-select"
                      aria-label={`选择 ${displayName(layer.name)}`}
                      aria-pressed={view.selection.includes(layer.id)}
                      onClick={(event) =>
                        store.select(
                          layer.id,
                          event.shiftKey || event.metaKey || event.ctrlKey,
                        )
                      }
                      onDoubleClick={() => {
                        store.select(layer.id);
                        setRenaming(layer.id);
                        setName(layer.name);
                      }}
                    >
                      <LayerAccentChip layer={layer} />
                      <span className="layer-symbol">
                        <Icon
                          name={
                            layer.type === 'text'
                              ? 'text'
                              : layer.type === 'image'
                                ? 'image'
                                : layer.type === 'precomp'
                                  ? 'comp'
                                  : layer.type === 'null'
                                    ? 'null'
                                    : layer.type === 'camera'
                                      ? 'camera'
                                      : layer.type === 'shape' &&
                                          layer.shapeKind === 'ellipse'
                                        ? 'ellipse'
                                        : 'rectangle'
                          }
                        />
                      </span>
                      <span>{displayName(layer.name)}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="assistant-workspace" hidden={tab !== '助手'}>
          <div className="panel-heading">
            <h2>创作助手</h2>
            <span className="metadata">当前工程</span>
          </div>
          <AgentPanel store={store} />
          <ProposalPanel store={store} />
        </div>
      </div>
      {menu && (
        <ContextMenu
          items={items}
          {...menu}
          onClose={() => setMenu(undefined)}
        />
      )}
    </aside>
  );
}
