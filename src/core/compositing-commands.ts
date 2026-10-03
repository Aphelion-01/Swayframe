import { command } from './command-system';
import type { Command } from './command-system';
import type { Project } from './project-model';
import type { CompositingGraph } from './compositing-graph';
export function graphLocation(project: Project, layerId: string) {
  for (const composition of project.compositions) {
    const layer = composition.layers.find((l) => l.id === layerId);
    if (layer) return { composition, layer };
  }
  throw new Error('图层不存在');
}
export function graphCommand(
  project: Project,
  layerId: string,
  graph: CompositingGraph,
): Command {
  const { composition, layer } = graphLocation(project, layerId);
  if (layer.locked) throw new Error('图层已锁定');
  if (graph.owner.id !== layer.id) throw new Error('图所属图层不匹配');
  return command({
    type: 'graph.replace',
    compositionId: composition.id,
    layerId,
    graph,
  });
}
