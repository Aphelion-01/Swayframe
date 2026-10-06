import type { EditorStore } from './editor-store';
import type { AnimValue, Vec2 } from '../core/core-types';
import { activeComposition, findProperty } from '../core/project-model';
import { createRenderSnapshot } from '../core/renderer-core';
import { createTransformContext } from '../core/transform-resolvers';
import {
  transformItems,
  restoreCollapsedScale,
} from '../core/transform-operations';
import {
  transformEditCommands,
  transformPreviewComposition,
} from '../core/transform-editing';
import { evaluateProperty } from '../core/animation-engine';
/** Inspector and Canvas share context, pivot compensation and the existing transaction builder. */
export function transformPropertyEdit(
  store: EditorStore,
  propertyId: string,
  value: AnimValue,
  commit: boolean,
): boolean {
  const view = store.getSnapshot(),
    found = findProperty(view.project, propertyId);
  if (
    !['transform.scale', 'transform.rotation'].includes(found.key) ||
    found.layer.editor?.is3D ||
    !view.selection.includes(found.layer.id)
  )
    return false;
  const kind = found.key === 'transform.scale' ? 'scale' : 'rotate';
  try {
    const composition = activeComposition(view.project),
      snapshot = createRenderSnapshot(
        composition,
        view.time,
        view.selection,
        undefined,
        view.project,
      );
    const context = createTransformContext(
      snapshot,
      view.selection,
      view.transformSettings,
      store.textMeasure,
    );
    if (
      [...context.initialTransforms.values()].some(
        (item) => item.source.editor?.is3D,
      )
    )
      return false;
    const before = evaluateProperty(found.property, view.time);
    const collapsed =
      kind === 'scale' &&
      (Math.abs((before as Vec2).x) < 1e-9 ||
        Math.abs((before as Vec2).y) < 1e-9);
    const operation =
      kind === 'scale'
        ? ({
            kind,
            factor: {
              x: (value as Vec2).x / (before as Vec2).x,
              y: (value as Vec2).y / (before as Vec2).y,
            },
          } as const)
        : ({ kind, angle: (value as number) - (before as number) } as const);
    const items = collapsed
      ? restoreCollapsedScale(
          context,
          found.layer.id,
          value as Vec2,
          store.textMeasure,
        )
      : transformItems(context, operation);
    if (commit) {
      store.setPropertyPreview(undefined);
      const commands = transformEditCommands(
        view.project,
        snapshot,
        items,
        kind,
        view.time,
        view.autoKeyframes,
      );
      if (commands.length) store.run('属性变换', commands);
    } else {
      const preview = transformPreviewComposition(composition, snapshot, items);
      store.setPropertyPreviews(
        preview.layers
          .filter((l) => context.selectedLayerIds.includes(l.id))
          .flatMap((l) => [
            l.transform.position,
            l.transform.scale,
            l.transform.rotation,
          ]),
      );
    }
  } catch (error) {
    store.setPropertyPreview(undefined);
    store.setStatus(
      error instanceof Error ? error.message : '无法计算变换',
      true,
    );
  }
  return true;
}
