import type { EffectPackage } from './programmable-effect';
import type { AnimValue, ID, Vec2 } from './core-types';
import type { Property } from './project-model';

export const portTypes = [
  'Image',
  'Mask',
  'Number',
  'Vector',
  'Color',
  'Depth',
  'MotionData',
  'Geometry',
  'Audio',
  'Metadata',
] as const;
export type PortType = (typeof portTypes)[number];
export interface GraphPort {
  readonly id: string;
  readonly name: string;
  readonly type: PortType;
  readonly required?: boolean;
}
export interface GraphNode {
  readonly id: ID;
  readonly type: string;
  readonly name: string;
  readonly position: Vec2;
  readonly inputs: readonly GraphPort[];
  readonly outputs: readonly GraphPort[];
  readonly params: Readonly<Record<string, Property<AnimValue>>>;
  readonly enabled: boolean;
  readonly effectPackage?: EffectPackage;
  readonly metadata?: { readonly source?: 'human' | 'agent' | 'system' };
}
export interface PortRef {
  readonly nodeId: ID;
  readonly portId: string;
}
export interface GraphEdge {
  readonly id: ID;
  readonly from: PortRef;
  readonly to: PortRef;
}
export interface CompositingGraph {
  readonly id: ID;
  readonly version: 1;
  readonly owner: { readonly type: 'layer' | 'composition'; readonly id: ID };
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly outputNodeId: ID;
}
export interface GraphDiagnostic {
  readonly nodeId?: ID;
  readonly edgeId?: ID;
  readonly message: string;
}
/** Incomplete inputs are legal while editing; compilation diagnoses them. */
export function validateGraph(
  graph: CompositingGraph,
  complete = false,
): GraphDiagnostic[] {
  const errors: GraphDiagnostic[] = [];
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const ids = [
    graph.id,
    ...graph.nodes.map((n) => n.id),
    ...graph.edges.map((e) => e.id),
  ];
  if (new Set(ids).size !== ids.length)
    errors.push({ message: '图实体 ID 重复' });
  if (graph.owner.type !== 'layer')
    errors.push({ message: '当前版本仅支持图层合成图' });
  if (graph.nodes.filter((n) => n.type === 'source').length !== 1)
    errors.push({ message: '必须保留一个 Source 节点' });
  if (
    graph.nodes.filter((n) => n.type === 'output').length !== 1 ||
    nodes.get(graph.outputNodeId)?.type !== 'output'
  )
    errors.push({ message: '必须指定唯一 Output 节点' });
  const occupied = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const n of graph.nodes) {
    if (
      new Set([...n.inputs, ...n.outputs].map((p) => p.id)).size !==
      n.inputs.length + n.outputs.length
    )
      errors.push({ nodeId: n.id, message: '节点端口 ID 重复' });
    if (['source', 'output'].includes(n.type) && !n.enabled)
      errors.push({ nodeId: n.id, message: 'Source 与 Output 不可禁用' });
  }
  for (const e of graph.edges) {
    const from = nodes
      .get(e.from.nodeId)
      ?.outputs.find((p) => p.id === e.from.portId);
    const to = nodes.get(e.to.nodeId)?.inputs.find((p) => p.id === e.to.portId);
    if (!from || !to)
      errors.push({ edgeId: e.id, message: '端口不存在或方向错误' });
    else if (from.type !== to.type)
      errors.push({ edgeId: e.id, message: '端口类型不匹配' });
    if (e.from.nodeId === e.to.nodeId)
      errors.push({ edgeId: e.id, message: '不允许节点自连接' });
    const key = e.to.nodeId + ':' + e.to.portId;
    if (occupied.has(key))
      errors.push({ edgeId: e.id, message: '输入端口只能连接一个输出' });
    occupied.add(key);
    adjacency.set(e.from.nodeId, [
      ...(adjacency.get(e.from.nodeId) ?? []),
      e.to.nodeId,
    ]);
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const to of adjacency.get(id) ?? []) if (!visit(to)) return false;
    visiting.delete(id);
    visited.add(id);
    return true;
  };
  if (graph.nodes.some((n) => !visit(n.id)))
    errors.push({ message: '连接会产生循环' });
  if (complete)
    for (const n of graph.nodes)
      for (const p of n.inputs)
        if (p.required && !occupied.has(n.id + ':' + p.id))
          errors.push({ nodeId: n.id, message: `缺少输入：${p.name}` });
  return errors;
}
export function assertGraph(graph: CompositingGraph): void {
  const errors = validateGraph(graph);
  if (errors.length) throw new Error(errors.map((e) => e.message).join('；'));
}
export function connectGraph(
  graph: CompositingGraph,
  edge: GraphEdge,
): CompositingGraph {
  const next = { ...graph, edges: [...graph.edges, edge] };
  assertGraph(next);
  return next;
}
