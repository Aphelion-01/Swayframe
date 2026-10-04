import { layoutText } from '../core/text-geometry';
import type { AnimValue, Color } from '../core/core-types';
import type { Layer } from '../core/project-model';
import { evaluateProperty } from '../core/animation-engine';
import { pathSvg, regularPath } from '../core/shape-geometry';
export const cssColor = (color: Color): string =>
  `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${color.a})`;
export function layerValue(
  layer: Layer,
  key: string,
  time: number,
  fallback: AnimValue,
): AnimValue {
  return layer.editor?.properties[key]
    ? evaluateProperty(layer.editor.properties[key]!, time)
    : fallback;
}
export function colorValue(value: AnimValue): Color {
  const a = value as readonly number[];
  return {
    r: Math.max(0, Math.min(1, a[0] ?? 0)),
    g: Math.max(0, Math.min(1, a[1] ?? 0)),
    b: Math.max(0, Math.min(1, a[2] ?? 0)),
    a: Math.max(0, Math.min(1, a[3] ?? 1)),
  };
}
export function drawContent(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  time: number,
  image?: CanvasImageSource,
): void {
  const x = -layer.width / 2,
    y = -layer.height / 2,
    base = 'fill' in layer ? layer.fill : { r: 0.18, g: 0.42, b: 1, a: 1 };
  const fill = colorValue(
    layerValue(layer, 'fill', time, [base.r, base.g, base.b, base.a]),
  );
  ctx.fillStyle = cssColor(fill);
  if (layer.editor?.gradient !== 'none' && layer.editor?.gradient) {
    const gradient =
      layer.editor.gradient === 'linear'
        ? ctx.createLinearGradient(x, y, -x, -y)
        : ctx.createRadialGradient(
            0,
            0,
            0,
            0,
            0,
            Math.max(layer.width, layer.height) / 2,
          );
    gradient.addColorStop(0, cssColor(fill));
    gradient.addColorStop(
      1,
      cssColor(
        colorValue(layerValue(layer, 'gradientEnd', time, [1, 0, 0, 1])),
      ),
    );
    ctx.fillStyle = gradient;
  }
  if (layer.type === 'solid') {
    ctx.fillRect(x, y, layer.width, layer.height);
    return;
  }
  if (layer.type === 'shape') {
    ctx.beginPath();
    if (layer.shapeKind === 'rectangle')
      ctx.rect(x, y, layer.width, layer.height);
    else if (layer.shapeKind === 'ellipse')
      ctx.ellipse(0, 0, layer.width / 2, layer.height / 2, 0, 0, Math.PI * 2);
    else {
      const path =
        layer.shapeKind === 'path'
          ? (layerValue(layer, 'path', time, []) as readonly number[])
          : regularPath(
              layerValue(layer, 'sides', time, 5) as number,
              layer.width,
              layer.height,
              layer.shapeKind === 'star'
                ? (layerValue(layer, 'innerRadius', time, 0.45) as number)
                : undefined,
            );
      const geometry = new Path2D(
        pathSvg(
          path,
          layer.shapeKind === 'path'
            ? layer.editor?.pathClosed !== false
            : true,
        ),
      );
      ctx.fill(geometry);
      const sw = layerValue(layer, 'strokeWidth', time, 0) as number;
      if (sw > 0) {
        ctx.lineWidth = sw;
        ctx.strokeStyle = cssColor(
          colorValue(layerValue(layer, 'stroke', time, [1, 1, 1, 1])),
        );
        ctx.lineJoin = layer.editor?.strokeJoin ?? 'round';
        ctx.lineCap = layer.editor?.strokeCap ?? 'round';
        ctx.stroke(geometry);
      }
      return;
    }
    ctx.fill();
    const sw = layerValue(layer, 'strokeWidth', time, 0) as number;
    if (sw > 0) {
      ctx.lineWidth = sw;
      ctx.strokeStyle = cssColor(
        colorValue(layerValue(layer, 'stroke', time, [1, 1, 1, 1])),
      );
      ctx.lineJoin = layer.editor?.strokeJoin ?? 'round';
      ctx.lineCap = layer.editor?.strokeCap ?? 'round';
      ctx.stroke();
    }
  } else if (layer.type === 'text') {
    const size = layerValue(layer, 'fontSize', time, layer.fontSize) as number,
      weight = layerValue(layer, 'fontWeight', time, 400) as number;
    ctx.font = `${weight} ${size}px ${layer.fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (const glyph of layoutText(layer, time, (_layer, _time, char) => ({
      width: ctx.measureText(char).width,
    }))) {
      ctx.fillText(glyph.char, glyph.x, glyph.y);
    }
  } else if (layer.type === 'image') {
    if (image) ctx.drawImage(image, x, y, layer.width, layer.height);
    else {
      ctx.fillStyle = '#293348';
      ctx.fillRect(x, y, layer.width, layer.height);
      ctx.fillStyle = '#b9c4da';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('图片', 0, 0);
    }
  }
}
