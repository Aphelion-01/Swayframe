import { newId } from './core-types';
import type { Vec2 } from './core-types';
import { assertGraph, connectGraph } from './compositing-graph';
import type { CompositingGraph, GraphNode, PortRef } from './compositing-graph';
import { createNode, nodeDefinition } from './compositing-registry';
function editable(g: CompositingGraph, id: string): GraphNode {
  const n = g.nodes.find((n) => n.id === id);
  if (!n) throw new Error('节点不存在');
  if (nodeDefinition(n.type)?.protected)
    throw new Error('Source 与 Output 不可删除、复制或禁用');
  return n;
}
export function addGraphNode(
  g: CompositingGraph,
  node: GraphNode,
): CompositingGraph {
  const next = { ...g, nodes: [...g.nodes, node] };
  assertGraph(next);
  return next;
}
export function insertGraphNode(
  g: CompositingGraph,
  type: string,
  edgeId?: string,
  position?: Vec2,
): { graph: CompositingGraph; node: GraphNode } {
  let node = createNode(type, position ?? { x: 180, y: 50 });
  const edge = edgeId
    ? g.edges.find((e) => e.id === edgeId)
    : g.edges.find((e) => e.to.nodeId === g.outputNodeId);
  if (edgeId && !edge) throw new Error('连线不存在');
  const target = edge
    ? g.nodes.find((n) => n.id === edge.to.nodeId)
    : undefined;
  const auto =
    !!target &&
    !position &&
    node.inputs.some((p) => p.id === 'in') &&
    node.outputs.some((p) => p.id === 'out');
  if (auto) node = { ...node, position: target!.position };
  let graph = addGraphNode(g, node);
  if (auto) {
    const downstream = new Set<string>([target!.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of g.edges)
        if (downstream.has(e.from.nodeId) && !downstream.has(e.to.nodeId)) {
          downstream.add(e.to.nodeId);
          changed = true;
        }
    }
    graph = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        downstream.has(n.id)
          ? { ...n, position: { x: n.position.x + 240, y: n.position.y } }
          : n,
      ),
    };
  }
  if (
    edge &&
    node.inputs.some((p) => p.id === 'in' && p.type === 'Image') &&
    node.outputs.some((p) => p.id === 'out' && p.type === 'Image')
  ) {
    graph = { ...graph, edges: graph.edges.filter((e) => e.id !== edge.id) };
    graph = connectGraph(graph, {
      id: newId(),
      from: edge.from,
      to: { nodeId: node.id, portId: 'in' },
    });
    graph = connectGraph(graph, {
      id: newId(),
      from: { nodeId: node.id, portId: 'out' },
      to: edge.to,
    });
  }
  return { graph, node };
}
export function deleteGraphNodes(
  g: CompositingGraph,
  ids: readonly string[],
): CompositingGraph {
  for (const id of ids) editable(g, id);
  let edges = [...g.edges];
  // Restore a unary chain when deleting an effect; branches are never flattened.
  for (const id of ids) {
    const incoming = edges.filter((e) => e.to.nodeId === id),
      outgoing = edges.filter((e) => e.from.nodeId === id);
    edges = edges.filter((e) => e.to.nodeId !== id && e.from.nodeId !== id);
    if (incoming.length === 1 && incoming[0]!.to.portId === 'in')
      for (const e of outgoing)
        edges.push({ id: newId(), from: incoming[0]!.from, to: e.to });
  }
  const next = {
    ...g,
    nodes: g.nodes.filter((n) => !ids.includes(n.id)),
    edges,
  };
  assertGraph(next);
  return next;
}
export function patchGraphNode(
  g: CompositingGraph,
  id: string,
  patch: Partial<Pick<GraphNode, 'position' | 'name' | 'enabled'>>,
): CompositingGraph {
  if (patch.enabled !== undefined) editable(g, id);
  if (!g.nodes.some((n) => n.id === id)) throw new Error('节点不存在');
  return {
    ...g,
    nodes: g.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
  };
}
export function duplicateGraphNodes(
  g: CompositingGraph,
  ids: readonly string[],
): { graph: CompositingGraph; ids: string[] } {
  const remap = new Map<string, string>(),
    copies = ids.map((id) => {
      const n = editable(g, id),
        copy = createNode(n.type, {
          x: n.position.x + 40,
          y: n.position.y + 50,
        });
      remap.set(id, copy.id);
      return {
        ...copy,
        name: n.name + ' 副本',
        enabled: n.enabled,
        params: Object.fromEntries(
          Object.entries(n.params).map(([k, p]) => [
            k,
            {
              ...p,
              id: newId(),
              keyframes: p.keyframes.map((f) => ({ ...f, id: newId() })),
            },
          ]),
        ),
      };
    });
  const edges = g.edges
    .filter((e) => remap.has(e.from.nodeId) && remap.has(e.to.nodeId))
    .map((e) => ({
      ...e,
      id: newId(),
      from: { ...e.from, nodeId: remap.get(e.from.nodeId)! },
      to: { ...e.to, nodeId: remap.get(e.to.nodeId)! },
    }));
  const graph = {
    ...g,
    nodes: [...g.nodes, ...copies],
    edges: [...g.edges, ...edges],
  };
  assertGraph(graph);
  return { graph, ids: copies.map((n) => n.id) };
}
export function connectPorts(
  g: CompositingGraph,
  from: PortRef,
  to: PortRef,
): CompositingGraph {
  return connectGraph(g, { id: newId(), from, to });
}
export function disconnectEdge(
  g: CompositingGraph,
  id: string,
): CompositingGraph {
  if (!g.edges.some((e) => e.id === id)) throw new Error('连线不存在');
  return { ...g, edges: g.edges.filter((e) => e.id !== id) };
}
