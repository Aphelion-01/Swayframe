import type { AnimValue, Color, ID, Seconds } from './core-types';
import type { Composition, Interpolation, TransformKey } from './project-model';

export type ProposedOperation =
  | {
      readonly type: 'property.set';
      readonly layerId: ID;
      readonly property: TransformKey;
      readonly value: AnimValue;
      readonly time: Seconds;
    }
  | { readonly type: 'layer.fill'; readonly layerId: ID; readonly color: Color }
  | {
      readonly type: 'keyframe.set';
      readonly layerId: ID;
      readonly property: TransformKey;
      readonly time: Seconds;
      readonly value: AnimValue;
      readonly interpolation: Interpolation;
    };
export interface IntelligenceProposal {
  readonly id: ID;
  readonly kind: 'layout' | 'color' | 'motion';
  readonly label: string;
  readonly score?: number;
  readonly operations: readonly ProposedOperation[];
}
export type LayoutProposal = IntelligenceProposal & { readonly kind: 'layout' };
export type ColorProposal = IntelligenceProposal & { readonly kind: 'color' };
export type MotionProposal = IntelligenceProposal & { readonly kind: 'motion' };
export interface DesignContext {
  readonly composition: Composition;
  readonly selection: readonly ID[];
  readonly time: Seconds;
}
export type LayoutContext = DesignContext;
export type ColorContext = DesignContext;
export type MotionContext = DesignContext;
export interface LayoutAdvisor {
  suggest(input: LayoutContext): Promise<readonly LayoutProposal[]>;
}
export interface ColorAdvisor {
  suggest(input: ColorContext): Promise<readonly ColorProposal[]>;
}
export interface MotionAdvisor {
  suggest(input: MotionContext): Promise<readonly MotionProposal[]>;
}
const editable = (input: DesignContext) =>
  input.composition.layers.filter(
    (layer) =>
      !layer.locked &&
      (input.selection.length === 0 || input.selection.includes(layer.id)),
  );

export class MockLayoutAdvisor implements LayoutAdvisor {
  async suggest(input: LayoutContext): Promise<readonly LayoutProposal[]> {
    const layers = editable(input);
    if (layers.length === 0) return [];
    return [
      {
        id: '00000000-0000-4000-8000-000000000001',
        kind: 'layout',
        label: '水平居中分布',
        score: 1,
        operations: layers.map((layer, index) => ({
          type: 'property.set',
          layerId: layer.id,
          property: 'position',
          value: {
            x: (input.composition.width * (index + 1)) / (layers.length + 1),
            y: input.composition.height / 2,
          },
          time: input.time,
        })),
      },
    ];
  }
}
export class MockColorAdvisor implements ColorAdvisor {
  async suggest(input: ColorContext): Promise<readonly ColorProposal[]> {
    const layers = editable(input).filter((layer) => layer.type !== 'image');
    if (layers.length === 0) return [];
    const palette: readonly Color[] = [
      { r: 0.42, g: 0.58, b: 1, a: 1 },
      { r: 1, g: 0.72, b: 0.48, a: 1 },
      { r: 0.45, g: 0.85, b: 0.72, a: 1 },
    ];
    return [
      {
        id: '00000000-0000-4000-8000-000000000002',
        kind: 'color',
        label: '柔和蓝 / 杏 / 青配色',
        score: 1,
        operations: layers.map((layer, i) => ({
          type: 'layer.fill',
          layerId: layer.id,
          color: palette[i % palette.length]!,
        })),
      },
    ];
  }
}
export class MockMotionAdvisor implements MotionAdvisor {
  async suggest(input: MotionContext): Promise<readonly MotionProposal[]> {
    const layers = editable(input);
    if (layers.length === 0) return [];
    return [
      {
        id: '00000000-0000-4000-8000-000000000003',
        kind: 'motion',
        label: '一秒淡入',
        score: 1,
        operations: layers.flatMap((layer): ProposedOperation[] => [
          {
            type: 'keyframe.set',
            layerId: layer.id,
            property: 'opacity',
            time: 0,
            value: 0,
            interpolation: { type: 'linear' },
          },
          {
            type: 'keyframe.set',
            layerId: layer.id,
            property: 'opacity',
            time: Math.min(1, input.composition.duration),
            value: 1,
            interpolation: { type: 'linear' },
          },
        ]),
      },
    ];
  }
}
