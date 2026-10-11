import type { AnimValue, Vec2 } from './core-types';
import type { VisualCapabilityDefinition } from './visual-capabilities';
export const radialGradientDefinition: VisualCapabilityDefinition = {
  id: 'radialGradient',
  version: '1.0.0',
  name: '径向渐变',
  description: '中心、半径、多色标和变换可动画的径向渐变',
  category: 'fill',
  group: 'Generate',
  inputs: [],
  outputs: [{ id: 'out', name: '图像', type: 'Image' }],
  parameters: [
    {
      id: 'center',
      name: '中心',
      type: 'vec2',
      defaultValue: { x: 0.5, y: 0.5 },
      animatable: true,
    },
    {
      id: 'radius',
      name: '半径',
      type: 'float',
      defaultValue: 0.5,
      min: 0.001,
      max: 10,
      animatable: true,
    },
    {
      id: 'aspect',
      name: '宽高比',
      type: 'float',
      defaultValue: 1,
      min: 0.01,
      max: 100,
      animatable: true,
    },
    {
      id: 'stops',
      name: '渐变色标',
      type: 'gradientStops',
      defaultValue: [0, 1, 1, 1, 1, 1, 0.18, 0.42, 1, 1],
      animatable: true,
    },
    {
      id: 'opacity',
      name: '渐变不透明度',
      type: 'float',
      defaultValue: 1,
      min: 0,
      max: 1,
      animatable: true,
    },
    {
      id: 'offset',
      name: '偏移',
      type: 'vec2',
      defaultValue: { x: 0, y: 0 },
      animatable: true,
    },
    {
      id: 'scale',
      name: '渐变缩放',
      type: 'vec2',
      defaultValue: { x: 1, y: 1 },
      min: 0.001,
      max: 100,
      animatable: true,
    },
    {
      id: 'rotation',
      name: '渐变旋转',
      type: 'float',
      defaultValue: 0,
      animatable: true,
    },
    {
      id: 'interpolation',
      name: '颜色插值',
      type: 'enum',
      options: ['sRGB', '线性光'],
      defaultValue: 0,
      animatable: true,
    },
  ],
  implementation: { kind: 'native', entryPoint: 'radialGradient' },
  capabilities: {
    animatable: true,
    realtime: true,
    deterministic: true,
    usesTime: false,
  },
  keywords: ['radial', 'gradient', '白心蓝边', '渐变'],
};
export const radialDefaults = () =>
  Object.fromEntries(
    radialGradientDefinition.parameters.map((p) => [
      p.id,
      structuredClone(p.defaultValue),
    ]),
  );
export const gradientPropertyKey = (id: string) => 'radial_' + id;
const linear = (v: number) =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const srgb = (v: number) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
/** Premultiplied-alpha interpolation avoids dark halos at transparent stops. */
export function gradientColor(
  stops: readonly number[],
  t: number,
  linearLight = false,
): readonly number[] {
  let i = 0;
  while (i + 5 < stops.length && t > stops[i + 5]!) i += 5;
  const j = Math.min(i + 5, stops.length - 5),
    span = stops[j]! - stops[i]!;
  const f = span > 0 ? Math.max(0, Math.min(1, (t - stops[i]!) / span)) : 0;
  const a = stops[i + 4]! * (1 - f) + stops[j + 4]! * f;
  return [1, 2, 3]
    .map((k) => {
      const left = linearLight ? linear(stops[i + k]!) : stops[i + k]!,
        right = linearLight ? linear(stops[j + k]!) : stops[j + k]!;
      const c =
        a > 0
          ? (left * stops[i + 4]! * (1 - f) + right * stops[j + 4]! * f) / a
          : 0;
      return linearLight ? srgb(c) : c;
    })
    .concat(a);
}
export function radialPixels(
  width: number,
  height: number,
  params: Readonly<Record<string, AnimValue>>,
): Uint8ClampedArray {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 16777216
  )
    throw Error('渐变尺寸超出资源上限');
  const p = { ...radialDefaults(), ...params },
    center = p.center as Vec2,
    offset = p.offset as Vec2,
    scale = p.scale as Vec2;
  const angle = (Number(p.rotation) * Math.PI) / 180,
    cos = Math.cos(angle),
    sin = Math.sin(angle),
    radius = Math.max(0.001, Number(p.radius)) * Math.min(width, height);
  const table = new Uint8ClampedArray(4097 * 4);
  for (let i = 0; i <= 4096; i++) {
    const c = gradientColor(
      p.stops as readonly number[],
      i / 4096,
      Number(p.interpolation) === 1,
    );
    for (let k = 0; k < 4; k++)
      table[i * 4 + k] = c[k]! * 255 * (k === 3 ? Number(p.opacity) : 1);
  }
  const data = new Uint8ClampedArray(width * height * 4),
    cx = (center.x + offset.x) * width,
    cy = (center.y + offset.y) * height,
    sx = 1 / (Math.max(0.001, scale.x) * Math.max(0.01, Number(p.aspect))),
    sy = 1 / Math.max(0.001, scale.y),
    inverseRadius = 4096 / radius;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const dx = x + 0.5 - cx,
        dy = y + 0.5 - cy,
        u = (dx * cos + dy * sin) * sx,
        v = (-dx * sin + dy * cos) * sy;
      const index =
          Math.min(4096, Math.round(Math.sqrt(u * u + v * v) * inverseRadius)) *
          4,
        n = (y * width + x) * 4;
      data[n] = table[index]!;
      data[n + 1] = table[index + 1]!;
      data[n + 2] = table[index + 2]!;
      data[n + 3] = table[index + 3]!;
    }
  return data;
}
