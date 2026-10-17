import { z } from 'zod';
export const layerPackLimits = {
  manifestBytes: 128_000,
  fileBytes: 8_000_000,
  totalBytes: 12_000_000,
  imagePixels: 8_388_608,
  totalPixels: 24_000_000,
  canvasPixels: 16_777_216,
  layers: 32,
  files: 66,
  depth: 8,
} as const;
export class LayerPackError extends Error {
  constructor(message: string) {
    super(`Layer Package：${message}`);
    this.name = 'LayerPackError';
  }
}
export function safeLayerPackPath(value: string): boolean {
  return (
    value.length <= 512 &&
    !/[\\:%?#\0]/.test(value) &&
    !value.startsWith('/') &&
    value
      .split('/')
      .every((part) => part.length > 0 && part !== '.' && part !== '..')
  );
}
const dimension = z.number().int().min(1).max(8192);
export const layerPackManifestSchema = z
  .object({
    format: z.literal('swayframe.layerpack'),
    version: z.literal(1),
    colorSpace: z.literal('srgb').default('srgb'),
    alphaMode: z.literal('straight').default('straight'),
    order: z.literal('bottom-to-top').default('bottom-to-top'),
    canvas: z.object({ width: dimension, height: dimension }).strict(),
    layers: z
      .array(
        z
          .object({
            id: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/),
            name: z.string().min(1).max(200),
            type: z.literal('raster'),
            asset: z
              .string()
              .refine(
                (p) =>
                  safeLayerPackPath(p) &&
                  p.startsWith('layers/') &&
                  /\.png$/i.test(p),
                '只支持包内 layers/ 相对 PNG 路径',
              ),
            bounds: z
              .object({
                x: z.number().int().min(0),
                y: z.number().int().min(0),
                width: dimension,
                height: dimension,
              })
              .strict(),
            opacity: z.number().min(0).max(1).default(1),
          })
          .strict(),
      )
      .min(1)
      .max(layerPackLimits.layers),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (
      manifest.canvas.width * manifest.canvas.height >
      layerPackLimits.canvasPixels
    )
      fail('画布像素数超限');
    if (
      new Set(manifest.layers.map((l) => l.id)).size !== manifest.layers.length
    )
      fail('图层 ID 重复');
    let pixels = 0;
    for (const layer of manifest.layers) {
      const b = layer.bounds;
      pixels += b.width * b.height;
      if (
        b.x + b.width > manifest.canvas.width ||
        b.y + b.height > manifest.canvas.height
      )
        fail(`图层 ${layer.id} 的 bounds 超出画布`);
      if (b.width * b.height > layerPackLimits.imagePixels)
        fail(`图层 ${layer.id} 的像素数超限`);
    }
    if (pixels > layerPackLimits.totalPixels) fail('图层总像素数超限');
  });
export type LayerPackManifest = z.infer<typeof layerPackManifestSchema>;
export interface PreparedLayerPack {
  manifest: LayerPackManifest;
  images: {
    asset: string;
    dataUrl: string;
    width: number;
    height: number;
    sha256: string;
  }[];
}
export function parseLayerPackManifest(raw: unknown): LayerPackManifest {
  const result = layerPackManifestSchema.safeParse(raw);
  if (!result.success)
    throw new LayerPackError(
      result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    );
  return result.data;
}
