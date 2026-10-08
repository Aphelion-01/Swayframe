import { sealEffect } from './programmable-effect';
import type { EffectPackageSource } from './programmable-effect';
/** Example package, not a reserved renderer: its entire behavior is ordinary declarative instructions. */
export function organicTextureSource(): EffectPackageSource {
  const instructions: EffectPackageSource['program']['instructions'] = [];
  const emit = (n: (typeof instructions)[number]) => {
    instructions.push(n);
    return instructions.length - 1;
  };
  const op = (op: (typeof instructions)[number]['op'], ...args: number[]) =>
    emit({ op, args });
  const param = (parameter: string, component = 0) =>
    emit({ op: 'parameter', parameter, component });
  const u = emit({ op: 'u' }),
    v = emit({ op: 'v' }),
    time = emit({ op: 'time' }),
    density = param('density'),
    flow = param('flow'),
    seed = param('seed');
  const phase = op('add', op('multiply', time, flow), seed),
    a = op('sin', op('add', op('multiply', u, density), phase)),
    b = op('cos', op('subtract', op('multiply', v, density), phase));
  const half = emit({ op: 'constant', value: 0.5 }),
    one = emit({ op: 'constant', value: 1 }),
    noise = op('multiply', op('add', op('sin', op('add', a, b)), one), half);
  const rgb = [0, 1, 2].map((c) =>
    op('mix', param('colorA', c), param('colorB', c), noise),
  );
  return {
    format: 'swayframe.effect.v1',
    id: 'organicTexture',
    version: '1.0.0',
    name: '流动有机纹理',
    description: '可动画的流动有机纹理，密度、流速、颜色与种子均由标准属性驱动',
    category: 'generator',
    runtime: 'declarative-pixel-v1',
    inputs: [],
    outputs: [{ id: 'out', name: '图像', type: 'Image' }],
    dependencies: [],
    parameters: [
      {
        id: 'density',
        name: '纹理密度',
        type: 'float',
        defaultValue: 12,
        min: 0.1,
        max: 100,
        animatable: true,
      },
      {
        id: 'flow',
        name: '流速',
        type: 'float',
        defaultValue: 1,
        min: -10,
        max: 10,
        animatable: true,
      },
      {
        id: 'colorA',
        name: '颜色 A',
        type: 'color',
        defaultValue: [0.03, 0.08, 0.25, 1],
        animatable: true,
      },
      {
        id: 'colorB',
        name: '颜色 B',
        type: 'color',
        defaultValue: [0.2, 0.6, 1, 1],
        animatable: true,
      },
      {
        id: 'seed',
        name: '种子',
        type: 'integer',
        defaultValue: 7,
        min: 0,
        max: 1000000,
        animatable: true,
      },
    ],
    program: { instructions, rgba: [rgb[0]!, rgb[1]!, rgb[2]!, one] },
  };
}
export const organicTexturePackage = () => sealEffect(organicTextureSource());
