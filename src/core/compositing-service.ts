import {
  CommandSystem,
  editPropertyCommand,
  transaction,
} from './command-system';
import type { Transaction, TransactionResult, Command } from './command-system';
import type { AnimValue, Vec2 } from './core-types';
import { graphCommand, graphLocation } from './compositing-commands';
import { effectsToGraph } from './compositing-migration';
import { compileGraph as compile } from './compositing-compiler';
import {
  insertGraphNode,
  deleteGraphNodes,
  connectPorts as connect,
  disconnectEdge as disconnect,
  patchGraphNode,
} from './compositing-operations';
import type { Project } from './project-model';
import type { CompositingGraph, PortRef } from './compositing-graph';
export interface CompositingHost {
  getSnapshot(): Project;
  executeTransaction(tx: Transaction): TransactionResult;
}
export class CompositingGraphService {
  constructor(
    private readonly host: CompositingHost,
    private readonly time: () => number = () => 0,
    readonly source: Transaction['source'] = 'agent',
  ) {}
  inspectGraph(layerId: string): CompositingGraph {
    const { layer } = graphLocation(this.host.getSnapshot(), layerId);
    if (!layer.editor?.graph) throw new Error('图层尚无合成节点图');
    return layer.editor.graph;
  }
  compileGraph(layerId: string) {
    return compile(this.inspectGraph(layerId));
  }
  #run(label: string, commands: readonly Command[]): void {
    const result = this.host.executeTransaction(
      transaction(label, this.source, commands),
    );
    if (!result.ok) throw new Error(result.error);
  }
  #graph(layerId: string) {
    const p = this.host.getSnapshot(),
      { layer } = graphLocation(p, layerId);
    return (
      layer.editor?.graph ??
      effectsToGraph(layerId, layer.editor?.effects ?? [])
    );
  }
  #node(id: string) {
    const p = this.host.getSnapshot();
    for (const c of p.compositions)
      for (const layer of c.layers) {
        const graph = layer.editor?.graph,
          node = graph?.nodes.find((n) => n.id === id);
        if (graph && node) return { layer, graph, node };
      }
    throw new Error('节点不存在');
  }
  #write(label: string, layerId: string, graph: CompositingGraph) {
    this.#run(label, [graphCommand(this.host.getSnapshot(), layerId, graph)]);
  }
  createNode(
    layerId: string,
    type: string,
    options: { position?: Vec2; edgeId?: string; nodeId?: string } = {},
  ) {
    const inserted = insertGraphNode(
        this.#graph(layerId),
        type,
        options.edgeId,
        options.position,
      ),
      id = options.nodeId ?? inserted.node.id;
    const graph = {
      ...inserted.graph,
      nodes: inserted.graph.nodes.map((n) =>
        n.id === inserted.node.id
          ? { ...n, id, metadata: { source: this.source } }
          : n,
      ),
      edges: inserted.graph.edges.map((e) => ({
        ...e,
        from: {
          ...e.from,
          nodeId: e.from.nodeId === inserted.node.id ? id : e.from.nodeId,
        },
        to: {
          ...e.to,
          nodeId: e.to.nodeId === inserted.node.id ? id : e.to.nodeId,
        },
      })),
    };
    this.#write('创建合成节点', layerId, graph);
    return graph.nodes.find((n) => n.id === id)!;
  }
  deleteNode(id: string) {
    const { layer, graph } = this.#node(id);
    this.#write('删除合成节点', layer.id, deleteGraphNodes(graph, [id]));
  }
  connectPorts(from: PortRef, to: PortRef) {
    const { layer, graph } = this.#node(from.nodeId),
      target = this.#node(to.nodeId);
    if (target.graph.id !== graph.id) throw new Error('不能跨图连接端口');
    const next = connect(graph, from, to);
    this.#write('连接节点端口', layer.id, next);
    return next.edges.at(-1)!;
  }
  disconnectEdge(id: string) {
    for (const c of this.host.getSnapshot().compositions)
      for (const layer of c.layers) {
        const graph = layer.editor?.graph;
        if (graph?.edges.some((e) => e.id === id)) {
          this.#write('断开节点连线', layer.id, disconnect(graph, id));
          return;
        }
      }
    throw new Error('连线不存在');
  }
  setNodeParameter(
    id: string,
    key: string,
    value: AnimValue,
    time = this.time(),
  ) {
    const { node } = this.#node(id),
      p = node.params[key];
    if (!p) throw new Error('节点参数不存在');
    this.#run('设置节点参数', [
      editPropertyCommand(this.host.getSnapshot(), p.id, time, value),
    ]);
  }
  setNodePosition(id: string, position: Vec2) {
    const { layer, graph } = this.#node(id);
    this.#write('移动节点', layer.id, patchGraphNode(graph, id, { position }));
  }
  enableNode(id: string, enabled: boolean) {
    const { layer, graph } = this.#node(id);
    this.#write(
      '切换节点启用',
      layer.id,
      patchGraphNode(graph, id, { enabled }),
    );
  }
  batch(
    label: string,
    work: (api: CompositingGraphService) => void,
  ): TransactionResult {
    try {
      const planner = new CommandSystem(this.host.getSnapshot()),
        api = new CompositingGraphService(planner, this.time, this.source);
      work(api);
      const commands = planner.undoStack.flatMap((entry) => [
        ...entry.transaction.commands,
      ]);
      return this.host.executeTransaction(
        transaction(label, this.source, commands),
      );
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '节点事务失败',
      };
    }
  }
}
