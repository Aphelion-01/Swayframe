import type { RenderSnapshot } from '../core/renderer-core';
/** UI rendering policy only. Export never calls this policy. */
export function previewEffectScale(
  input: RenderSnapshot,
  interactive: boolean,
) {
  if (!interactive) return 1;
  let operations = 0;
  const seen = new Set<string>();
  const visit = (snapshot: RenderSnapshot) => {
    for (const item of snapshot.layers) {
      const layer = item.source;
      if (item.active === false || !layer.visible) continue;
      for (const node of layer.editor?.graph?.nodes ?? []) {
        if (node.enabled !== false && node.effectPackage)
          operations +=
            layer.width *
            layer.height *
            node.effectPackage.program.instructions.length;
      }
      if (
        layer.type === 'precomp' &&
        layer.compositionId &&
        input.project &&
        !seen.has(layer.compositionId)
      ) {
        seen.add(layer.compositionId);
        const c = input.project.compositions.find(
          (c) => c.id === layer.compositionId,
        );
        if (c)
          visit({
            ...snapshot,
            layers: c.layers.map((source) => ({ ...item, source })),
          });
        seen.delete(layer.compositionId);
      }
    }
  };
  visit(input);
  // Powers of two prevent quality jitter as parameters change.
  let scale = 1;
  while (operations * scale * scale > 4_000_000 && scale > 1 / 16) scale /= 2;
  return scale;
}
