import type { CompositingGraph, GraphNode } from './compositing-graph';
import { newId } from './core-types';
import { nodeDefinitionFor } from './compositing-registry';
/** A strict projection of the canonical graph. Never flatten branches or detached processing nodes. */
export function processingStack(graph: CompositingGraph): GraphNode[] | null {
  const found: GraphNode[] = [],
    seen = new Set<string>();
  let id = graph.outputNodeId;
  while (!seen.has(id)) {
    seen.add(id);
    const n = graph.nodes.find((n) => n.id === id);
    if (!n) return null;
    if (n.type === 'source' || (!n.inputs.length && n.type !== 'output')) {
      if (n.type !== 'source') found.push(n);
      if (graph.nodes.some((n) => n.type !== 'source' && !seen.has(n.id)))
        return null;
      return found.reverse();
    }
    if (n.type !== 'output') {
      const def = nodeDefinitionFor(n);
      if (
        !def ||
        n.inputs.length !== 1 ||
        n.inputs[0]?.id !== 'in' ||
        n.outputs[0]?.id !== 'out'
      )
        return null;
      found.push(n);
    }
    const incoming = graph.edges.filter((e) => e.to.nodeId === id);
    if (incoming.length !== 1 || incoming[0]!.to.portId !== 'in') return null;
    id = incoming[0]!.from.nodeId;
  }
  return null;
}
export function reorderProcessingStack(
  graph: CompositingGraph,
  ids: readonly string[],
): CompositingGraph {
  const stack = processingStack(graph);
  if (
    !stack ||
    ids.length !== stack.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !stack.some((n) => n.id === id))
  )
    throw Error('分支图不能重排为线性效果栈');
  const sorted = ids.map((id) => stack.find((n) => n.id === id)!);
  if (sorted.some((n, i) => !n.inputs.length && i !== 0))
    throw Error('生成器必须位于处理链起点');
  const chain = [
    ...(sorted[0]?.inputs.length === 0
      ? []
      : [graph.nodes.find((n) => n.type === 'source')!]),
    ...sorted,
    graph.nodes.find((n) => n.id === graph.outputNodeId)!,
  ];
  return {
    ...graph,
    edges: chain.slice(1).map((n, i) => ({
      id: newId(),
      from: { nodeId: chain[i]!.id, portId: 'out' },
      to: { nodeId: n.id, portId: 'in' },
    })),
  };
}
