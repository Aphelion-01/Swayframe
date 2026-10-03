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
      tracking = layerValue(layer, 'tracking', time, 0) as number,
      lineHeight = layerValue(layer, 'lineHeight', time, 1.2) as number;
    ctx.font = `${layerValue(layer, 'fontWeight', time, 400)} ${size}px ${layer.fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const lines = layer.text.split('\n');
    lines.forEach((line, i) => {
      const chars = Array.from(line),
        width =
          chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) +
          Math.max(0, chars.length - 1) * tracking;
      let cursor =
        layer.editor?.textAlign === 'center'
          ? -width / 2
          : layer.editor?.textAlign === 'right'
            ? layer.width / 2 - width
            : x;
      for (const ch of chars) {
        ctx.fillText(
          ch,
          cursor,
          (i - (lines.length - 1) / 2) * size * lineHeight,
        );
        cursor += ctx.measureText(ch).width + tracking;
      }
    });
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
