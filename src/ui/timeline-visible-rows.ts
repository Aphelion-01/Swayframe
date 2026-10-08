import type { Layer, PropertyEntry } from '../core/project-model';
import type { EditorView } from './editor-store';
import { visibleProperties, propertyLabel } from './property-labels';
function groupFor(entry: PropertyEntry): { id: string; label: string } {
  const key = entry.key;
  if (key.startsWith('transform.') || key.endsWith('.anchor'))
    return { id: 'transform', label: '变换' };
  const effect = key.match(/\.effects\.(\d+)\./);
  if (effect)
    return {
      id: `effect-${effect[1]}`,
      label: `效果 ${Number(effect[1]) + 1}`,
    };
  const mask = key.match(/\.masks\.(\d+)\./);
  if (mask)
    return { id: `mask-${mask[1]}`, label: `遮罩 ${Number(mask[1]) + 1}` };
  if (key.includes('.graph.nodes.')) return { id: 'nodes', label: '合成参数' };
  if (/3D$|camera/.test(key)) return { id: '3d', label: '三维 / 摄像机' };
  if (/fontSize|fontWeight|fontItalic|tracking|lineHeight|text/.test(key))
    return { id: 'text', label: '文字' };
  return { id: 'appearance', label: '外观 / 图形' };
}
/** One row model drives tree labels and time tracks, including filtered/collapsed groups. */
export function timelineVisibleRows(
  layers: readonly Layer[],
  _selection: readonly string[],
  expanded: Readonly<Record<string, boolean>>,
  groups: Readonly<Record<string, boolean>>,
  filter: EditorView['propertyFilter'],
  frames: EditorView['frames'],
  search = '',
  selectedProperties: readonly string[] = [],
) {
  void _selection;
  let rowIndex = 0;
  const query = search.trim().toLocaleLowerCase();
  return [...layers].reverse().map((layer) => {
    const headerIndex = rowIndex++;
    const open =
      filter !== 'all' ||
      !!query ||
      (expanded[layer.id] ??
        frames.some((ref) =>
          visibleProperties(layer).some(
            (p) => p.property.id === ref.propertyId,
          ),
        ));
    const buckets = new Map<
      string,
      { id: string; label: string; entries: PropertyEntry[] }
    >();
    for (const entry of visibleProperties(layer)) {
      const { key, property } = entry,
        group = groupFor(entry);
      if (!(
        filter === 'all' ||
        `transform.${filter}` === key ||
        (filter === 'animated' && property.keyframes.length > 0) ||
        (filter === 'selected' && selectedProperties.includes(property.id))
      ))
        continue;
      if (
        query &&
        !`${layer.name} ${group.label} ${propertyLabel(key, layer)} ${key}`
          .toLocaleLowerCase()
          .includes(query)
      )
        continue;
      if (!buckets.has(group.id))
        buckets.set(group.id, { ...group, entries: [] });
      buckets.set(group.id, {
        ...buckets.get(group.id)!,
        entries: [...buckets.get(group.id)!.entries, entry],
      });
    }
    const propertyGroups = open
      ? [...buckets.values()].map((group) => {
          const groupIndex = rowIndex++;
          const groupOpen =
            groups[`${layer.id}:${group.id}`] ??
            (group.id === 'transform' ? groups[layer.id] : undefined) ??
            true;
          const properties = groupOpen
            ? group.entries.map((entry) => ({ ...entry, rowIndex: rowIndex++ }))
            : [];
          return {
            id: group.id,
            label: group.label,
            rowIndex: groupIndex,
            open: groupOpen,
            properties,
          };
        })
      : [];
    return {
      layer,
      headerIndex,
      open,
      propertyGroups,
      properties: propertyGroups.flatMap((g) => g.properties),
      groupIndex: propertyGroups[0]?.rowIndex,
      groupOpen: propertyGroups[0]?.open ?? false,
    };
  });
}
