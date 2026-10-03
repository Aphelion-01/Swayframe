import { evaluateProperty } from './animation-engine';
import type { Project, Composition, Layer } from './project-model';
import type { RenderLayer, RenderSnapshot } from './renderer-core';
import type { HandleKind } from './transform-geometry';
import { apply2D, inverse2D } from './matrix2d';
import { animationEdit } from './editing-commands';
import { command } from './command-system';
import type { Command } from './command-system';
export function localTransformValues(
  snapshot: RenderSnapshot,
  items: readonly RenderLayer[],
): readonly RenderLayer[] {
  const ids = new Set(items.map((i) => i.source.id));
  return items
    .filter((item) => {
      let parent = item.source.editor?.parentId;
      while (parent) {
        if (ids.has(parent)) return false;
        parent = snapshot.layers.find((l) => l.source.id === parent)?.source
          .editor?.parentId;
      }
      return true;
    })
    .map((item) => {
      const parent = snapshot.layers.find(
          (l) => l.source.id === item.source.editor?.parentId,
        ),
        inverse = parent?.matrix ? inverse2D(parent.matrix) : null,
        original = snapshot.layers.find((l) => l.source.id === item.source.id),
        localScale = evaluateProperty(
          item.source.transform.scale,
          snapshot.time,
        );
      return parent && inverse
        ? {
            ...item,
            position: apply2D(inverse, item.position),
            rotation:
              evaluateProperty(item.source.transform.rotation, snapshot.time) +
              item.rotation -
              (snapshot.layers.find((l) => l.source.id === item.source.id)
                ?.rotation ?? item.rotation),
            scale: {
              x:
                original && Math.abs(original.scale.x) > 1e-12
                  ? (localScale.x * item.scale.x) / original.scale.x
                  : localScale.x,
              y:
                original && Math.abs(original.scale.y) > 1e-12
                  ? (localScale.y * item.scale.y) / original.scale.y
                  : localScale.y,
            },
          }
        : item;
    });
}
export function transformPreviewComposition(
  composition: Composition,
  snapshot: RenderSnapshot,
  items: readonly RenderLayer[],
): Composition {
  const values = localTransformValues(snapshot, items),
    update = (layer: Layer): Layer => {
      const item = values.find((i) => i.source.id === layer.id);
      if (!item) return layer;
      return {
        ...layer,
        transform: {
          ...layer.transform,
          position: {
            ...layer.transform.position,
            baseValue: item.position,
            keyframes: [],
          },
          rotation: {
            ...layer.transform.rotation,
            baseValue: item.rotation,
            keyframes: [],
          },
          scale: {
            ...layer.transform.scale,
            baseValue: item.scale,
            keyframes: [],
          },
        },
        ...(layer.editor && item.anchor
          ? {
              editor: {
                ...layer.editor,
                properties: {
                  ...layer.editor.properties,
                  anchor: {
                    ...layer.editor.properties.anchor!,
                    baseValue: item.anchor,
                    keyframes: [],
                  },
                },
              },
            }
          : {}),
      };
    };
  return { ...composition, layers: composition.layers.map(update) };
}
export function transformEditCommands(
  project: Project,
  snapshot: RenderSnapshot,
  items: readonly RenderLayer[],
  kind: HandleKind,
  time: number,
  auto: boolean,
): Command[] {
  return localTransformValues(snapshot, items).flatMap((item) => {
    const old = snapshot.layers.find((l) => l.source.id === item.source.id)!;
    const oldPosition = evaluateProperty(old.source.transform.position, time);
    const commands: Command[] = [];
    if (
      kind === 'anchor' &&
      item.source.editor?.properties.anchor &&
      item.anchor
    )
      commands.push(
        ...animationEdit(
          project,
          item.source.editor.properties.anchor.id,
          time,
          item.anchor,
        ),
      );
    else if (kind === 'scale')
      commands.push(
        ...animationEdit(
          project,
          item.source.transform.scale.id,
          time,
          item.scale,
        ),
      );
    else if (kind === 'rotate')
      commands.push(
        ...animationEdit(
          project,
          item.source.transform.rotation.id,
          time,
          item.rotation,
        ),
      );
    if (item.position.x !== oldPosition.x || item.position.y !== oldPosition.y)
      commands.push(
        ...animationEdit(
          project,
          item.source.transform.position.id,
          time,
          item.position,
          auto,
        ),
      );
    return commands;
  });
}
export function deleteLayerCommands(
  project: Project,
  composition: Composition,
  selection: readonly string[],
  time: number,
  parentBuilder: (
    project: Project,
    id: string,
    parent: string | null,
    time: number,
  ) => readonly Command[],
): Command[] {
  const ids = composition.layers
    .filter((l) => selection.includes(l.id) && !l.locked)
    .map((l) => l.id);
  return [
    ...composition.layers
      .filter(
        (l) =>
          !ids.includes(l.id) &&
          !!l.editor?.parentId &&
          ids.includes(l.editor.parentId),
      )
      .flatMap((l) => parentBuilder(project, l.id, null, time)),
    ...ids.map((layerId) =>
      command({ type: 'layer.delete', compositionId: composition.id, layerId }),
    ),
  ];
}
