import type { TextMeasure } from '../core/text-geometry';
import { textValue } from '../core/text-geometry';
export function createTextMeasurer(
  ctx: CanvasRenderingContext2D | null,
): TextMeasure | undefined {
  if (!ctx) return;
  return (layer, time, char) => {
    const size = textValue(
        layer,
        'fontSize',
        time,
        layer.type === 'text' ? layer.fontSize : 60,
      ),
      weight = textValue(layer, 'fontWeight', time, 400);
    ctx.save();
    ctx.font = `${textValue(layer, 'fontItalic', time, 0) === 1 ? 'italic ' : ''}${weight} ${size}px ${layer.type === 'text' ? layer.fontFamily : 'sans-serif'}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const m = ctx.measureText(char);
    ctx.restore();
    return {
      width: m.width,
      left: m.actualBoundingBoxLeft,
      right: m.actualBoundingBoxRight,
      ascent: m.actualBoundingBoxAscent,
      descent: m.actualBoundingBoxDescent,
    };
  };
}
