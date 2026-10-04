/** Stable layer identity metadata. Actual colors live exclusively in design tokens. */
export const layerAccentIds = [
  'none',
  'accent-1',
  'accent-2',
  'accent-3',
  'accent-4',
  'accent-5',
  'accent-6',
] as const;
export type LayerAccentId = (typeof layerAccentIds)[number];
export const layerAccentLabels: Record<LayerAccentId, string> = {
  none: '无',
  'accent-1': '灰蓝',
  'accent-2': '灰紫',
  'accent-3': '灰红',
  'accent-4': '沙金',
  'accent-5': '灰绿',
  'accent-6': '青灰',
};
export function accentAt(index: number): LayerAccentId {
  return layerAccentIds[1 + (index % 6)]!;
}
export function layerAccent(layer: {
  id: string;
  ui?: { accentColorId?: LayerAccentId };
}): LayerAccentId {
  if (layer.ui?.accentColorId) return layer.ui.accentColorId;
  // Legacy in-memory objects without metadata still share identity across panels.
  let hash = 0;
  for (const c of layer.id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return accentAt(hash);
}
