import { command } from '../../core/command-system';
import { activeComposition, createLayer } from '../../core/project-model';
import type { LayerKind } from '../../core/project-model';
import type { EditorStore } from '../editor-store';
import { layerKindLabels } from '../labels';
import type { IconName } from './icons';

export const objectChoices = [
  ['rectangle', 'rectangle'],
  ['ellipse', 'ellipse'],
  ['polygon', 'polygon'],
  ['star', 'star'],
  ['path', 'path'],
  ['text', 'text'],
  ['camera', 'camera'],
  ['solid', 'solid'],
  ['null', 'null'],
  ['image', 'image'],
] as const satisfies readonly (readonly [LayerKind, IconName])[];

export function createObject(
  store: EditorStore,
  kind: Exclude<LayerKind, 'image'>,
) {
  const c = activeComposition(store.getSnapshot().project);
  const layer = createLayer(kind, {
    position: { x: c.width / 2, y: c.height / 2 },
  });
  if (
    store.run(`创建 ${layerKindLabels[kind]}`, [
      command({ type: 'layer.create', compositionId: c.id, layer }),
    ]).ok
  )
    store.select(layer.id);
}
