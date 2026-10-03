import type { EffectKind } from './project-model';
export const effectDefinitions: Readonly<
  Record<
    EffectKind,
    {
      label: string;
      parameters: Readonly<
        Record<
          string,
          { label: string; value: number; min: number; max: number }
        >
      >;
    }
  >
> = {
  brightnessContrast: {
    label: '亮度 / 对比度',
    parameters: {
      brightness: { label: '亮度', value: 0, min: -100, max: 100 },
      contrast: { label: '对比度', value: 0, min: -100, max: 100 },
    },
  },
  exposure: {
    label: '曝光',
    parameters: { exposure: { label: '曝光', value: 0, min: -10, max: 10 } },
  },
  hueSaturation: {
    label: '色相 / 饱和度',
    parameters: {
      hue: { label: '色相', value: 0, min: -180, max: 180 },
      saturation: { label: '饱和度', value: 0, min: -100, max: 100 },
      lightness: { label: '明度', value: 0, min: -100, max: 100 },
    },
  },
  temperature: {
    label: '色温',
    parameters: {
      temperature: { label: '色温', value: 0, min: -100, max: 100 },
    },
  },
  tint: {
    label: '色调',
    parameters: { tint: { label: '色调', value: 0, min: -100, max: 100 } },
  },
  levels: {
    label: '色阶',
    parameters: {
      black: { label: '黑场', value: 0, min: 0, max: 0.99 },
      white: { label: '白场', value: 1, min: 0.01, max: 1 },
      gamma: { label: '伽马', value: 1, min: 0.1, max: 10 },
    },
  },
  gaussianBlur: {
    label: '高斯模糊',
    parameters: { radius: { label: '半径', value: 0, min: 0, max: 200 } },
  },
  dropShadow: {
    label: '投影',
    parameters: {
      radius: { label: '半径', value: 10, min: 0, max: 200 },
      x: { label: '偏移 X', value: 15, min: -500, max: 500 },
      y: { label: '偏移 Y', value: 15, min: -500, max: 500 },
      amount: { label: '强度', value: 0.6, min: 0, max: 1 },
    },
  },
  glow: {
    label: '发光',
    parameters: {
      radius: { label: '半径', value: 20, min: 0, max: 200 },
      amount: { label: '强度', value: 0.8, min: 0, max: 2 },
    },
  },
  tintFill: {
    label: '着色',
    parameters: {
      red: { label: '红色', value: 0.3, min: 0, max: 1 },
      green: { label: '绿色', value: 0.5, min: 0, max: 1 },
      blue: { label: '蓝色', value: 1, min: 0, max: 1 },
      amount: { label: '强度', value: 1, min: 0, max: 1 },
    },
  },
};
