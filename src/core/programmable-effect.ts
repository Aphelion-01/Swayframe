import { z } from 'zod';
import type { AnimValue } from './core-types';
import { deepFreeze, isVec2 } from './core-types';
import { contentHash } from './content-hash';
import { parameterError } from './visual-capabilities';
import type {
  VisualCapabilityDefinition,
  ParameterDefinition,
} from './visual-capabilities';
const finite = z.number().finite();
const anim = z.union([
  finite,
  z.object({ x: finite, y: finite }).strict(),
  z.array(finite).max(160),
]);
const parameter = z
  .object({
    id: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),
    name: z.string().min(1).max(80),
    type: z.enum([
      'float',
      'integer',
      'boolean',
      'color',
      'vec2',
      'vec3',
      'enum',
      'gradientStops',
    ]),
    defaultValue: anim,
    min: finite.optional(),
    max: finite.optional(),
    step: finite.optional(),
    unit: z.string().max(20).optional(),
    animatable: z.boolean(),
    options: z.array(z.string().max(80)).max(32).optional(),
    uiHints: z
      .object({
        multiline: z.boolean().optional(),
        description: z.string().max(200).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
const port = z
  .object({
    id: z.enum(['in', 'out']),
    name: z.string().max(80),
    type: z.literal('Image'),
    required: z.boolean().optional(),
  })
  .strict();
export const instructionSchema = z
  .object({
    op: z.enum([
      'constant',
      'parameter',
      'u',
      'v',
      'time',
      'frame',
      'width',
      'height',
      'aspect',
      'input',
      'add',
      'subtract',
      'multiply',
      'divide',
      'sin',
      'cos',
      'abs',
      'sqrt',
      'floor',
      'min',
      'max',
      'clamp',
      'mix',
      'smoothstep',
      'noise',
    ]),
    args: z.array(z.number().int().min(0).max(255)).max(3).optional(),
    value: finite.optional(),
    parameter: z.string().max(64).optional(),
    component: z.number().int().min(0).max(159).optional(),
  })
  .strict();
export const effectPackageSchema = z
  .object({
    format: z.literal('swayframe.effect.v1'),
    id: z.string().regex(/^[A-Za-z][A-Za-z0-9._-]{0,79}$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    name: z.string().min(1).max(100),
    description: z.string().max(1000),
    category: z.enum(['generator', 'filter']),
    parameters: z.array(parameter).max(32),
    inputs: z.array(port).max(1),
    outputs: z.array(port).length(1),
    runtime: z.literal('declarative-pixel-v1'),
    program: z
      .object({
        instructions: z.array(instructionSchema).min(1).max(256),
        rgba: z.tuple([
          z.number().int(),
          z.number().int(),
          z.number().int(),
          z.number().int(),
        ]),
      })
      .strict(),
    dependencies: z.array(z.never()).max(0),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type EffectPackage = z.infer<typeof effectPackageSchema>;
export type EffectPackageSource = Omit<EffectPackage, 'contentHash'>;
export interface EffectContext {
  time: number;
  frame: number;
  width: number;
  height: number;
}
export const runtimeLimits = {
  maxPixels: 4194304,
  maxOperations: 128000000,
  maxInstructions: 256,
  maxPackageBytes: 262144,
} as const;
export function sealEffect(source: EffectPackageSource): EffectPackage {
  return validateEffect({ ...source, contentHash: contentHash(source) });
}
const arity: Readonly<Record<string, number>> = {
  constant: 0,
  parameter: 0,
  u: 0,
  v: 0,
  time: 0,
  frame: 0,
  width: 0,
  height: 0,
  aspect: 0,
  input: 0,
  add: 2,
  subtract: 2,
  multiply: 2,
  divide: 2,
  sin: 1,
  cos: 1,
  abs: 1,
  sqrt: 1,
  floor: 1,
  min: 2,
  max: 2,
  clamp: 3,
  mix: 3,
  smoothstep: 3,
  noise: 3,
};
export function validateEffect(raw: unknown): EffectPackage {
  if (JSON.stringify(raw).length > runtimeLimits.maxPackageBytes)
    throw Error('效果包超出256KB上限');
  const p = effectPackageSchema.parse(raw),
    { contentHash: hash, ...source } = p;
  if (hash !== contentHash(source)) throw Error('效果包内容哈希不匹配');
  if (new Set(p.parameters.map((s) => s.id)).size !== p.parameters.length)
    throw Error('参数标识重复');
  for (const spec of p.parameters) {
    const error = parameterError(
      spec as ParameterDefinition,
      spec.defaultValue,
    );
    if (error) throw Error(error);
  }
  if (
    p.outputs[0]?.id !== 'out' ||
    (p.category === 'generator'
      ? p.inputs.length !== 0
      : p.inputs.length !== 1 || p.inputs[0]?.id !== 'in')
  )
    throw Error('效果端口不兼容');
  p.program.instructions.forEach((n, i) => {
    if ((n.args?.length ?? 0) !== arity[n.op] || n.args?.some((a) => a >= i))
      throw Error(`指令${i}引用或参数数量无效`);
    if (n.op === 'constant' && n.value === undefined) throw Error('常量缺失');
    if (n.op === 'parameter') {
      const spec = p.parameters.find((s) => s.id === n.parameter);
      if (!spec) throw Error('未绑定参数');
      const v = spec.defaultValue;
      const size = typeof v === 'number' ? 1 : Array.isArray(v) ? v.length : 2;
      if ((n.component ?? 0) >= size) throw Error('参数分量越界');
    }
    if (n.op === 'input' && (p.category !== 'filter' || (n.component ?? 0) > 3))
      throw Error('输入图像绑定无效');
  });
  if (p.program.rgba.some((i) => i < 0 || i >= p.program.instructions.length))
    throw Error('输出引用无效');
  if (
    p.program.instructions.some((n) => n.op === 'noise') &&
    !p.parameters.some((s) => s.id === 'seed' && s.type === 'integer')
  )
    throw Error('随机效果必须声明整数seed');
  return deepFreeze(p);
}
export function effectDefinition(p: EffectPackage): VisualCapabilityDefinition {
  return {
    id: p.id,
    version: p.version,
    contentHash: p.contentHash,
    name: p.name,
    description: p.description,
    category: p.category,
    group: p.category === 'generator' ? 'Generate' : 'Stylize',
    parameters: p.parameters,
    inputs: p.inputs,
    outputs: p.outputs,
    implementation: { kind: 'declarative', entryPoint: 'fx.' + p.contentHash },
    capabilities: {
      animatable: true,
      realtime: false,
      deterministic: true,
      usesTime: p.program.instructions.some(
        (n) => n.op === 'time' || n.op === 'frame',
      ),
    },
    keywords: [p.name, p.id, '自定义'],
  };
}
export interface CompiledEffect {
  readonly package: EffectPackage;
  render(
    params: Readonly<Record<string, AnimValue>>,
    context: EffectContext,
    input?: Uint8ClampedArray,
  ): Uint8ClampedArray;
}
const cache = new Map<string, CompiledEffect>();
export function assertEffectContext(
  p: EffectPackage,
  ctx: EffectContext,
): void {
  if (
    !Number.isFinite(ctx.time) ||
    !Number.isFinite(ctx.frame) ||
    !Number.isInteger(ctx.width) ||
    !Number.isInteger(ctx.height) ||
    ctx.width < 1 ||
    ctx.height < 1 ||
    ctx.width * ctx.height > runtimeLimits.maxPixels ||
    ctx.width * ctx.height * p.program.instructions.length >
      runtimeLimits.maxOperations
  )
    throw Error('效果执行超出像素或运算预算，请降低分辨率或简化程序');
}
export function compileEffect(raw: unknown): CompiledEffect {
  const p = validateEffect(raw),
    hit = cache.get(p.contentHash);
  if (hit) return hit;
  const compiled: CompiledEffect = {
    package: p,
    render(params, ctx, input) {
      assertEffectContext(p, ctx);
      if (
        p.category === 'filter' &&
        input?.length !== ctx.width * ctx.height * 4
      )
        throw Error('输入图像尺寸不兼容');
      const bindings = p.parameters.map((spec) => {
        const value = params[spec.id] ?? spec.defaultValue,
          error = parameterError(spec, value);
        if (error) throw Error(error);
        return typeof value === 'number'
          ? [value]
          : Array.isArray(value)
            ? value
            : isVec2(value)
              ? [value.x, value.y]
              : [...value];
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
                const n =
                  Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
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
    },
  };
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(p.contentHash, compiled);
  return compiled;
}
