// Frozen scalar reference from the V0.3 interpreter for differential compatibility tests.
import type {
  EffectPackage,
  EffectContext,
} from '../../src/core/programmable-effect';
import type { AnimValue } from '../../src/core/core-types';
import { isVec2 } from '../../src/core/core-types';
export function referencePixels(
  p: EffectPackage,
  params: Readonly<Record<string, AnimValue>>,
  ctx: EffectContext,
  input?: Uint8ClampedArray,
) {
  const bindings = p.parameters.map((spec) => {
    const v = params[spec.id] ?? spec.defaultValue;
    return typeof v === 'number'
      ? [v]
      : Array.isArray(v)
        ? v
        : isVec2(v)
          ? [v.x, v.y]
          : [...v];
  });
  const parameterIndices = p.program.instructions.map((n) =>
    p.parameters.findIndex((s) => s.id === n.parameter),
  );
  const out = new Uint8ClampedArray(ctx.width * ctx.height * 4),
    values = new Float64Array(p.program.instructions.length);
  for (let y = 0; y < ctx.height; y++)
    for (let x = 0; x < ctx.width; x++) {
      const pixel = (y * ctx.width + x) * 4;
      p.program.instructions.forEach((n, i) => {
        const a = values[n.args?.[0] ?? 0]!,
          b = values[n.args?.[1] ?? 0]!,
          c = values[n.args?.[2] ?? 0]!;
        let value = 0;
        switch (n.op) {
          case 'constant':
            value = n.value!;
            break;
          case 'parameter':
            value = bindings[parameterIndices[i]!]![n.component ?? 0]!;
            break;
          case 'u':
            value = (x + 0.5) / ctx.width;
            break;
          case 'v':
            value = (y + 0.5) / ctx.height;
            break;
          case 'time':
            value = ctx.time;
            break;
          case 'frame':
            value = ctx.frame;
            break;
          case 'width':
            value = ctx.width;
            break;
          case 'height':
            value = ctx.height;
            break;
          case 'aspect':
            value = ctx.width / ctx.height;
            break;
          case 'input':
            value = input![pixel + (n.component ?? 0)]! / 255;
            break;
          case 'add':
            value = a + b;
            break;
          case 'subtract':
            value = a - b;
            break;
          case 'multiply':
            value = a * b;
            break;
          case 'divide':
            value = Math.abs(b) < 1e-12 ? 0 : a / b;
            break;
          case 'sin':
            value = Math.sin(a);
            break;
          case 'cos':
            value = Math.cos(a);
            break;
          case 'abs':
            value = Math.abs(a);
            break;
          case 'sqrt':
            value = Math.sqrt(Math.max(0, a));
            break;
          case 'floor':
            value = Math.floor(a);
            break;
          case 'min':
            value = Math.min(a, b);
            break;
          case 'max':
            value = Math.max(a, b);
            break;
          case 'clamp':
            value = Math.max(b, Math.min(c, a));
            break;
          case 'mix':
            value = a + (b - a) * c;
            break;
          case 'smoothstep': {
            const t = Math.max(0, Math.min(1, (c - a) / (b - a || 1e-12)));
            value = t * t * (3 - 2 * t);
            break;
          }
          case 'noise': {
            const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
            value = n - Math.floor(n);
            break;
          }
        }
        values[i] = Number.isFinite(value) ? value : 0;
      });
      p.program.rgba.forEach((id, c) => {
        out[pixel + c] = Math.max(0, Math.min(1, values[id]!)) * 255;
      });
    }
  return out;
}
