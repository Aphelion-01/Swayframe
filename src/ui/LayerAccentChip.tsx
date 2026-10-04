import { layerAccent, layerAccentLabels } from '../core/layer-accent';
import type { Layer } from '../core/project-model';
export function LayerAccentChip({ layer }: { layer: Layer }) {
  const id = layerAccent(layer);
  return (
    <span
      className="layer-accent-chip"
      data-accent={id}
      role="img"
      aria-label={`图层色标：${layerAccentLabels[id]}`}
      title={`图层色标：${layerAccentLabels[id]}`}
    />
  );
}
