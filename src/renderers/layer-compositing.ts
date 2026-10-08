import { layerEffects } from '../core/compositing-migration';
import { textValue } from '../core/text-geometry';
import type { Layer } from '../core/project-model';
import { evaluateProperty } from '../core/animation-engine';
import { pathSvg } from '../core/shape-geometry';
import { applyColorEffect, effectValues } from '../core/color-effects';
export function surface(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}
export function layerPadding(layer: Layer, time: number): number {
  let pad =
    Number(
      layer.editor?.properties.strokeWidth
        ? evaluateProperty(layer.editor.properties.strokeWidth, time)
        : 0,
    ) /
      2 +
    2;
  if (
    layer.type === 'text' &&
    textValue(layer, 'textAnimatorEnabled', time, 0) === 1
  ) {
    const scale = Math.abs(
      textValue(layer, 'textAnimatorScale', time, 100) / 100,
    );
    pad = Math.max(
      pad,
      Math.hypot(
        textValue(layer, 'textAnimatorX', time, 0),
        textValue(layer, 'textAnimatorY', time, 40),
      ) +
        (Math.hypot(layer.width, layer.height) * Math.max(0, scale - 1)) / 2 +
        (textValue(layer, 'textAnimatorRotation', time, 0)
          ? Math.hypot(layer.width, layer.height) / 2
          : 0),
    );
  }
  for (const mask of layer.editor?.masks ?? [])
    pad = Math.max(
      pad,
      evaluateProperty(mask.feather, time) * 3 +
        Math.max(0, evaluateProperty(mask.expansion, time)),
    );
  for (const effect of layerEffects(layer))
    if (effect.enabled) {
      const p = effectValues(effect, time);
      if (['gaussianBlur', 'dropShadow', 'glow'].includes(effect.kind))
        pad = Math.max(
          pad,
          (p.radius ?? 0) * 3 +
            Math.max(Math.abs(p.x ?? 0), Math.abs(p.y ?? 0)),
        );
    }
  for (const node of layer.editor?.graph?.nodes ?? [])
    if (node.enabled) {
      const number = (key: string) =>
        node.params[key]
          ? Number(evaluateProperty(node.params[key]!, time))
          : 0;
      if (['gaussianBlur', 'glow', 'dropShadow'].includes(node.type))
        pad = Math.max(
          pad,
          number('radius') * 3 +
            Math.max(Math.abs(number('x')), Math.abs(number('y'))),
        );
      if (node.type === 'transform') {
        const position = evaluateProperty(node.params.position!, time) as {
          x: number;
          y: number;
        };
        const scale = evaluateProperty(node.params.scale!, time) as {
          x: number;
          y: number;
        };
        const anchor = evaluateProperty(node.params.anchor!, time) as {
          x: number;
          y: number;
        };
        pad = Math.max(
          pad,
          Math.hypot(
            layer.width * Math.max(1, Math.abs(scale.x)),
            layer.height * Math.max(1, Math.abs(scale.y)),
          ) /
            2 +
            Math.hypot(position.x, position.y) +
            Math.hypot(anchor.x, anchor.y),
        );
      }
    }
  return Math.min(1024, Math.ceil(pad));
}
export function applyMasks(
  content: HTMLCanvasElement,
  layer: Layer,
  time: number,
  padding: number,
): HTMLCanvasElement {
  const masks = layer.editor?.masks.filter((m) => m.enabled) ?? [];
  if (!masks.length) return content;
  const combined = surface(content.width, content.height),
    ctx = combined.getContext('2d')!;
  if (masks[0]!.mode !== 'add') {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, combined.width, combined.height);
  }
  for (const mask of masks) {
    const shape = surface(content.width, content.height),
      m = shape.getContext('2d')!,
      path = evaluateProperty(mask.path, time),
      expansion = evaluateProperty(mask.expansion, time),
      opacity = evaluateProperty(mask.opacity, time),
      feather = evaluateProperty(mask.feather, time);
    m.translate(layer.width / 2 + padding, layer.height / 2 + padding);
    m.fillStyle = 'white';
    m.strokeStyle = 'white';
    m.globalAlpha = opacity;
    m.filter = `blur(${Math.max(0, feather)}px)`;
    const xs = path.filter((_, i) => i % 6 === 0),
      ys = path.filter((_, i) => i % 6 === 1),
      x = Math.min(...xs),
      y = Math.min(...ys),
      w = Math.max(...xs) - x,
      h = Math.max(...ys) - y,
      geometry = new Path2D();
    if (mask.kind === 'rectangle') geometry.rect(x, y, w, h);
    else if (mask.kind === 'ellipse')
      geometry.ellipse(
        x + w / 2,
        y + h / 2,
        Math.max(0, w / 2),
        Math.max(0, h / 2),
        0,
        0,
        Math.PI * 2,
      );
    else geometry.addPath(new Path2D(pathSvg(path, true)));
    m.fill(geometry);
    if (expansion) {
      m.globalCompositeOperation =
        expansion > 0 ? 'source-over' : 'destination-out';
      m.lineWidth = Math.abs(expansion) * 2;
      m.stroke(geometry);
    }
    ctx.globalCompositeOperation =
      mask.mode === 'subtract'
        ? 'destination-out'
        : mask.mode === 'intersect'
          ? 'destination-in'
          : 'source-over';
    ctx.drawImage(shape, 0, 0);
  }
  const target = surface(content.width, content.height),
    out = target.getContext('2d')!;
  out.drawImage(content, 0, 0);
  out.globalCompositeOperation = 'destination-in';
  out.drawImage(combined, 0, 0);
  return target;
}
export function applyEffects(
  content: HTMLCanvasElement,
  layer: Layer,
  time: number,
): HTMLCanvasElement {
  let result = content;
  for (const effect of layerEffects(layer)) {
    if (!effect.enabled) continue;
    const p = effectValues(effect, time),
      next = surface(result.width, result.height),
      ctx = next.getContext('2d')!;
    if (effect.kind === 'gaussianBlur') {
      ctx.filter = `blur(${Math.max(0, p.radius ?? 0)}px)`;
      ctx.drawImage(result, 0, 0);
    } else if (effect.kind === 'dropShadow') {
      ctx.shadowColor = `rgba(0,0,0,${Math.max(0, Math.min(1, p.amount ?? 0.6))})`;
      ctx.shadowBlur = Math.max(0, p.radius ?? 0);
      ctx.shadowOffsetX = p.x ?? 15;
      ctx.shadowOffsetY = p.y ?? 15;
      ctx.drawImage(result, 0, 0);
    } else if (effect.kind === 'glow') {
      ctx.filter = `blur(${Math.max(0, p.radius ?? 0)}px)`;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.amount ?? 0.8));
      ctx.drawImage(result, 0, 0);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(result, 0, 0);
    } else {
      ctx.drawImage(result, 0, 0);
      const pixels = ctx.getImageData(0, 0, result.width, result.height);
      applyColorEffect(pixels.data, effect, time);
      ctx.putImageData(pixels, 0, 0);
    }
    result = next;
  }
  return result;
}
