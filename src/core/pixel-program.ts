import type { EffectContext, EffectPackage } from './programmable-effect';

// Fixed bytecode only. No source generation, eval or dynamic Function.
const codes = {
  constant: 0,
  parameter: 1,
  u: 2,
  v: 3,
  time: 4,
  frame: 5,
  width: 6,
  height: 7,
  aspect: 8,
  input: 9,
  add: 10,
  subtract: 11,
  multiply: 12,
  divide: 13,
  sin: 14,
  cos: 15,
  abs: 16,
  sqrt: 17,
  floor: 18,
  min: 19,
  max: 20,
  clamp: 21,
  mix: 22,
  smoothstep: 23,
  noise: 24,
} as const;
// At most 8 MiB of optional column reuse per render, independently of image shape.
export const maxColumnCacheValues = 1_048_576;

/** Compile dependency schedules once; parameters and frame inputs remain late bound. */
export function compilePixelProgram(p: EffectPackage) {
  const instructions = p.program.instructions,
    count = instructions.length,
    op = new Uint8Array(count),
    a = new Uint16Array(count),
    b = new Uint16Array(count),
    c = new Uint16Array(count),
    component = new Uint16Array(count),
    parameter = new Int16Array(count),
    constants = new Float64Array(count),
    dependency = new Uint8Array(count),
    used = new Uint8Array(count);
  for (const id of p.program.rgba) used[id] = 1;
  for (let i = count - 1; i >= 0; i--)
    if (used[i]) for (const arg of instructions[i]!.args ?? []) used[arg] = 1;
  const uniform: number[] = [],
    rows: number[] = [],
    columns: number[] = [],
    pixels: number[] = [],
    uncachedPixels: number[] = [];
  for (let i = 0; i < count; i++) {
    const n = instructions[i]!;
    op[i] = codes[n.op];
    a[i] = n.args?.[0] ?? 0;
    b[i] = n.args?.[1] ?? 0;
    c[i] = n.args?.[2] ?? 0;
    component[i] = n.component ?? 0;
    constants[i] = n.value ?? 0;
    parameter[i] = p.parameters.findIndex((s) => s.id === n.parameter);
    dependency[i] =
      n.op === 'u'
        ? 1
        : n.op === 'v'
          ? 2
          : n.op === 'input'
            ? 4
            : (n.args ?? []).reduce((mask, id) => mask | dependency[id]!, 0);
    if (!used[i]) continue;
    if (dependency[i] === 0) uniform.push(i);
    else if (dependency[i] === 2) rows.push(i);
    else {
      uncachedPixels.push(i);
      if (dependency[i] === 1) columns.push(i);
      else pixels.push(i);
    }
  }
  const schedules = {
    uniform: Uint16Array.from(uniform),
    rows: Uint16Array.from(rows),
    columns: Uint16Array.from(columns),
    pixels: Uint16Array.from(pixels),
    uncachedPixels: Uint16Array.from(uncachedPixels),
  };
  return (
    bindings: readonly (readonly number[])[],
    ctx: EffectContext,
    input?: Uint8ClampedArray,
  ) => {
    const values = new Float64Array(count),
      out = new Uint8ClampedArray(ctx.width * ctx.height * 4);
    const run = (indices: Uint16Array, x: number, y: number, pixel: number) => {
      for (let k = 0; k < indices.length; k++) {
        const i = indices[k]!,
          av = values[a[i]!]!,
          bv = values[b[i]!]!,
          cv = values[c[i]!]!;
        let value = 0;
        switch (op[i]) {
          case 0:
            value = constants[i]!;
            break;
          case 1:
            value = bindings[parameter[i]!]![component[i]!]!;
            break;
          case 2:
            value = (x + 0.5) / ctx.width;
            break;
          case 3:
            value = (y + 0.5) / ctx.height;
            break;
          case 4:
            value = ctx.time;
            break;
          case 5:
            value = ctx.frame;
            break;
          case 6:
            value = ctx.logicalWidth ?? ctx.width;
            break;
          case 7:
            value = ctx.logicalHeight ?? ctx.height;
            break;
          case 8:
            value =
              (ctx.logicalWidth ?? ctx.width) /
              (ctx.logicalHeight ?? ctx.height);
            break;
          case 9:
            value = input![pixel + component[i]!]! / 255;
            break;
          case 10:
            value = av + bv;
            break;
          case 11:
            value = av - bv;
            break;
          case 12:
            value = av * bv;
            break;
          case 13:
            value = Math.abs(bv) < 1e-12 ? 0 : av / bv;
            break;
          case 14:
            value = Math.sin(av);
            break;
          case 15:
            value = Math.cos(av);
            break;
          case 16:
            value = Math.abs(av);
            break;
          case 17:
            value = Math.sqrt(Math.max(0, av));
            break;
          case 18:
            value = Math.floor(av);
            break;
          case 19:
            value = Math.min(av, bv);
            break;
          case 20:
            value = Math.max(av, bv);
            break;
          case 21:
            value = Math.max(bv, Math.min(cv, av));
            break;
          case 22:
            value = av + (bv - av) * cv;
            break;
          case 23: {
            const t = Math.max(0, Math.min(1, (cv - av) / (bv - av || 1e-12)));
            value = t * t * (3 - 2 * t);
            break;
          }
          case 24: {
            const n =
              Math.sin(av * 127.1 + bv * 311.7 + cv * 74.7) * 43758.5453;
            value = n - Math.floor(n);
            break;
          }
        }
        values[i] = Number.isFinite(value) ? value : 0;
      }
    };
    run(schedules.uniform, 0, 0, 0);
    const reuseColumns =
        ctx.height > 1 &&
        columns.length > 0 &&
        ctx.width * columns.length <= maxColumnCacheValues,
      columnCache = reuseColumns
        ? new Float64Array(ctx.width * columns.length)
        : undefined;
    if (columnCache)
      for (let x = 0; x < ctx.width; x++) {
        run(schedules.columns, x, 0, 0);
        for (let k = 0; k < columns.length; k++)
          columnCache[x * columns.length + k] = values[columns[k]!]!;
      }
    const schedule = columnCache ? schedules.pixels : schedules.uncachedPixels;
    const [r, g, blue, alpha] = p.program.rgba;
    for (let y = 0; y < ctx.height; y++) {
      run(schedules.rows, 0, y, 0);
      for (let x = 0; x < ctx.width; x++) {
        if (columnCache)
          for (let k = 0; k < columns.length; k++)
            values[columns[k]!] = columnCache[x * columns.length + k]!;
        const pixel = (y * ctx.width + x) * 4;
        run(schedule, x, y, pixel);
        out[pixel] = Math.max(0, Math.min(1, values[r]!)) * 255;
        out[pixel + 1] = Math.max(0, Math.min(1, values[g]!)) * 255;
        out[pixel + 2] = Math.max(0, Math.min(1, values[blue]!)) * 255;
        out[pixel + 3] = Math.max(0, Math.min(1, values[alpha]!)) * 255;
      }
    }
    return out;
  };
}
