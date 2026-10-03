/** Straight-alpha RGBA. A is foreground, B background; mask controls A coverage. */
export function mergePixels(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  mask?: Uint8ClampedArray,
  opacity = 1,
  mode = 0,
): Uint8ClampedArray {
  if (
    a.length !== b.length ||
    a.length % 4 ||
    (mask && mask.length !== a.length)
  )
    throw new Error('合成图像尺寸不一致');
  const out = new Uint8ClampedArray(a.length),
    blend = Math.round(mode);
  for (let i = 0; i < a.length; i += 4) {
    const af =
        (a[i + 3]! / 255) *
        Math.max(0, Math.min(1, opacity)) *
        (mask ? mask[i + 3]! / 255 : 1),
      ab = b[i + 3]! / 255;
    const alpha = blend === 3 ? Math.min(1, af + ab) : af + ab * (1 - af);
    out[i + 3] = alpha * 255;
    for (let c = 0; c < 3; c++) {
      const x = a[i + c]! / 255,
        y = b[i + c]! / 255;
      const f = blend === 1 ? x * y : blend === 2 ? 1 - (1 - x) * (1 - y) : x;
      const premultiplied =
        blend === 3
          ? Math.min(1, af * x + ab * y)
          : af * (1 - ab) * x + af * ab * f + (1 - af) * ab * y;
      out[i + c] = alpha ? (premultiplied / alpha) * 255 : 0;
    }
  }
  return out;
}
