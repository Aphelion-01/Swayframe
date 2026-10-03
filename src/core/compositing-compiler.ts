import type { GraphExecutionCache } from './compositing-cache';
import { evaluateProperty } from './animation-engine';
import { validateGraph } from './compositing-graph';
import type {
  CompositingGraph,
  GraphDiagnostic,
  GraphNode,
} from './compositing-graph';
import { nodeDefinition } from './compositing-registry';
import type { NodeBackend } from './compositing-registry';
export interface CompiledNode {
  readonly node: GraphNode;
  readonly inputs: Readonly<Record<string, string>>;
  readonly passes: readonly string[];
}
export interface CompiledGraph {
  readonly graphId: string;
  readonly outputNodeId: string;
  readonly nodes: readonly CompiledNode[];
  readonly diagnostics: readonly GraphDiagnostic[];
  readonly valid: boolean;
}
const compiledCache = new WeakMap<CompositingGraph, CompiledGraph>();
export function compileGraph(graph: CompositingGraph): CompiledGraph {
  const cached = compiledCache.get(graph);
  if (cached) return cached;
  const diagnostics = validateGraph(graph),
    nodes: CompiledNode[] = [];
  if (diagnostics.length)
    return {
      graphId: graph.id,
      outputNodeId: graph.outputNodeId,
      nodes,
      diagnostics,
      valid: false,
    };
  const byId = new Map(graph.nodes.map((n) => [n.id, n])),
    visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const node = byId.get(id)!;
    const inputs: Record<string, string> = {};
    for (const port of node.inputs) {
      const edge = graph.edges.find(
        (e) => e.to.nodeId === id && e.to.portId === port.id,
      );
      if (edge) {
        visit(edge.from.nodeId);
        inputs[port.id] = edge.from.nodeId;
      } else if (port.required && node.enabled)
        diagnostics.push({ nodeId: id, message: `缺少输入：${port.name}` });
    }
    if (!nodeDefinition(node.type))
      diagnostics.push({ nodeId: id, message: `未知节点：${node.type}` });
    nodes.push({
      node,
      inputs,
      passes:
        node.type === 'gaussianBlur'
          ? ['gaussian-horizontal', 'gaussian-vertical']
          : [node.type],
    });
  };
  visit(graph.outputNodeId);
  const plan = {
    graphId: graph.id,
    outputNodeId: graph.outputNodeId,
    nodes,
    diagnostics,
    valid: diagnostics.length === 0,
  };
  if (Object.isFrozen(graph)) compiledCache.set(graph, plan);
  return plan;
}
export interface GraphExecution<T> {
  readonly output: T;
  readonly diagnostics: readonly GraphDiagnostic[];
}
/** Only a valid Source→Output dependency can use the renderer's direct-content path. */
export function isIdentityGraph(graph: CompositingGraph): boolean {
  const plan = compileGraph(graph);
  return (
    plan.valid &&
    plan.nodes.length === 2 &&
    plan.nodes[0]?.node.type === 'source' &&
    plan.nodes[1]?.node.type === 'output'
  );
}
export function executeGraph<T>(
  plan: CompiledGraph,
  time: number,
  backend: NodeBackend<T>,
  cache?: GraphExecutionCache<T>,
  sourceKey = '',
): GraphExecution<T> {
  const revisions = new Map<string, number>();
  const failed = new Set<string>();
  cache?.retain(new Set(plan.nodes.map((s) => s.node.id)));
  const uses = new Map<string, number>();
  for (const step of plan.nodes)
    for (const id of Object.values(step.inputs))
      uses.set(id, (uses.get(id) ?? 0) + 1);
  const results = new Map<string, T>(),
    diagnostics = [...plan.diagnostics];
  if (!plan.nodes.length) return { output: backend.source(), diagnostics };
  for (const step of plan.nodes) {
    const { node } = step,
      inputs = Object.fromEntries(
        Object.entries(step.inputs).map(([p, id]) => [p, results.get(id)!]),
      );
    const fallback = () =>
      inputs.in ?? inputs.b ?? inputs.a ?? backend.transparent();
    const params = Object.fromEntries(
      Object.entries(node.params).map(([k, p]) => [
        k,
        evaluateProperty(p, time),
      ]),
    );
    const key = JSON.stringify([
      node.type,
      node.enabled,
      node.enabled ? params : {},
      Object.entries(step.inputs).map(([port, id]) => [
        port,
        id,
        revisions.get(id),
      ]),
      node.type === 'source' ? sourceKey : null,
    ]);
    revisions.set(node.id, cache?.revision(node.id, key) ?? 0);
    const inputFailed = Object.values(step.inputs).some((id) => failed.has(id));
    const hit = inputFailed ? undefined : cache?.get(node.id, key);
    if (hit && !diagnostics.some((e) => e.nodeId === node.id))
      results.set(node.id, hit.value);
    else
      try {
        if (diagnostics.some((e) => e.nodeId === node.id)) {
          failed.add(node.id);
          results.set(node.id, fallback());
        } else {
          const def = nodeDefinition(node.type);
          if (!def) throw new Error(`节点 ${node.type} 未注册`);
          const value = node.enabled
            ? def.evaluate({ inputs, params, backend })
            : fallback();
          results.set(node.id, value);
          if (!inputFailed) cache?.put(node.id, key, value);
          else failed.add(node.id);
        }
      } catch (error) {
        failed.add(node.id);
        diagnostics.push({
          nodeId: node.id,
          message: error instanceof Error ? error.message : '节点计算失败',
        });
        results.set(node.id, fallback());
      }
    for (const id of Object.values(step.inputs)) {
      const remaining = (uses.get(id) ?? 1) - 1;
      uses.set(id, remaining);
      if (!remaining && id !== plan.outputNodeId) results.delete(id);
    }
  }
  return {
    output: results.get(plan.outputNodeId) ?? backend.source(),
    diagnostics,
  };
}
