import { command } from './command-system';
import type { Command } from './command-system';
import type { Composition } from './project-model';
/** Scene is back-to-front; Timeline is front-to-back. Preserve selected order in one transaction. */
export function timelineReorderCommands(
  c: Composition,
  ids: readonly string[],
  targetId: string,
  after: boolean,
): Command[] {
  const chosen = new Set(ids);
  if (!chosen.size || chosen.has(targetId)) return [];
  if (c.layers.some((l) => chosen.has(l.id) && l.locked))
    throw Error('锁定图层不能调整顺序');
  const visual = [...c.layers].reverse().map((l) => l.id);
  const moved = visual.filter((id) => chosen.has(id));
  const rest = visual.filter((id) => !chosen.has(id));
  const target = rest.indexOf(targetId);
  if (target < 0) throw Error('排序目标不存在');
  rest.splice(target + (after ? 1 : 0), 0, ...moved);
  const desired = rest.reverse(),
    current = c.layers.map((l) => l.id),
    commands: Command[] = [];
  desired.forEach((id, index) => {
    const from = current.indexOf(id);
    if (from !== index) {
      commands.push(
        command({
          type: 'layer.reorder',
          compositionId: c.id,
          layerId: id,
          toIndex: index,
        }),
      );
      current.splice(from, 1);
      current.splice(index, 0, id);
    }
  });
  return commands;
}
