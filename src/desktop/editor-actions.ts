import { desktopService } from './service';
import type { DesktopAction } from './contracts';
import type { EditorStore } from '../ui/editor-store';
import { focusContext } from '../ui/workspace/shortcuts';
import { dispatchEditorAction } from '../ui/workspace/editor-actions';
export function editorAction(_store: EditorStore, action: DesktopAction) {
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
  if (action === 'about') window.dispatchEvent(new Event('motion:about'));
  else dispatchEditorAction(action);
}
