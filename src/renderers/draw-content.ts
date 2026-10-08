import {
  radialPixels,
  radialDefaults,
  gradientPropertyKey,
} from '../core/radial-gradient';
import { layoutText, textValue } from '../core/text-geometry';
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
  if (
    layer.editor?.gradient === 'radial' &&
    layer.editor.properties.radial_center
  ) {
    const w = Math.ceil(layer.width),
      h = Math.ceil(layer.height),
      canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const local = canvas.getContext('2d')!,
      pixels = local.createImageData(w, h);
    pixels.data.set(
      radialPixels(
        w,
        h,
        Object.fromEntries(
          Object.entries(radialDefaults()).map(([key, fallback]) => [
            key,
            layerValue(layer, gradientPropertyKey(key), time, fallback),
          ]),
        ),
      ),
    );
    local.putImageData(pixels, 0, 0);
    const pattern = ctx.createPattern(canvas, 'no-repeat');
    if (pattern) {
      pattern.setTransform(new DOMMatrix().translate(x, y));
      ctx.fillStyle = pattern;
    }
  } else if (layer.editor?.gradient !== 'none' && layer.editor?.gradient) {
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
    ctx.font = `${textValue(layer, 'fontItalic', time, 0) === 1 ? 'italic ' : ''}${weight} ${size}px ${layer.fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (const glyph of layoutText(layer, time, (_layer, _time, char) => ({
      width: ctx.measureText(char).width,
    }))) {
      if (glyph.rotation === 0 && glyph.scale === 1 && glyph.opacity === 1) {
        ctx.fillText(glyph.char, glyph.x, glyph.y);
        if (textValue(layer, 'textUnderline', time, 0) === 1)
          ctx.fillRect(
            glyph.x,
            glyph.y + size * 0.4,
            glyph.metrics.width,
            Math.max(1, size / 18),
          );
        continue;
      }
      ctx.save();
      ctx.translate(glyph.x, glyph.y);
      ctx.rotate((glyph.rotation * Math.PI) / 180);
      ctx.scale(glyph.scale, glyph.scale);
      ctx.globalAlpha *= glyph.opacity;
      ctx.fillText(glyph.char, 0, 0);
      if (textValue(layer, 'textUnderline', time, 0) === 1)
        ctx.fillRect(
          0,
          size * 0.4,
          glyph.metrics.width,
          Math.max(1, size / 18),
        );
      ctx.restore();
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
