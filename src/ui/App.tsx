import { ApplicationSettings } from './ai/AISettings';
import './ai/ai.css';
import { dropAssets } from './asset-import';
import { useEditorSlice } from './use-editor-slice';
import { Canvas } from './Canvas';
import { LayerPanel } from './LayerPanel';
import { Inspector } from './Inspector';
import { Toolbar } from './Toolbar';
import { Timeline } from './Timeline';
import { ToolProvider } from './workspace/tools';
import { Workspace } from './workspace/layout';
import type { EditorStore } from './editor-store';

export function App({ store }: { store: EditorStore }) {
  const view = useEditorSlice(store, [
    'project',
    'error',
    'status',
    'selection',
    'frames',
  ]);
  return (
    <ToolProvider>
      <main
        className="editor-app"
        onDragOver={(e) => {
          e.preventDefault();
          (e.target as Element)
            .closest('.canvas-panel,.timeline-panel')
            ?.classList.add('drop-target');
        }}
        onDragLeave={(e) =>
          (e.target as Element)
            .closest('.canvas-panel,.timeline-panel')
            ?.classList.remove('drop-target')
        }
        onDrop={(e) => {
          document
            .querySelectorAll('.drop-target')
            .forEach((el) => el.classList.remove('drop-target'));
          void dropAssets(store, e);
        }}
      >
        <Toolbar store={store} />
        <ApplicationSettings />
        <Workspace
          left={<LayerPanel store={store} />}
          center={<Canvas store={store} />}
          right={<Inspector store={store} />}
          bottom={<Timeline store={store} />}
        />
        <footer className={`statusbar ${view.error ? 'has-error' : ''}`}>
          <span role={view.error ? 'alert' : 'status'}>{view.status}</span>
          <span>
            {view.selection.length} 个图层 · {view.frames.length} 个关键帧 ·{' '}
            {store.commands.undoStack.length} 步可撤销
          </span>
        </footer>
      </main>
    </ToolProvider>
  );
}
