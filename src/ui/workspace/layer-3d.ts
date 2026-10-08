import { activeComposition } from '../../core/project-model';
import { command } from '../../core/command-system';
import type { EditorStore } from '../editor-store';
export function toggleLayer3D(
  store: EditorStore,
  ids: readonly string[],
  enabled?: boolean,
) {
  const c = activeComposition(store.getSnapshot().project);
  const layers = c.layers.filter(
    (l) =>
      ids.includes(l.id) &&
      l.editor &&
      l.type !== 'camera' &&
      l.type !== 'model' &&
      !l.locked,
  );
  const next = enabled ?? !layers[0]?.editor?.is3D;
  return store.run(
    '切换三维图层',
    layers.map((l) =>
      command({
        type: 'layer.replace',
        compositionId: c.id,
        layer: { ...l, editor: { ...l.editor!, is3D: next } },
      }),
    ),
  );
}
