import { evaluateProperty } from './animation-engine';
import type { Layer } from './project-model';
export interface GlyphMetrics {
  readonly width: number;
  readonly left?: number;
  readonly right?: number;
  readonly ascent?: number;
  readonly descent?: number;
}
export type TextMeasure = (
  layer: Layer,
  time: number,
  char: string,
) => GlyphMetrics;
export function textValue(
  layer: Layer,
  key: string,
  time: number,
  fallback: number,
): number {
  return layer.editor?.properties[key]
    ? (evaluateProperty(layer.editor.properties[key]!, time) as number)
    : fallback;
}
export function layoutText(layer: Layer, time: number, measure: TextMeasure) {
  if (layer.type !== 'text') return [];
  const size = textValue(layer, 'fontSize', time, layer.fontSize),
    tracking = textValue(layer, 'tracking', time, 0),
    lineHeight = textValue(layer, 'lineHeight', time, 1.2),
    lines = layer.text.split('\n');
  return lines.flatMap((line, i) => {
    const chars = Array.from(line).map((char) => ({
      char,
      metrics: measure(layer, time, char),
    }));
    const width =
      chars.reduce((sum, { metrics }) => sum + metrics.width, 0) +
      Math.max(0, chars.length - 1) * tracking;
    let x =
      layer.editor?.textAlign === 'center'
        ? -width / 2
        : layer.editor?.textAlign === 'right'
          ? layer.width / 2 - width
          : -layer.width / 2;
    const y = (i - (lines.length - 1) / 2) * size * lineHeight;
    return chars.map(({ char, metrics }) => {
      const glyph = { char, x, y, metrics };
      x += metrics.width + tracking;
      return glyph;
    });
  });
}
