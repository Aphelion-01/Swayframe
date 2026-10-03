import type { Effect, Layer } from './project-model';
import type { CompositingGraph } from './compositing-graph';
import {
  createGraph,
  createNode,
  nodeDefinition,
} from './compositing-registry';
import { newId } from './core-types';
export function effectsToGraph(
  layerId: string,
  effects: readonly Effect[],
): CompositingGraph {
  const base = createGraph(layerId),
    source = base.nodes[0]!,
    output = base.nodes[1]!;
  const nodes = effects.map((e, i) => ({
    ...createNode(e.kind, { x: 260 + i * 220, y: 50 }),
    id: e.id,
    enabled: e.enabled,
    params: e.parameters,
  }));
  const chain = [
    source,
    ...nodes,
    { ...output, position: { x: 260 + nodes.length * 220, y: 50 } },
  ];
  return {
    ...base,
    nodes: chain,
    edges: chain.slice(1).map((n, i) => ({
      id: newId(),
      from: { nodeId: chain[i]!.id, portId: 'out' },
      to: { nodeId: n.id, portId: 'in' },
    })),
  };
}
export function migrateLayerGraph(layer: Layer): Layer {
  if (!layer.editor) return layer;
  const { effects, ...editor } = layer.editor;
  if (editor.graph && effects?.length)
    throw new Error('不能同时保存效果栈与节点图');
  return {
    ...layer,
    editor: {
      ...editor,
      graph: editor.graph ?? effectsToGraph(layer.id, effects ?? []),
    },
  };
}
/** Null means an advanced/nonlinear graph, never a flattened stack. */
export function linearGraphEffects(graph: CompositingGraph): Effect[] | null {
  const effects: Effect[] = [];
  let id = graph.outputNodeId;
  const seen = new Set<string>();
  while (!seen.has(id)) {
    seen.add(id);
    const node = graph.nodes.find((n) => n.id === id);
    if (!node) return null;
    if (node.type === 'source')
      return seen.size === graph.nodes.length &&
        graph.edges.length === graph.nodes.length - 1
        ? effects.reverse()
        : null;
    if (node.type !== 'output') {
      const kind = nodeDefinition(node.type)?.effectKind;
      if (!kind) return null;
      effects.push({
        id: node.id,
        kind,
        enabled: node.enabled,
        parameters: node.params as Effect['parameters'],
      });
    }
    const edges = graph.edges.filter((e) => e.to.nodeId === id);
    if (edges.length !== 1 || edges[0]!.to.portId !== 'in') return null;
    id = edges[0]!.from.nodeId;
  }
  return null;
}
export function layerEffects(layer: Layer): readonly Effect[] {
  return layer.editor?.graph
    ? (linearGraphEffects(layer.editor.graph) ?? [])
    : (layer.editor?.effects ?? []);
}

export function reorderGraphEffects(
  graph: CompositingGraph,
  ids: readonly string[],
): CompositingGraph {
  const current = linearGraphEffects(graph);
  if (
    !current ||
    ids.length !== current.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !current.some((e) => e.id === id))
  )
    throw new Error('高级节点图不能作为线性效果栈重排');
  const source = graph.nodes.find((n) => n.type === 'source')!,
    chain = [
      source,
      ...ids.map((id) => graph.nodes.find((n) => n.id === id)!),
      graph.nodes.find((n) => n.id === graph.outputNodeId)!,
    ];
  return {
    ...graph,
    edges: chain.slice(1).map(
      (n, i) =>
        graph.edges.find(
          (e) => e.from.nodeId === chain[i]!.id && e.to.nodeId === n.id,
        ) ?? {
          id: newId(),
          from: { nodeId: chain[i]!.id, portId: 'out' },
          to: { nodeId: n.id, portId: 'in' },
        },
    ),
  };
}
