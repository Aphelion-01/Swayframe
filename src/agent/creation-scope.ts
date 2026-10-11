import { AgentExecutionError } from './execution-error';
import type { Project } from '../core/project-model';
import type { CompositingGraph, GraphNode } from '../core/compositing-graph';
import {
  executionScopeSchema,
  type ExecutionScope,
} from './creation-contracts';
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function graphBranch(graph: CompositingGraph, roots: readonly string[]) {
  const ids = new Set(roots);
  if (roots.some((id) => !graph.nodes.some((n) => n.id === id)))
    throw Error('所选节点已不存在');
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of graph.edges)
      if (ids.has(edge.to.nodeId) && !ids.has(edge.from.nodeId)) {
        ids.add(edge.from.nodeId);
        changed = true;
      }
  }
  return graph.nodes
    .filter((n) => ids.has(n.id) && !['source', 'output'].includes(n.type))
    .map((n) => n.id);
}
export function resolveExecutionScope(
  project: Project,
  input: ExecutionScope,
): ExecutionScope {
  const scope = executionScopeSchema.parse(input),
    c = project.compositions.find((c) => c.id === scope.compositionId);
  if (!c || c.id !== project.activeCompositionId)
    throw Error('修改范围必须属于当前合成');
  if (scope.kind === 'FULL_COMPOSITION') return scope;
  const layer = c.layers.find((l) => l.id === scope.layerId),
    graph = layer?.editor?.graph;
  if (!graph || layer?.locked) throw Error('目标节点图缺失或图层已锁定');
  if (scope.nodeIds.some((id) => !graph.nodes.some((n) => n.id === id)))
    throw Error('所选节点已不存在');
  const nodeIds =
    scope.kind === 'SELECTED_BRANCH'
      ? graphBranch(graph, scope.nodeIds)
      : [...new Set(scope.nodeIds)];
  if (
    !nodeIds.length ||
    nodeIds.some((id) =>
      ['source', 'output'].includes(graph.nodes.find((n) => n.id === id)!.type),
    )
  )
    throw Error('请选择可修改的处理节点');
  return { ...scope, nodeIds };
}
/** Downstream rendering dependencies never grant mutation rights. Authority comes from UI, never a model field. */
export function validateCreationScope(
  base: Project,
  next: Project,
  scope: ExecutionScope,
) {
  const fail = () => {
    throw new AgentExecutionError({
      code: 'CONTEXT_INVALID',
      phase: 'preflight',
      recoverable: false,
      message: '方案超出已授权修改范围；请从目标入口重新选择范围，工程未提交',
    });
  };
  const stripCompositions = (p: Project) => ({ ...p, compositions: [] });
  if (!same(stripCompositions(base), stripCompositions(next))) fail();
  if (
    !same(
      base.compositions.map((c) => c.id),
      next.compositions.map((c) => c.id),
    )
  )
    fail();
  for (const c of base.compositions) {
    const after = next.compositions.find((n) => n.id === c.id)!;
    if (c.id !== scope.compositionId) {
      if (!same(c, after)) fail();
      continue;
    }
    if (scope.kind === 'FULL_COMPOSITION') continue;
    if (!same({ ...c, layers: [] }, { ...after, layers: [] })) fail();
    if (
      !same(
        c.layers.map((l) => l.id),
        after.layers.map((l) => l.id),
      )
    )
      fail();
    for (const layer of c.layers) {
      const n = after.layers.find((l) => l.id === layer.id)!;
      if (layer.id !== scope.layerId) {
        if (!same(layer, n)) fail();
        continue;
      }
      const graph = layer.editor?.graph,
        result = n.editor?.graph;
      if (!graph || !result) {
        fail();
        continue;
      }
      const withoutGraph = (l: typeof layer) => ({
        ...l,
        editor: { ...l.editor, graph: undefined },
      });
      if (!same(withoutGraph(layer), withoutGraph(n))) fail();
      if (
        !same(
          { ...graph, nodes: [], edges: [] },
          { ...result, nodes: [], edges: [] },
        )
      )
        fail();
      const allowed = new Set(scope.nodeIds),
        oldIds = new Set(graph.nodes.map((v) => v.id));
      if (
        scope.kind !== 'SELECTED_BRANCH' &&
        !same(
          graph.nodes.map((v) => v.id),
          result.nodes.map((v) => v.id),
        )
      )
        fail();
      for (const node of graph.nodes) {
        const changed = result.nodes.find((v) => v.id === node.id);
        if (!allowed.has(node.id)) {
          if (!same(node, changed)) fail();
        } else if (scope.kind === 'PARAMETER_ONLY') {
          if (
            !changed ||
            !same({ ...node, params: {} }, { ...changed, params: {} }) ||
            !same(Object.keys(node.params), Object.keys(changed.params))
          )
            fail();
          for (const [key, prop] of Object.entries(node.params))
            if (changed?.params[key]?.id !== prop.id) fail();
        }
      }
      const inside = (id: string) =>
        allowed.has(id) ||
        (!oldIds.has(id) && scope.kind === 'SELECTED_BRANCH');
      const fixedEdges = (g: CompositingGraph) =>
        g.edges.filter((e) => !inside(e.from.nodeId) || !inside(e.to.nodeId));
      if (
        scope.kind === 'PARAMETER_ONLY'
          ? !same(graph.edges, result.edges)
          : !same(fixedEdges(graph), fixedEdges(result))
      )
        fail();
    }
  }
}
export function inspectGraphNode(graph: CompositingGraph, node: GraphNode) {
  const upstream = graph.edges.filter((e) => e.to.nodeId === node.id),
    downstream = graph.edges.filter((e) => e.from.nodeId === node.id);
  const dependencies = new Set<string>([node.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of graph.edges)
      if (dependencies.has(e.from.nodeId) && !dependencies.has(e.to.nodeId)) {
        dependencies.add(e.to.nodeId);
        changed = true;
      }
  }
  return {
    ...node,
    inputConnections: upstream,
    outputConnections: downstream,
    semanticRole: node.name,
    group: null,
    sourceAsset: null,
    outputDependencies: [...dependencies].filter((id) => id !== node.id),
  };
}
export function creationDiff(
  base: Project,
  next: Project,
  scope: ExecutionScope,
) {
  const layers = (p: Project) => p.compositions.flatMap((c) => c.layers);
  const old = layers(base),
    result = layers(next),
    nodes = (p: Project) =>
      layers(p).flatMap((l) => l.editor?.graph?.nodes ?? []),
    edges = (p: Project) =>
      layers(p).flatMap((l) => l.editor?.graph?.edges ?? []);
  const diff = <T extends { id: string }>(
    a: readonly T[],
    b: readonly T[],
  ) => ({
    created: b.filter((v) => !a.some((n) => n.id === v.id)).map((v) => v.id),
    deleted: a.filter((v) => !b.some((n) => n.id === v.id)).map((v) => v.id),
    modified: b
      .filter((v) => a.some((n) => n.id === v.id && !same(n, v)))
      .map((v) => v.id),
    unchanged: a
      .filter((v) => b.some((n) => n.id === v.id && same(n, v)))
      .map((v) => v.id),
  });
  const a = nodes(base),
    b = nodes(next);
  return {
    scope,
    labels: Object.fromEntries(
      [...old, ...result, ...a, ...b].map((v) => [v.id, v.name]),
    ),
    objects: diff(old, result),
    nodes: diff(a, b),
    connections: diff(edges(base), edges(next)),
    parameters: b.flatMap((n) =>
      Object.entries(n.params).flatMap(([key, value]) => {
        const before = a.find((v) => v.id === n.id)?.params[key];
        return before && !same(before, value)
          ? [
              {
                nodeId: n.id,
                key,
                before: before.baseValue,
                after: value.baseValue,
                beforeKeyframes: before.keyframes,
                afterKeyframes: value.keyframes,
              },
            ]
          : [];
      }),
    ),
    estimatedCost: {
      externalGenerationRequests: 0,
      note: '仅本地命令预览；模型规划费用以服务实际用量为准',
    },
    warnings: [] as string[],
  };
}
export type CreationChangeProposal = ReturnType<typeof creationDiff>;
