import type { EditorStore } from '../editor-store';
import type { MenuItem } from './primitives';
import { editorContributions } from './feature-contributions';
/** Compatibility surface; ownership and commands come from the contribution system. */
export function layerActions(
  store: EditorStore,
  rename: () => void,
  context: 'canvas' | 'scene' | 'timeline' = 'canvas',
): MenuItem[] {
  const point =
    context === 'canvas'
      ? 'context.canvas'
      : context === 'timeline'
        ? 'timeline.layerContext'
        : 'context.layer';
  return editorContributions(
    store,
    point,
    context === 'scene' ? 'layers' : context,
  ).map((item) =>
    item.label === '重命名' ? { ...item, action: rename } : item,
  );
}
