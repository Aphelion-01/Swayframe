import { validateIntent } from './planner';
const ref = (actionId: string) => ({ kind: 'result', actionId });
const color = (r: number, g: number, b: number) => ({ r, g, b, a: 1 });
export const benchmarks = [
  {
    id: 'B1',
    intent: validateIntent({
      goal: '创建三个矩形 RGB，再将第二个改成 Purple',
      actions: [
        ...['Red', 'Green', 'Blue'].flatMap((name, i) => [
          {
            id: 'shape' + i,
            type: 'createShape',
            shape: 'rectangle',
            name,
            width: 200,
            height: 200,
            position: { x: 650 + i * 310, y: 540 },
          },
          {
            id: 'fill' + i,
            type: 'setFill',
            target: ref('shape' + i),
            color: color(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0),
          },
        ]),
        {
          id: 'purple',
          type: 'setFill',
          target: ref('shape1'),
          dependsOn: ['fill1'],
          color: color(0.5, 0, 0.5),
        },
      ],
    }),
  },
  {
    id: 'B2',
    intent: validateIntent({
      goal: '创建 Cubic 文字并设置字体、字号、位置与颜色',
      actions: [
        {
          id: 'text',
          type: 'createText',
          content: 'Cubic',
          name: 'Title',
          fontFamily: 'serif',
          fontSize: 96,
          color: color(1, 1, 1),
          position: { x: 960, y: 450 },
        },
      ],
    }),
  },
  {
    id: 'B3',
    intent: validateIntent({
      goal: '创建矩形，设置径向渐变中心、半径与色标',
      actions: [
        {
          id: 'shape',
          type: 'createShape',
          shape: 'rectangle',
          width: 600,
          height: 400,
          name: 'Gradient',
        },
        {
          id: 'gradient',
          type: 'setFill',
          target: ref('shape'),
          color: color(0, 0.7, 0.8),
          gradient: 'radial',
          radialParameters: {
            center: { x: 0.4, y: 0.6 },
            radius: 0.7,
            stops: [0, 0, 0.7, 0.8, 1, 1, 0, 0.05, 0.15, 1],
          },
        },
      ],
    }),
  },
  {
    id: 'B4',
    intent: validateIntent({
      goal: '创建图层，添加位置关键帧并更改运动曲线',
      actions: [
        {
          id: 'shape',
          type: 'createShape',
          shape: 'rectangle',
          name: 'Animated',
        },
        {
          id: 'start',
          type: 'addKeyframe',
          target: ref('shape'),
          property: 'position',
          time: 0,
          value: { x: 400, y: 540 },
        },
        {
          id: 'end',
          type: 'addKeyframe',
          target: ref('shape'),
          property: 'position',
          time: 2,
          value: { x: 1500, y: 540 },
        },
        {
          id: 'curve',
          type: 'modifyKeyframe',
          target: ref('shape'),
          property: 'position',
          keyframe: ref('start'),
          dependsOn: ['end'],
          interpolation: {
            type: 'bezier',
            out: { x: 0.25, y: 0 },
            in: { x: 0.75, y: 1 },
          },
        },
      ],
    }),
  },
  {
    id: 'B5',
    intent: validateIntent({
      goal: '创建一个矩形并添加一次 Gaussian Blur，失败后续跑',
      actions: [
        {
          id: 'shape',
          type: 'createShape',
          shape: 'rectangle',
          name: 'Blurred',
        },
        {
          id: 'blur',
          type: 'addEffect',
          target: ref('shape'),
          effect: 'gaussianBlur',
        },
      ],
    }),
  },
];
