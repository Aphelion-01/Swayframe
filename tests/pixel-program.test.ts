import { expect, it } from 'vitest';
import {
  compileEffect,
  sealEffect,
  instructionSchema,
} from '../src/core/programmable-effect';
import type { EffectPackageSource } from '../src/core/programmable-effect';
import { organicTextureSource } from '../src/core/effect-examples';
import { referencePixels } from './helpers/reference-pixel-runtime';

const arities: Record<string, number> = {
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
type Instruction = EffectPackageSource['program']['instructions'][number];
function compare(source: EffectPackageSource, width = 17, height = 11) {
  const pkg = sealEffect(source),
    ctx = { width, height, time: 0.753, frame: 23 },
    input = Uint8ClampedArray.from(
      { length: width * height * 4 },
      (_, i) => (i * 71) % 256,
    ),
    params = {
      density: 23.75,
      flow: -0.7,
      seed: 13,
      colorA: [0.2, 0.7, 0.3, 0.6],
    };
  const actual = compileEffect(pkg).render(
      params,
      ctx,
      source.category === 'filter' ? input : undefined,
    ),
    expected = referencePixels(pkg, params, ctx, input);
  expect(Buffer.from(actual).equals(Buffer.from(expected))).toBe(true);
}
it.each(instructionSchema.shape.op.options)(
  'keeps exact scalar semantics for %s across dependency schedules',
  (op) => {
    const source = organicTextureSource();
    source.category = 'filter';
    source.inputs = [{ id: 'in', name: '图像', type: 'Image', required: true }];
    const instructions: Instruction[] = [
      { op: 'u' },
      { op: 'v' },
      { op: 'time' },
      { op: 'constant', value: 0.5 },
      { op: 'constant', value: -0.4 },
      { op: 'input', component: 1 },
      { op: 'parameter', parameter: 'colorA', component: 2 },
    ];
    instructions.push({
      op,
      args: (arities[op] ?? 0) ? [0, 1, 2].slice(0, arities[op]) : undefined,
      value: op === 'constant' ? 0.37 : undefined,
      parameter: op === 'parameter' ? 'colorA' : undefined,
      component: op === 'parameter' ? 1 : op === 'input' ? 2 : undefined,
    });
    // Map even large leaf values into RGBA range instead of hiding errors by saturation.
    instructions.push(
      { op: 'sin', args: [7] },
      { op: 'multiply', args: [8, 3] },
      { op: 'add', args: [9, 3] },
    );
    source.program = { instructions, rgba: [10, 5, 6, 3] };
    compare(source);
    compare(source, 1, 19);
    compare(source, 19, 1);
  },
);
it('matches the frozen scalar interpreter for seeded mixed programs, non-finite intermediates and unused code', () => {
  let seed = 7;
  const next = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % max;
  };
  const ops = Object.keys(arities) as Instruction['op'][];
  for (let trial = 0; trial < 80; trial++) {
    const source = organicTextureSource(),
      instructions: Instruction[] = [
        { op: 'u' },
        { op: 'v' },
        { op: 'time' },
        { op: 'frame' },
        { op: 'constant', value: 0 },
        { op: 'constant', value: 1e308 },
        { op: 'constant', value: -0.7 },
        { op: 'parameter', parameter: 'density' },
        { op: 'parameter', parameter: 'flow' },
      ];
    for (let i = instructions.length; i < 60; i++) {
      const op = ops[next(ops.length)]!;
      instructions.push({
        op,
        args: Array.from({ length: arities[op]! }, () => next(i)),
      });
    }
    source.program = { instructions, rgba: [56, 57, 58, 59] };
    compare(source);
  }
});
it('keeps pixels exact when column reuse exceeds its bounded allocation budget', () => {
  const source = organicTextureSource(),
    instructions: Instruction[] = [
      { op: 'u' },
      { op: 'constant', value: 0.0001 },
    ];
  for (let i = 2; i < 70; i++)
    instructions.push({ op: 'add', args: [i - 1 === 1 ? 0 : i - 1, 1] });
  source.program = { instructions, rgba: [69, 68, 67, 1] };
  compare(source, 16385, 2);
});
it('rebinds uniforms and rows on every render without leaking previous frame values', () => {
  const p = sealEffect(organicTextureSource()),
    c = compileEffect(p);
  for (const [width, height] of [
    [31, 17],
    [1, 41],
    [37, 1],
    [7, 13],
  ]) {
    const ctx = {
        width: width!,
        height: height!,
        time: width! / 10,
        frame: height!,
      },
      params = { density: height!, flow: -1 };
    expect(
      Buffer.from(c.render(params, ctx)).equals(
        Buffer.from(referencePixels(p, params, ctx)),
      ),
    ).toBe(true);
  }
});
