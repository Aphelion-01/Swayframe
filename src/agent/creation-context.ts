import { activeComposition, type Project } from '../core/project-model';
import type { ExecutionScope } from './creation-contracts';

/** Planning summaries are bounded; registered READ tools retain the exact data. */
export function creationGraphContext(
  project: Project,
  scope?: ExecutionScope,
  maxCharacters = 16000,
) {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1000)
    throw Error('Invalid graph context budget');
  const layers = activeComposition(project).layers.filter(
    (l) => l.editor?.graph,
  );
  if (scope && scope.kind !== 'FULL_COMPOSITION')
    layers.sort(
      (a, b) => Number(b.id === scope.layerId) - Number(a.id === scope.layerId),
    );
  const result: {
    graphs: Record<string, unknown>[];
    truncated: boolean;
    inspection: string;
  } = {
    graphs: [],
    truncated: false,
    inspection:
      'Use inspectGraphNode / inspectGraphBranch for exact parameters, keyframes, packages and connections omitted from this summary.',
  };
  for (const layer of layers) {
    const graph = layer.editor!.graph!;
    const nodes = [...graph.nodes];
    if (
      scope &&
      scope.kind !== 'FULL_COMPOSITION' &&
      scope.layerId === layer.id
    )
      nodes.sort(
        (a, b) =>
          Number(scope.nodeIds.includes(b.id)) -
          Number(scope.nodeIds.includes(a.id)),
      );
    const summary = {
      layerId: layer.id,
      name: layer.name.slice(0, 100),
      graphId: graph.id,
      outputNodeId: graph.outputNodeId,
      nodeCount: nodes.length,
      edgeCount: graph.edges.length,
      nodes: [] as Record<string, unknown>[],
    };
    result.graphs.push(summary);
    if (JSON.stringify(result).length > maxCharacters) {
      result.graphs.pop();
      result.truncated = true;
      break;
    }
    for (const node of nodes) {
      const params = Object.fromEntries(
        Object.entries(node.params)
          .slice(0, 24)
          .map(([key, p]) => [
            key,
            {
              baseValue:
                JSON.stringify(p.baseValue).length <= 320
                  ? p.baseValue
                  : '[omitted: inspectGraphNode]',
              keyframeCount: p.keyframes.length,
            },
          ]),
      );
      const entry = {
        id: node.id,
        type: node.type,
        name: node.name.slice(0, 100),
        enabled: node.enabled,
        params,
        ...(node.effectPackage
          ? {
              package: {
                id: node.effectPackage.id,
                version: node.effectPackage.version,
                contentHash: node.effectPackage.contentHash,
              },
            }
          : {}),
      };
      summary.nodes.push(entry);
      if (JSON.stringify(result).length > maxCharacters) {
        summary.nodes.pop();
        result.truncated = true;
        break;
      }
    }
    if (
      summary.nodes.length !== nodes.length ||
      nodes.some(
        (n) =>
          Object.keys(n.params).length > 24 ||
          Object.values(n.params).some(
            (p) => JSON.stringify(p.baseValue).length > 320,
          ),
      )
    )
      result.truncated = true;
  }
  return result;
}
