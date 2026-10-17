import type { CompositingGraph } from './compositing-graph';
import { assertGraph } from './compositing-graph';
/** Deterministic DAG columns; separate branches retain distinct rows and stable IDs. */
export function layoutCompositingGraph(
  graph: CompositingGraph,
): CompositingGraph {
  assertGraph(graph);
  const rank = new Map<string, number>();
  const column = (id: string): number => {
    const known = rank.get(id);
    if (known !== undefined) return known;
    const parents = graph.edges
      .filter((e) => e.to.nodeId === id)
      .map((e) => column(e.from.nodeId));
    const n = parents.length ? Math.max(...parents) + 1 : 0;
    rank.set(id, n);
    return n;
  };
  for (const node of graph.nodes) column(node.id);
  const rows = new Map<number, number>();
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const col = rank.get(n.id)!,
        row = rows.get(col) ?? 0;
      rows.set(col, row + 1);
      return { ...n, position: { x: 40 + col * 260, y: 40 + row * 220 } };
    }),
  };
}
