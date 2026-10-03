import { command } from '../../core/command-system';
import { activeComposition, createLayer } from '../../core/project-model';
import {
  parentCommands,
  precomposeCommands,
} from '../../core/composition-editing';
import type { EditorStore } from '../editor-store';
import type { MenuItem } from './primitives';
export function layerActions(
  store: EditorStore,
  rename: () => void,
): MenuItem[] {
  const view = store.getSnapshot(),
    c = activeComposition(view.project),
    layer = c.layers.find((l) => l.id === view.selection[0]);
  const safely = (action: () => void) => {
    try {
      action();
    } catch (error) {
      store.setStatus(
        error instanceof Error ? error.message : '操作失败',
        true,
      );
    }
  };
  return [
    {
      label: '复制图层',
      shortcut: '⌘D',
      disabled: !layer,
      action: () => store.duplicateSelection(),
    },
    {
      label: '复制',
      shortcut: '⌘C',
      disabled: !layer,
      action: () => store.copySelection(),
    },
    { label: '粘贴', shortcut: '⌘V', action: () => store.pasteSelection() },
    { label: '重命名', shortcut: 'F2', disabled: !layer, action: rename },
    {
      label: '选中图层预合成',
      disabled: !layer,
      action: () =>
        safely(() => {
          const result = precomposeCommands(view.project, view.selection);
          if (store.run('预合成', result.commands).ok)
            store.select(result.layerId);
        }),
    },
    {
      label: '创建父级空对象',
      disabled: !layer,
      action: () =>
        safely(() => {
          const parent = createLayer('null', { name: '父级空对象' });
          // Resolve parenting against an isolated preview containing the new parent.
          const preview = {
            ...view.project,
            compositions: view.project.compositions.map((comp) =>
              comp.id === c.id
                ? { ...comp, layers: [...comp.layers, parent] }
                : comp,
            ),
          };
          store.run('创建父级', [
            command({
              type: 'layer.create',
              compositionId: c.id,
              layer: parent,
            }),
            ...view.selection.flatMap((id) =>
              parentCommands(preview, id, parent.id, view.time),
            ),
          ]);
        }),
    },
    {
      label: layer?.editor?.is3D ? '关闭三维图层' : '开启三维图层',
      disabled: !layer?.editor,
      action: () => {
        if (layer?.editor)
          store.run('切换三维', [
            command({
              type: 'layer.replace',
              compositionId: c.id,
              layer: {
                ...layer,
                editor: { ...layer.editor, is3D: !layer.editor.is3D },
              },
            }),
          ]);
      },
    },
    {
      label: '删除选中图层',
      shortcut: 'Delete',
      disabled: !layer,
      action: () => store.deleteLayers(),
    },
    ...(
      [
        ['left', '左对齐'],
        ['center', '水平居中'],
        ['right', '右对齐'],
        ['top', '顶对齐'],
        ['middle', '垂直居中'],
        ['bottom', '底对齐'],
        ['horizontal', '水平分布'],
        ['vertical', '垂直分布'],
      ] as const
    ).map(([mode, label]) => ({
      label,
      disabled: !layer,
      action: () => store.align(mode),
    })),
  ];
}
