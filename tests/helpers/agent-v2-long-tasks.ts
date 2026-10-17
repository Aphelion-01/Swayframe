import { validateIntent } from '../../src/agent-v2/planner';
import { activeComposition, type Project } from '../../src/core/project-model';
import { evaluateProperty } from '../../src/core/animation-engine';
const ref = (actionId: string) => ({ kind: 'result', actionId });
const color = (r: number, g: number, b: number) => ({ r, g, b, a: 1 });
const shape = (
  id: string,
  name: string,
  x: number,
  y = 540,
  kind = 'rectangle',
) => ({
  id,
  type: 'createShape',
  shape: kind,
  name,
  width: 200,
  height: 200,
  position: { x, y },
});
const fill = (
  id: string,
  target: string,
  c: ReturnType<typeof color>,
  extra: Record<string, unknown> = {},
) => ({ id, type: 'setFill', target: ref(target), color: c, ...extra });
const move = (id: string, target: string, x: number, y = 540) => ({
  id,
  type: 'setProperty',
  target: ref(target),
  property: 'position',
  value: { x, y },
});
const font = (id: string, target: string, size: number) => ({
  id,
  type: 'setProperty',
  target: ref(target),
  property: 'fontSize',
  value: size,
});
const key = (
  id: string,
  target: string,
  time: number,
  value: unknown,
  property = 'position',
) => ({
  id,
  type: 'addKeyframe',
  target: ref(target),
  property,
  time,
  value,
  interpolation: { type: 'linear' },
});
export const longTasks = [
  {
    id: 'L1',
    goal: '新建Red、Green、Blue三个200×200矩形。填充红绿蓝并分别放在(650,540)、(960,540)、(1270,540)。创建Title文字Cubic，serif，初始字号48、白色；创建后改字号96并移到(960,300)。Green位置0秒(960,540)、2秒(1300,540)，线性插值。最后将Red改紫色(0.5,0,0.5)。不改已有对象。',
    intent: validateIntent({
      goal: 'L1 multi-object late fill',
      actions: [
        shape('red', 'Red', 500),
        shape('green', 'Green', 900),
        shape('blue', 'Blue', 1200),
        fill('red_fill', 'red', color(1, 0, 0)),
        fill('green_fill', 'green', color(0, 1, 0)),
        fill('blue_fill', 'blue', color(0, 0, 1)),
        move('red_move', 'red', 650),
        move('green_move', 'green', 960),
        move('blue_move', 'blue', 1270),
        {
          id: 'title',
          type: 'createText',
          name: 'Title',
          content: 'Cubic',
          fontFamily: 'serif',
          fontSize: 48,
          color: color(1, 1, 1),
        },
        font('title_font', 'title', 96),
        move('title_move', 'title', 960, 300),
        key('green0', 'green', 0, { x: 960, y: 540 }),
        key('green2', 'green', 2, { x: 1300, y: 540 }),
        {
          id: 'interpolation',
          type: 'modifyKeyframe',
          target: ref('green'),
          property: 'position',
          keyframe: { kind: 'result', actionId: 'green0' },
          interpolation: { type: 'linear' },
        },
        fill('late_fill', 'red', color(0.5, 0, 0.5)),
      ],
    }),
  },
  {
    id: 'L2',
    goal: '新建GradientA椭圆与GradientB矩形，均200×200，分别放在(650,540)、(1270,540)。两者都设径向渐变，RGBA起点(0,0.7,0.8,1)、终点(0,0.05,0.15,1)，A中心(0.3,0.4)半径0.6，B中心(0.6,0.5)半径0.8。创建Title文字Cubic，serif，初始字号48，改字号80，改颜色为(0,0.7,0.8)，放(960,300)。A透明度0秒1、2秒0.4，线性。最后把B移到(1200,600)。不改已有对象。',
    intent: validateIntent({
      goal: 'L2 gradient references',
      actions: [
        shape('a', 'GradientA', 650, 540, 'ellipse'),
        shape('b', 'GradientB', 1270),
        fill('a_fill', 'a', color(0, 0.7, 0.8), {
          gradient: 'radial',
          endColor: color(0, 0.05, 0.15),
          radialParameters: { center: { x: 0.3, y: 0.4 }, radius: 0.6 },
        }),
        fill('b_fill', 'b', color(0, 0.7, 0.8), {
          gradient: 'radial',
          endColor: color(0, 0.05, 0.15),
          radialParameters: { center: { x: 0.6, y: 0.5 }, radius: 0.8 },
        }),
        move('a_move', 'a', 650),
        move('b_move', 'b', 1270),
        {
          id: 'title',
          type: 'createText',
          name: 'Title',
          content: 'Cubic',
          fontFamily: 'serif',
          fontSize: 48,
          position: { x: 960, y: 300 },
          color: color(1, 1, 1),
        },
        font('title_font', 'title', 80),
        fill('title_color', 'title', color(0, 0.7, 0.8)),
        key('a0', 'a', 0, 1, 'opacity'),
        key('a2', 'a', 2, 0.4, 'opacity'),
        move('late_move', 'b', 1200, 600),
      ],
    }),
  },
  {
    id: 'L3',
    goal: '新建Box矩形200×200放在(750,540)，添加一次gaussianBlur实例，不调Radius。新建Title文字Cubic，serif，初始字号48白色，之后改字号90并保持白色，放(960,400)。Title位置0秒(960,400)、2秒(960,500)，线性。Box设透明度0.8并最终改填充绿色(0,1,0)。再新建Accent椭圆200×200放(1200,540)，填充蓝色(0,0,1)。不改已有对象。',
    intent: validateIntent({
      goal: 'L3 non-idempotent effect',
      actions: [
        shape('box', 'Box', 960),
        {
          id: 'blur',
          type: 'addEffect',
          target: ref('box'),
          effect: 'gaussianBlur',
        },
        {
          id: 'title',
          type: 'createText',
          name: 'Title',
          content: 'Cubic',
          fontFamily: 'serif',
          fontSize: 48,
          position: { x: 960, y: 400 },
          color: color(1, 1, 1),
        },
        font('title_font', 'title', 90),
        fill('title_color', 'title', color(1, 1, 1)),
        key('title0', 'title', 0, { x: 960, y: 400 }),
        key('title2', 'title', 2, { x: 960, y: 500 }),
        move('box_move', 'box', 750),
        {
          id: 'box_opacity',
          type: 'setProperty',
          target: ref('box'),
          property: 'opacity',
          value: 0.8,
        },
        shape('accent', 'Accent', 1200, 540, 'ellipse'),
        fill('accent_fill', 'accent', color(0, 0, 1)),
        fill('late_fill', 'box', color(0, 1, 0)),
      ],
    }),
  },
];
export function verifyLongProject(project: Project, index: number) {
  const layers = activeComposition(project).layers.filter(
    (l) => l.name !== 'Protected',
  );
  const get = (name: string) => {
    const l = layers.find((l) => l.name === name);
    if (!l) throw Error('Missing ' + name);
    return l;
  };
  const equal = (actual: unknown, expected: unknown) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw Error(
        'Independent final postcondition differs: ' +
          JSON.stringify({ actual, expected }),
      );
  };
  equal(layers.length, index === 0 ? 4 : 3);
  const title = get('Title');
  if (title.type !== 'text') throw Error('Title is not text');
  equal(title.text, 'Cubic');
  equal(title.fontFamily, 'serif');
  equal(
    evaluateProperty(title.editor!.properties.fontSize!, 0),
    [96, 80, 90][index],
  );
  if (index === 0) {
    equal(get('Red').editor!.properties.fill!.baseValue, [0.5, 0, 0.5, 1]);
    equal(get('Blue').editor!.properties.fill!.baseValue, [0, 0, 1, 1]);
    equal(get('Green').editor!.properties.fill!.baseValue, [0, 1, 0, 1]);
    equal(get('Red').transform.position.baseValue, { x: 650, y: 540 });
    equal(get('Blue').transform.position.baseValue, { x: 1270, y: 540 });
    equal(evaluateProperty(get('Green').transform.position, 1), {
      x: 1130,
      y: 540,
    });
    equal(get('Green').transform.position.keyframes.length, 2);
    equal(title.transform.position.baseValue, { x: 960, y: 300 });
  }
  if (index === 1) {
    for (const [name, center, radius] of [
      ['GradientA', { x: 0.3, y: 0.4 }, 0.6],
      ['GradientB', { x: 0.6, y: 0.5 }, 0.8],
    ] as const) {
      equal(get(name).editor!.gradient, 'radial');
      equal(
        get(name).editor!.properties.gradientEnd!.baseValue,
        [0, 0.05, 0.15, 1],
      );
      equal(get(name).editor!.properties.radial_center!.baseValue, center);
      equal(get(name).editor!.properties.radial_radius!.baseValue, radius);
    }
    equal(evaluateProperty(get('GradientA').transform.opacity, 1), 0.7);
    equal(get('GradientA').transform.opacity.keyframes.length, 2);
    equal(get('GradientB').transform.position.baseValue, { x: 1200, y: 600 });
    equal(title.editor!.properties.fill!.baseValue, [0, 0.7, 0.8, 1]);
  }
  if (index === 2) {
    equal(
      get('Box').editor!.graph!.nodes.filter((n) => n.type === 'gaussianBlur')
        .length,
      1,
    );
    equal(get('Box').transform.position.baseValue, { x: 750, y: 540 });
    equal(get('Box').transform.opacity.baseValue, 0.8);
    equal(get('Box').editor!.properties.fill!.baseValue, [0, 1, 0, 1]);
    equal(evaluateProperty(title.transform.position, 1), { x: 960, y: 450 });
    equal(title.transform.position.keyframes.length, 2);
    equal(get('Accent').editor!.properties.fill!.baseValue, [0, 0, 1, 1]);
  }
  return true;
}
