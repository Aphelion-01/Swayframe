import type { Layer, Project } from '../core/project-model';
import { evaluateProperty } from '../core/animation-engine';
/** Pixel inputs only: no node positions, names, selection or viewport preferences. */
export function compositingSourceKey(
  layer: Layer,
  time: number,
  assets: number,
  padding: number,
  project?: Project,
): string {
  function pixelData(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    if ('baseValue' in value && 'keyframes' in value)
      return evaluateProperty(
        value as import('../core/project-model').Property<
          import('../core/core-types').AnimValue
        >,
        time,
      );
    if (Array.isArray(value)) return value.map(pixelData);
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([k]) =>
            !['name', 'semantic', 'metadata'].includes(k) &&
            !(k === 'position' && 'params' in value),
        )
        .map(([k, v]) => [k, pixelData(v)]),
    );
  }
  const { graph, effects, ...editor } = layer.editor ?? {};
  void graph;
  void effects;
  const nested =
    layer.type === 'precomp' && project
      ? project.compositions.find((c) => c.id === layer.compositionId)
      : undefined;
  const ancestors = new Set<string>();
  const nestedData = (composition: typeof nested): unknown => {
    if (!composition || ancestors.has(composition.id)) return null;
    ancestors.add(composition.id);
    return [
      pixelData(composition),
      composition.layers
        .filter((l) => l.type === 'precomp')
        .map((l) =>
          nestedData(
            project?.compositions.find(
              (c) =>
                c.id === ('compositionId' in l ? l.compositionId : undefined),
            ),
          ),
        ),
    ];
  };
  return JSON.stringify([
    assets,
    padding,
    layer.width,
    layer.height,
    layer.type,
    'shapeKind' in layer ? layer.shapeKind : null,
    'text' in layer ? [layer.text, layer.fontFamily, layer.fontSize] : null,
    'fill' in layer ? layer.fill : null,
    'assetId' in layer ? layer.assetId : null,
    pixelData(editor),
    nested ? [time, nestedData(nested)] : null,
  ]);
}
