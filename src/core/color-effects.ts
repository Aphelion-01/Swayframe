import type { Effect } from './project-model';
import { evaluateProperty } from './animation-engine';
export function effectValues(
  effect: Effect,
  time: number,
): Readonly<Record<string, number>> {
  return Object.fromEntries(
    Object.entries(effect.parameters).map(([k, p]) => [
      k,
      evaluateProperty(p, time),
    ]),
  );
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
function hsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d)
    h =
      max === r
        ? ((g - b) / d) % 6
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
  return [(h / 6 + 1) % 1, max ? d / max : 0, max];
}
function rgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s,
    x = c * (1 - Math.abs(((h * 6) % 2) - 1)),
    m = v - c;
  const n = Math.floor(h * 6) % 6,
    values: [
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ] = [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ];
  return values[n]!.map((v) => v + m) as [number, number, number];
}
export function applyColorEffect(
  pixels: Uint8ClampedArray,
  effect: Effect,
  time: number,
): void {
  if (
    !effect.enabled ||
    ['gaussianBlur', 'dropShadow', 'glow'].includes(effect.kind)
  )
    return;
  const p = effectValues(effect, time);
  for (let i = 0; i < pixels.length; i += 4) {
    let r = pixels[i]! / 255,
      g = pixels[i + 1]! / 255,
      b = pixels[i + 2]! / 255;
    switch (effect.kind) {
      case 'brightnessContrast': {
        const factor = 2 ** ((p.contrast ?? 0) / 100),
          brightness = (p.brightness ?? 0) / 100;
        r = (r - 0.5) * factor + 0.5 + brightness;
        g = (g - 0.5) * factor + 0.5 + brightness;
        b = (b - 0.5) * factor + 0.5 + brightness;
        break;
      }
      case 'exposure': {
        const f = 2 ** (p.exposure ?? 0);
        r *= f;
        g *= f;
        b *= f;
        break;
      }
      case 'hueSaturation': {
        const [h, s, v] = hsv(r, g, b);
        [r, g, b] = rgb(
          (((h + (p.hue ?? 0) / 360) % 1) + 1) % 1,
          clamp(s * (1 + (p.saturation ?? 0) / 100)),
          v,
        );
        const lightness = Math.max(-1, Math.min(1, (p.lightness ?? 0) / 100));
        const adjust = (v: number) =>
          lightness >= 0 ? v + (1 - v) * lightness : v * (1 + lightness);
        r = adjust(r);
        g = adjust(g);
        b = adjust(b);
        break;
      }
      case 'temperature': {
        const t = (p.temperature ?? 0) / 500;
        r += t;
        b -= t;
        break;
      }
      case 'tint': {
        const t = (p.tint ?? 0) / 500;
        r += t;
        b += t;
        g -= t;
        break;
      }
      case 'levels': {
        const black = p.black ?? 0,
          white = p.white ?? 1,
          range = Math.max(0.001, white - black),
          gamma = Math.max(0.1, p.gamma ?? 1);
        r = clamp((r - black) / range) ** (1 / gamma);
        g = clamp((g - black) / range) ** (1 / gamma);
        b = clamp((b - black) / range) ** (1 / gamma);
        break;
      }
      case 'tintFill': {
        const a = clamp(p.amount ?? 1);
        r = r * (1 - a) + (p.red ?? 0) * a;
        g = g * (1 - a) + (p.green ?? 0) * a;
        b = b * (1 - a) + (p.blue ?? 0) * a;
        break;
      }
    }
    pixels[i] = clamp(r) * 255;
    pixels[i + 1] = clamp(g) * 255;
    pixels[i + 2] = clamp(b) * 255;
  }
}
