import type { Layer } from '../core/project-model';
import type { EditorView } from './editor-store';
import { visibleProperties } from './property-labels';
/** Count only rendered rows, including headers. Filtering and collapse reflow stripes. */
export function timelineVisibleRows(
  layers: readonly Layer[],
  selection: readonly string[],
  expanded: Readonly<Record<string, boolean>>,
  groups: Readonly<Record<string, boolean>>,
  filter: EditorView['propertyFilter'],
  frames: EditorView['frames'],
) {
  let rowIndex = 0;
  return [...layers].reverse().map((layer) => {
    const headerIndex = rowIndex++;
    const open = expanded[layer.id] ?? selection.includes(layer.id);
    const groupIndex = open ? rowIndex++ : undefined;
    const groupOpen = open && (groups[layer.id] ?? true);
    const properties = groupOpen
      ? visibleProperties(layer)
          .filter(
            ({ key, property }) =>
              key.startsWith('transform.') ||
              property.keyframes.length > 0 ||
              frames.some((ref) => ref.propertyId === property.id),
          )
          .filter(
            ({ key, property }) =>
              filter === 'all' ||
              `transform.${filter}` === key ||
              (filter === 'animated' && property.keyframes.length > 0),
          )
          .map((entry) => ({ ...entry, rowIndex: rowIndex++ }))
      : [];
    return { layer, headerIndex, groupIndex, open, groupOpen, properties };
  });
}
