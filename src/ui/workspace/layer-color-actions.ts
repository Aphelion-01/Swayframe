import { command } from '../../core/command-system';
import {
  layerAccent,
  layerAccentIds,
  layerAccentLabels,
} from '../../core/layer-accent';
import { activeComposition } from '../../core/project-model';
import type { EditorStore } from '../editor-store';
import type { MenuItem } from './primitives';
export function layerColorActions(store: EditorStore): MenuItem[] {
  const view = store.getSnapshot(),
    c = activeComposition(view.project),
    layers = c.layers.filter((layer) => view.selection.includes(layer.id));
  return layerAccentIds.map((id) => ({
    label: layerAccentLabels[id],
    accent: id,
    checked:
      layers.length > 0 && layers.every((layer) => layerAccent(layer) === id),
    disabled: layers.length === 0,
    action: () => {
      store.run(
        '修改图层色标',
        layers
          .filter((layer) => layerAccent(layer) !== id)
          .map((layer) =>
            command({
              type: 'layer.replace',
              compositionId: c.id,
              layer: { ...layer, ui: { ...layer.ui, accentColorId: id } },
            }),
          ),
      );
    },
  }));
}
