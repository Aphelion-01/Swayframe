import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Vec2 } from '../core/core-types';
import { activeComposition } from '../core/project-model';
import type { Layer } from '../core/project-model';
import type {
  CompositingGraph,
  GraphNode,
  PortRef,
} from '../core/compositing-graph';
import { graphCommand } from '../core/compositing-commands';
import { compileGraph } from '../core/compositing-compiler';
import { migrateLayerGraph } from '../core/compositing-migration';
import { nodeDefinition, nodeDefinitions } from '../core/compositing-registry';
import {
  connectPorts,
  deleteGraphNodes,
  disconnectEdge,
  duplicateGraphNodes,
  insertGraphNode,
  patchGraphNode,
} from '../core/compositing-operations';
import { evaluateProperty } from '../core/animation-engine';
import { ContextMenu } from './workspace/primitives';
import { dispatchShortcut } from './workspace/shortcuts';
import type { Shortcut } from './workspace/shortcuts';
import { useInteractionCancel } from './workspace/interaction';
import type { EditorStore } from './editor-store';
import './compositing-graph.css';
const width = 180;
function portPoint(
  node: GraphNode,
  id: string,
  side: 'input' | 'output',
): Vec2 {
  return {
    x: node.position.x + (side === 'output' ? width : 0),
    y:
      node.position.y +
      48 +
      Math.max(
        0,
        (side === 'input' ? node.inputs : node.outputs).findIndex(
          (p) => p.id === id,
        ),
      ) *
        26,
  };
}
const path = (a: Vec2, b: Vec2) =>
  `M ${a.x} ${a.y} C ${a.x + Math.max(60, Math.abs(b.x - a.x) / 2)} ${a.y},${b.x - Math.max(60, Math.abs(b.x - a.x) / 2)} ${b.y},${b.x} ${b.y}`;
