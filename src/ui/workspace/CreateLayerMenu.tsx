import { editorCommands } from './feature-contributions';
import { createPortal } from 'react-dom';
import { features } from '../../shared/feature-catalog';
import { dispatchEditorAction } from './editor-actions';
import type { EditorStore } from '../editor-store';
import { ContextMenu, type MenuItem } from './primitives';
import { Icon, type IconName } from './icons';
export function CreateLayerMenu({
  store,
  x,
  y,
  onClose,
  items = [],
}: {
  store: EditorStore;
  x: number;
  y: number;
  onClose: () => void;
  items?: readonly MenuItem[];
}) {
  const commands = editorCommands(store);
  const choices = features
    .all()
    .filter((f) => f.parentId === 'create-object')
    .map((feature) => ({
      label: feature.title,
      icon: <Icon name={feature.icon as IconName} />,
      action: () => {
        if (!commands.execute(feature.commandId))
          dispatchEditorAction(feature.commandId);
        onClose();
      },
    }));
  return createPortal(
    <>
      <ContextMenu
        label="创建对象"
        x={x}
        y={y}
        onClose={onClose}
        items={
          items.length
            ? [
                { label: '新建图层', action: () => {}, children: choices },
                ...items,
              ]
            : choices
        }
      />
    </>,
    document.body,
  );
}
