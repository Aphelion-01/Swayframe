/** Repeatable development fixtures; never imported by the production entry point. */
import {
  createDefaultProject,
  createComposition,
  createLayer,
} from '../core/project-model';
import type { Layer } from '../core/project-model';
import { newId } from '../core/core-types';
export function transformFixture(kind: string) {
  const p = createDefaultProject(
    createComposition({ name: '轴向与支点验收', width: 1600, height: 900 }),
  );
  const rect = (name: string, x: number, y = 350) =>
    createLayer('rectangle', {
      name,
      position: { x, y },
      width: 200,
      height: 120,
    });
  let layers: Layer[] = [];
  if (kind === 'single') {
    const l = rect('支点矩形', 500);
    layers = [
      {
        ...l,
        editor: {
          ...l.editor!,
          properties: {
            ...l.editor!.properties,
            anchor: {
              ...l.editor!.properties.anchor!,
              baseValue: { x: -100, y: -60 },
            },
          },
        },
      },
    ];
  } else if (kind === 'multi')
    layers = [rect('对象 A', 350), rect('对象 B', 1100)];
  else if (kind === 'axis') {
    const l = rect('旋转矩形', 700);
    layers = [
      {
        ...l,
        transform: {
          ...l.transform,
          rotation: { ...l.transform.rotation, baseValue: 45 },
        },
      },
    ];
  } else if (kind === 'parent') {
    const parent = rect('旋转父层', 500),
      child = rect('子层', 300, 0);
    layers = [
      {
        ...parent,
        transform: {
          ...parent.transform,
          rotation: { ...parent.transform.rotation, baseValue: 30 },
        },
      },
      { ...child, editor: { ...child.editor!, parentId: parent.id } },
    ];
  } else if (kind === 'dense')
    layers = Array.from({ length: 25 }, (_, i) => {
      const l = rect(
        `图层 ${String(i + 1).padStart(2, '0')}`,
        160 + (i % 5) * 300,
        160 + Math.floor(i / 5) * 140,
      );
      return {
        ...l,
        width: 100,
        height: 60,
        transform: {
          ...l.transform,
          position: {
            ...l.transform.position,
            keyframes: [
              {
                id: newId(),
                time: 0,
                value: l.transform.position.baseValue,
                interpolation: { type: 'linear' },
              },
              {
                id: newId(),
                time: 2,
                value: {
                  x: l.transform.position.baseValue.x + 100,
                  y: l.transform.position.baseValue.y,
                },
                interpolation: { type: 'linear' },
              },
            ],
          },
        },
      };
    });
  return {
    ...p,
    name: `Transform QA · ${kind}`,
    compositions: p.compositions.map((c) => ({ ...c, layers })),
  };
}
