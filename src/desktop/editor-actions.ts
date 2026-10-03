import { desktopService } from './service';
import type { DesktopAction } from './contracts';
import type { EditorStore } from '../ui/editor-store';
import { focusContext } from '../ui/workspace/shortcuts';
import { activeComposition } from '../core/project-model';
import { command } from '../core/command-system';
import { newId } from '../core/core-types';
import { evaluateProperty } from '../core/animation-engine';
import { importNativeAssets } from './asset-service';
export function editorAction(store: EditorStore, action: DesktopAction) {
  const context = focusContext(document.activeElement);
  if (
    ['text', 'numeric'].includes(context) &&
    ['undo', 'redo', 'cut', 'copy', 'paste', 'delete', 'select-all'].includes(
      action,
    )
  ) {
    const edit = action === 'select-all' ? 'selectAll' : action;
    if (
      ['undo', 'redo', 'cut', 'copy', 'paste', 'delete', 'selectAll'].includes(
        edit,
      )
    )
      void desktopService.api?.textEdit(
        edit as
          'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'delete' | 'selectAll',
      );
    return;
  }
  switch (action) {
    case 'undo':
      store.undo();
      break;
    case 'redo':
      store.redo();
      break;
    case 'select-all':
      store.selectAll();
      break;
    case 'copy':
      store.copySelection();
      break;
    case 'paste':
      store.pasteSelection();
      break;
    case 'cut':
      store.copySelection();
      store.deleteSelected();
      break;
    case 'duplicate':
      store.duplicateSelection();
      break;
    case 'delete':
      store.deleteSelected();
      break;
    case 'import':
      void importNativeAssets(store);
      break;
    case 'zoom-in':
      store.setZoom(store.getSnapshot().zoom * 1.2);
      break;
    case 'zoom-out':
      store.setZoom(store.getSnapshot().zoom / 1.2);
      break;
    case 'keyframe': {
      const v = store.getSnapshot();
      const commands = activeComposition(v.project)
        .layers.filter((l) => v.selection.includes(l.id) && !l.locked)
        .map((l) => {
          const p = l.transform.position,
            k = p.keyframes.find((k) => Math.abs(k.time - v.time) < 1e-8);
          return k
            ? command({
                type: 'keyframe.update',
                propertyId: p.id,
                keyframeId: k.id,
                patch: { value: evaluateProperty(p, v.time) },
              })
            : command({
                type: 'keyframe.add',
                propertyId: p.id,
                keyframe: {
                  id: newId(),
                  time: v.time,
                  value: evaluateProperty(p, v.time),
                  interpolation: { type: 'linear' },
                },
              });
        });
      if (commands.length) store.run('添加位置关键帧', commands);
      break;
    }
    case 'export':
    case 'fit':
    case 'actual-size':
    case 'toggle-left':
    case 'toggle-right':
    case 'toggle-bottom':
    case 'graph':
    case 'motion-curve':
    case 'about':
      window.dispatchEvent(new Event(`motion:${action}`));
      break;
  }
}