type Viewport = { x: number; y: number; zoom: number };
type Drag = {
  start: Vec2;
  graph: CompositingGraph;
  kind: 'move' | 'pan' | 'marquee' | 'connect';
  ids: readonly string[];
  viewport: Viewport;
  from?: PortRef;
  type?: string;
  end: Vec2;
};
export function CompositingGraphPanel({ store }: { store: EditorStore }) {
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot),
    layer = activeComposition(view.project).layers.find(
      (l) => l.id === view.selection[0],
    );
  if (!layer) return <div className="cg-empty">选择图层以编辑合成节点</div>;
  if (!layer.editor?.graph)
    return (
      <div className="cg-empty">
        <button
          onClick={() => {
            const migrated = migrateLayerGraph(layer);
            if (migrated.editor?.graph)
              store.run('创建合成节点图', [
                graphCommand(view.project, layer.id, migrated.editor.graph),
              ]);
          }}
        >
          创建合成节点图
        </button>
      </div>
    );
  return (
    <GraphWorkspace
      key={layer.id}
      store={store}
      layer={layer}
      graph={layer.editor.graph}
    />
  );
}
function GraphWorkspace({
  store,
  layer,
  graph,
}: {
  store: EditorStore;
  layer: Layer;
  graph: CompositingGraph;
}) {
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const viewportRef = useRef<HTMLDivElement>(null),
    space = useRef(false),
    drag = useRef<Drag | undefined>(undefined);
  const [viewport, setViewport] = useState<Viewport>(() => {
    try {
      const p = JSON.parse(
        localStorage.getItem('swayframe.graph.viewport.' + graph.id) ?? 'null',
      );
      if (
        p &&
        [p.x, p.y, p.zoom].every(Number.isFinite) &&
        p.zoom >= 0.2 &&
        p.zoom <= 2.5
      )
        return p;
    } catch {
      /* Default view */
    }
    return { x: 0, y: 0, zoom: 0.8 };
  });
  const [preview, setPreview] = useState<CompositingGraph>(),
    [gesture, setGesture] = useState<Drag>();
  const [edgeSelection, setEdgeSelection] = useState<string>(),
    [menu, setMenu] = useState<{
      x: number;
      y: number;
      edgeId?: string;
      nodeId?: string;
    }>();
  const [search, setSearch] = useState<{
      x: number;
      y: number;
      position?: Vec2;
      edgeId?: string;
    }>(),
    [query, setQuery] = useState(''),
    [choice, setChoice] = useState(0);
  const selected =
      view.graphSelection?.layerId === layer.id
        ? view.graphSelection.nodeIds
        : [],
    display = preview ?? graph;
  const diagnostics = compileGraph(graph).diagnostics;
  const [runtimeErrors, setRuntimeErrors] = useState<
    readonly { nodeId?: string; message: string }[]
  >([]);
  const [rename, setRename] = useState<{ id: string; name: string }>();
  const status = (error: unknown) =>
    store.setStatus(
      error instanceof Error ? error.message : '节点操作失败',
      true,
    );
  const commit = (label: string, next: CompositingGraph) => {
    try {
      return store.run(label, [
        graphCommand(store.getSnapshot().project, layer.id, next),
      ]);
    } catch (error) {
      status(error);
      return { ok: false };
    }
  };
  const selection = (ids: readonly string[]) => {
    store.selectGraphNodes(layer.id, ids);
    setEdgeSelection(undefined);
  };
  const editableIds = selected.filter(
    (id) =>
      !nodeDefinition(graph.nodes.find((n) => n.id === id)?.type ?? '')
        ?.protected,
  );
  const remove = () => {
    try {
      if (edgeSelection)
        commit('断开节点连线', disconnectEdge(graph, edgeSelection));
      else if (editableIds.length)
        commit('删除合成节点', deleteGraphNodes(graph, editableIds));
      else store.setStatus('Source 与 Output 受到保护');
      selection([]);
    } catch (error) {
      status(error);
    }
  };
  const duplicate = () => {
    try {
      if (!editableIds.length) return;
      const copy = duplicateGraphNodes(graph, editableIds);
      if (commit('复制合成节点', copy.graph).ok) selection(copy.ids);
    } catch (error) {
      status(error);
    }
  };
  const localPoint = (x: number, y: number) => {
    const rect = viewportRef.current!.getBoundingClientRect();
    return {
      x: (x - rect.left - viewport.x) / viewport.zoom,
      y: (y - rect.top - viewport.y) / viewport.zoom,
    };
  };
  const fit = () => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(...graph.nodes.map((n) => n.position.x)),
      y = Math.min(...graph.nodes.map((n) => n.position.y));
    const w = Math.max(...graph.nodes.map((n) => n.position.x + width)) - x,
      h =
        Math.max(
          ...graph.nodes.map(
            (n) =>
              n.position.y +
              80 +
              Math.max(n.inputs.length, n.outputs.length) * 26,
          ),
        ) - y;
    const zoom = Math.max(
      0.2,
      Math.min(1.2, (rect.width - 48) / w, (rect.height - 32) / h),
    );
    setViewport({ x: 24 - x * zoom, y: 16 - y * zoom, zoom });
  };
  const openSearch = (x?: number, y?: number, edgeId?: string) => {
    const rect = viewportRef.current!.getBoundingClientRect();
    const cx = x ?? rect.left + rect.width / 2,
      cy = y ?? rect.top + rect.height / 2;
    setSearch({
      x: cx,
      y: cy,
      position:
        x === undefined && y === undefined ? undefined : localPoint(cx, cy),
      edgeId,
    });
    setQuery('');
    setChoice(0);
    setMenu(undefined);
  };
  const registry: Shortcut[] = [
    {
      id: 'cg-tab',
      label: '添加节点',
      key: 'tab',
      contexts: ['compositing'],
      action: () => openSearch(),
    },
    ...['f', 'home'].map((key) => ({
      id: 'cg-fit-' + key,
      label: '适应节点图',
      key,
      contexts: ['compositing'] as const,
      action: fit,
    })),
    ...['delete', 'backspace'].map((key) => ({
      id: 'cg-delete-' + key,
      label: '删除节点',
      key,
      contexts: ['compositing'] as const,
      action: remove,
    })),
    {
      id: 'cg-duplicate',
      label: '复制节点',
      key: 'd',
      modifier: true,
      contexts: ['compositing'],
      action: duplicate,
    },
    {
      id: 'cg-pan',
      label: '平移节点图',
      key: 'space',
      contexts: ['compositing'],
      action: () => {
        space.current = true;
      },
    },
  ];
  const cancel = () => {
    drag.current = undefined;
    setPreview(undefined);
    setGesture(undefined);
    setSearch(undefined);
    setRename(undefined);
    space.current = false;
  };
  useInteractionCancel(cancel);
  useEffect(() => {
    try {
      localStorage.setItem(
        'swayframe.graph.viewport.' + graph.id,
        JSON.stringify(viewport),
      );
    } catch {
      /* Preferences remain optional. */
    }
  }, [viewport, graph.id]);
  useEffect(() => {
    const changed = () => {
      drag.current = undefined;
      setPreview(undefined);
      setGesture(undefined);
      setRuntimeErrors([]);
    };
    return store.commands.subscribe(changed);
  }, [store]);
  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.graphId === graph.id) setRuntimeErrors(detail.diagnostics);
    };
    window.addEventListener('motion:graph-errors', handle);
    return () => window.removeEventListener('motion:graph-errors', handle);
  }, [graph.id]);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left,
        y = e.clientY - rect.top;
      setViewport((v) => {
        const zoom = Math.max(
          0.2,
          Math.min(2.5, v.zoom * Math.exp(-e.deltaY * 0.002)),
        );
        return {
          x: x - ((x - v.x) * zoom) / v.zoom,
          y: y - ((y - v.y) * zoom) / v.zoom,
          zoom,
        };
      });
    };
    const release = () => {
      space.current = false;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keyup', release);
    window.addEventListener('blur', cancel);
    return () => {
      el.removeEventListener('wheel', wheel);
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', cancel);
    };
  }, []);
  const capture = (event: ReactPointerEvent) => {
    viewportRef.current?.focus();
    viewportRef.current?.setPointerCapture?.(event.pointerId);
  };
  const startMove = (event: ReactPointerEvent, node: GraphNode) => {
    if (event.button !== 0 || space.current) return;
    if ((event.target as Element).closest('button,input')) return;
    event.stopPropagation();
    capture(event);
    const ids = event.shiftKey
      ? [...new Set([...selected, node.id])]
      : selected.includes(node.id)
        ? selected
        : [node.id];
    selection(ids);
    drag.current = {
      kind: 'move',
      start: { x: event.clientX, y: event.clientY },
      end: { x: event.clientX, y: event.clientY },
      graph,
      ids,
      viewport,
    };
  };
  const finish = (event: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    drag.current = undefined;
    setGesture(undefined);
    setPreview(undefined);
    if (
      d.graph !==
      store
        .getSnapshot()
        .project.compositions.flatMap((c) => c.layers)
        .find((l) => l.id === layer.id)?.editor?.graph
    )
      return;
    try {
      if (d.kind === 'move') {
        const dx = (d.end.x - d.start.x) / d.viewport.zoom,
          dy = (d.end.y - d.start.y) / d.viewport.zoom;
        if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
        let next = graph;
        for (const id of d.ids) {
          const n = graph.nodes.find((n) => n.id === id)!;
          next = patchGraphNode(next, id, {
            position: { x: n.position.x + dx, y: n.position.y + dy },
          });
        }
        commit('移动合成节点', next);
      } else if (d.kind === 'connect') {
        const hit = (document.elementFromPoint?.(
          event.clientX,
          event.clientY,
        ) ?? event.target) as Element;
        const port = hit?.closest<HTMLElement>('[data-cg-port]');
        if (port?.dataset.side === 'input' && d.from)
          commit(
            '连接节点端口',
            connectPorts(graph, d.from, {
              nodeId: port.dataset.node!,
              portId: port.dataset.cgPort!,
            }),
          );
      } else if (d.kind === 'marquee') {
        const a = localPoint(d.start.x, d.start.y),
          b = localPoint(d.end.x, d.end.y);
        selection([
          ...new Set([
            ...d.ids,
            ...graph.nodes
              .filter(
                (n) =>
                  n.position.x + width >= Math.min(a.x, b.x) &&
                  n.position.x <= Math.max(a.x, b.x) &&
                  n.position.y + 100 >= Math.min(a.y, b.y) &&
                  n.position.y <= Math.max(a.y, b.y),
              )
              .map((n) => n.id),
          ]),
        ]);
      }
    } catch (error) {
      status(error);
    }
  };
  const candidates = nodeDefinitions().filter(
    (d) =>
      !d.protected &&
      (d.title + d.type + d.category)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const add = (type: string) => {
    if (!search) return;
    try {
      const outgoing =
        selected.length === 1
          ? graph.edges.find((e) => e.from.nodeId === selected[0])
          : undefined;
      const inserted = insertGraphNode(
        graph,
        type,
        search.edgeId ?? outgoing?.id,
        search.position,
      );
      if (commit('插入合成节点', inserted.graph).ok)
        selection([inserted.node.id]);
      setSearch(undefined);
    } catch (error) {
      status(error);
    }
  };
  return (
    <section
      className="compositing-graph"
      aria-label="合成节点编辑器"
      onKeyDown={(e) => {
        if (dispatchShortcut(e.nativeEvent, registry)) e.preventDefault();
      }}
    >
      <div className="cg-toolbar">
        <span>{layer.name} · 图层合成</span>
        <button onClick={() => openSearch()}>＋ 添加节点</button>
        <button onClick={fit}>适应视图</button>
        <span>{Math.round(viewport.zoom * 100)}%</span>
        <small>Tab 添加 · 空格拖动平移 · 滚轮缩放</small>
      </div>
      <div
        className="cg-viewport"
        ref={viewportRef}
        tabIndex={0}
        aria-label="节点画布"
        onContextMenu={(e) => {
          e.preventDefault();
          const el = e.target as Element;
          const node =
              el.closest<HTMLElement>('[data-cg-node]')?.dataset.cgNode,
            edge = el.closest<SVGElement>('[data-cg-edge]')?.dataset.cgEdge;
          if (node && !selected.includes(node)) selection([node]);
          setMenu({ x: e.clientX, y: e.clientY, nodeId: node, edgeId: edge });
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.button !== 1) return;
          const el = e.target as Element;
          if (
            !space.current &&
            e.button !== 1 &&
            el.closest('[data-cg-node],[data-cg-edge],button,input')
          )
            return;
          capture(e);
          e.preventDefault();
          const kind = space.current || e.button === 1 ? 'pan' : 'marquee';
          if (kind === 'marquee' && !e.shiftKey) selection([]);
          drag.current = {
            kind,
            start: { x: e.clientX, y: e.clientY },
            end: { x: e.clientX, y: e.clientY },
            graph,
            ids: e.shiftKey ? selected : [],
            viewport,
          };
          setGesture(drag.current);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          d.end = { x: e.clientX, y: e.clientY };
          setGesture({ ...d });
          const dx = (e.clientX - d.start.x) / d.viewport.zoom,
            dy = (e.clientY - d.start.y) / d.viewport.zoom;
          if (d.kind === 'pan')
            setViewport({
              ...d.viewport,
              x: d.viewport.x + e.clientX - d.start.x,
              y: d.viewport.y + e.clientY - d.start.y,
            });
          if (d.kind === 'move')
            setPreview({
              ...graph,
              nodes: graph.nodes.map((n) =>
                d.ids.includes(n.id)
                  ? {
                      ...n,
                      position: { x: n.position.x + dx, y: n.position.y + dy },
                    }
                  : n,
              ),
            });
        }}
        onPointerUp={finish}
        onPointerCancel={cancel}
      >
        <div
          className="cg-world"
          style={{
            transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})`,
          }}
        >
          <svg className="cg-edges" aria-label="节点连线">
            {display.edges.map((edge) => {
              const a = display.nodes.find((n) => n.id === edge.from.nodeId),
                b = display.nodes.find((n) => n.id === edge.to.nodeId);
              if (!a || !b) return null;
              const d = path(
                portPoint(a, edge.from.portId, 'output'),
                portPoint(b, edge.to.portId, 'input'),
              );
              return (
                <g key={edge.id}>
                  <path
                    className={edgeSelection === edge.id ? 'selected' : ''}
                    d={d}
                  />
                  <path
                    data-cg-edge={edge.id}
                    className="cg-edge-hit"
                    d={d}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      selection([]);
                      setEdgeSelection(edge.id);
                      viewportRef.current?.focus();
                    }}
                    onDoubleClick={() =>
                      openSearch(undefined, undefined, edge.id)
                    }
                  />
                </g>
              );
            })}
            {gesture?.kind === 'connect' && gesture.from && (
              <path
                className="cg-connection"
                d={path(
                  portPoint(
                    display.nodes.find((n) => n.id === gesture.from!.nodeId)!,
                    gesture.from.portId,
                    'output',
                  ),
                  localPoint(gesture.end.x, gesture.end.y),
                )}
              />
            )}
          </svg>
          {display.nodes.map((node) => {
            const def = nodeDefinition(node.type),
              errors = [...diagnostics, ...runtimeErrors].filter(
                (e) => e.nodeId === node.id,
              ),
              parameter = Object.entries(node.params)[0],
              rows = Math.max(node.inputs.length, node.outputs.length);
            return (
              <article
                key={node.id}
                data-cg-node={node.id}
                className={`cg-node ${selected.includes(node.id) ? 'selected' : ''} ${node.enabled ? '' : 'disabled'} ${errors.length ? 'invalid' : ''}`}
                style={{ left: node.position.x, top: node.position.y, width }}
                onPointerDown={(e) => startMove(e, node)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!selected.includes(node.id))
                    selection(e.shiftKey ? [...selected, node.id] : [node.id]);
                }}
              >
                <header>
                  {rename?.id === node.id ? (
                    <input
                      autoFocus
                      aria-label="节点名称"
                      value={rename.name}
                      onChange={(e) =>
                        setRename({ ...rename, name: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commit(
                            '重命名节点',
                            patchGraphNode(graph, node.id, {
                              name: rename.name.trim() || node.name,
                            }),
                          );
                          setRename(undefined);
                        }
                      }}
                      onBlur={() => {
                        commit(
                          '重命名节点',
                          patchGraphNode(graph, node.id, {
                            name: rename.name.trim() || node.name,
                          }),
                        );
                        setRename(undefined);
                      }}
                    />
                  ) : (
                    <strong title={node.name}>{node.name}</strong>
                  )}
                  {def?.protected ? (
                    <span className="cg-protected">固定</span>
                  ) : (
                    <button
                      aria-label={`${node.enabled ? '禁用' : '启用'}节点 ${node.name}`}
                      title="启用 / 旁路"
                      onClick={(e) => {
                        e.stopPropagation();
                        commit(
                          '切换节点启用',
                          patchGraphNode(graph, node.id, {
                            enabled: !node.enabled,
                          }),
                        );
                      }}
                    >
                      {node.enabled ? '●' : '○'}
                    </button>
                  )}
                </header>
                {Array.from({ length: rows }, (_, i) => (
                  <div className="cg-port-row" key={i}>
                    {(['input', 'output'] as const).map((side) => {
                      const port = (
                        side === 'input' ? node.inputs : node.outputs
                      )[i];
                      return port ? (
                        <button
                          key={side}
                          data-cg-port={port.id}
                          data-node={node.id}
                          data-side={side}
                          data-type={port.type}
                          className={`cg-port ${side} ${gesture?.kind === 'connect' && side === 'input' ? (port.type === gesture.type ? 'compatible' : 'incompatible') : ''} ${display.edges.some((e) => (side === 'input' ? e.to.nodeId === node.id && e.to.portId === port.id : e.from.nodeId === node.id && e.from.portId === port.id)) ? 'connected' : ''}`}
                          aria-label={`${node.name} ${side === 'input' ? '输入' : '输出'} ${port.name}`}
                          title={`${port.type}${port.required ? ' · 必需' : ''}`}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            if (side !== 'output' || e.button !== 0) return;
                            capture(e);
                            const d: Drag = {
                              kind: 'connect',
                              start: { x: e.clientX, y: e.clientY },
                              end: { x: e.clientX, y: e.clientY },
                              graph,
                              ids: [],
                              viewport,
                              from: { nodeId: node.id, portId: port.id },
                              type: port.type,
                            };
                            drag.current = d;
                            setGesture(d);
                          }}
                        >
                          <i />
                          {port.name}
                        </button>
                      ) : (
                        <span key={side} />
                      );
                    })}
                  </div>
                ))}
                <footer>
                  {errors.length ? (
                    <span title={errors.map((e) => e.message).join('；')}>
                      ⚠ {errors[0]!.message}
                    </span>
                  ) : parameter ? (
                    <span>
                      {def?.params[parameter[0]]?.label ?? parameter[0]}：
                      {JSON.stringify(
                        evaluateProperty(parameter[1], view.time),
                      )}
                    </span>
                  ) : (
                    <span>{def?.category ?? node.type}</span>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
        {gesture?.kind === 'marquee' && (
          <div
            className="cg-marquee"
            style={{
              left:
                Math.min(gesture.start.x, gesture.end.x) -
                viewportRef.current!.getBoundingClientRect().left,
              top:
                Math.min(gesture.start.y, gesture.end.y) -
                viewportRef.current!.getBoundingClientRect().top,
              width: Math.abs(gesture.end.x - gesture.start.x),
              height: Math.abs(gesture.end.y - gesture.start.y),
            }}
          />
        )}
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(undefined)}
          items={
            menu.edgeId
              ? [
                  {
                    label: '在连线上插入节点',
                    action: () => openSearch(menu.x, menu.y, menu.edgeId),
                  },
                  {
                    label: '断开连线',
                    action: () =>
                      commit(
                        '断开节点连线',
                        disconnectEdge(graph, menu.edgeId!),
                      ),
                  },
                ]
              : menu.nodeId
                ? [
                    {
                      label: '重命名节点',
                      action: () => {
                        const n = graph.nodes.find(
                          (n) => n.id === menu.nodeId,
                        )!;
                        setRename({ id: n.id, name: n.name });
                      },
                    },
                    {
                      label: '复制节点',
                      action: duplicate,
                      disabled: !editableIds.length,
                    },
                    {
                      label: '删除节点',
                      action: remove,
                      disabled: !editableIds.length,
                    },
                  ]
                : [
                    {
                      label: '添加节点',
                      action: () => openSearch(menu.x, menu.y),
                    },
                    { label: '适应所有节点', action: fit },
                  ]
          }
        />
      )}
      {search && (
        <div
          className="cg-search"
          role="dialog"
          aria-label="搜索节点"
          style={{
            left: Math.max(8, Math.min(search.x, window.innerWidth - 280)),
            top: Math.max(8, Math.min(search.y, window.innerHeight - 320)),
          }}
        >
          <input
            autoFocus
            aria-label="搜索节点类型"
            placeholder="搜索节点…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setChoice(0);
            }}
            onKeyDown={(e) => {
              if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                if (e.key === 'Escape') setSearch(undefined);
                else if (e.key === 'Enter' && candidates[choice])
                  add(candidates[choice]!.type);
                else
                  setChoice(
                    Math.max(
                      0,
                      Math.min(
                        candidates.length - 1,
                        choice + (e.key === 'ArrowDown' ? 1 : -1),
                      ),
                    ),
                  );
              }
            }}
          />
          <div>
            {candidates.map((d, i) => (
              <button
                key={d.type}
                className={i === choice ? 'selected' : ''}
                onClick={() => add(d.type)}
              >
                <span>{d.title}</span>
                <small>{d.category}</small>
              </button>
            ))}
            {!candidates.length && <p>没有匹配节点</p>}
          </div>
        </div>
      )}
    </section>
  );
}
