import { expect, it } from 'vitest';
import {
  transform4,
  point4,
  projectPoint,
  planeMesh,
  cameraView,
} from '../src/core/perspective';
import {
  createDefaultProject,
  createLayer,
  createComposition,
  createProperty,
} from '../src/core/project-model';
import { createRenderSnapshot, hitTest } from '../src/core/renderer-core';
import { newId } from '../src/core/core-types';
it('真实平面透视使近处放大、Y 旋转产生不同边深度，网格保持透视顶点', () => {
  const camera = {
    position: [0, 0, -1000] as const,
    rotation: [0, 0, 0] as const,
    zoom: 1000,
    width: 1920,
    height: 1080,
  };
  expect(projectPoint([100, 0, 0], camera)?.x).toBe(1060);
  expect(projectPoint([100, 0, -500], camera)?.x).toBe(1160);
  const world = transform4([0, 0, 0], [0, 60, 0]),
    left = point4(world, [-100, 0, 0]),
    right = point4(world, [100, 0, 0]);
  expect(left[2]).not.toBeCloseTo(right[2]);
  expect(planeMesh(world, camera, 200, 200)).toHaveLength(288);
  expect(projectPoint([0, 0, -1000], camera)).toBeNull();
  expect(point4(cameraView(camera), [0, 0, 0])).toEqual([0, 0, 1000]);
});
it('三张不同 Z 的平面按深度排列，摄像机动画与命中测试共享投影', () => {
  const layers = [-200, 0, 200].map((z) => {
    const l = createLayer('rectangle');
    return {
      ...l,
      editor: {
        ...l.editor!,
        is3D: true,
        properties: {
          ...l.editor!.properties,
          position3D: {
            ...l.editor!.properties.position3D!,
            baseValue: [0, 0, z],
          },
        },
      },
    };
  });
  const cam = createLayer('camera'),
    cp = {
      ...createProperty<readonly number[]>([0, 0, -1000]),
      keyframes: [
        {
          id: newId(),
          time: 0,
          value: [0, 0, -1000],
          interpolation: { type: 'linear' as const },
        },
        {
          id: newId(),
          time: 1,
          value: [0, 0, -500],
          interpolation: { type: 'linear' as const },
        },
      ],
    },
    camera = {
      ...cam,
      editor: {
        ...cam.editor!,
        properties: { ...cam.editor!.properties, cameraPosition: cp },
      },
    };
  const c = { ...createComposition(), layers: [...layers, camera] },
    p = createDefaultProject(c),
    a = createRenderSnapshot(c, 0, [], undefined, p),
    b = createRenderSnapshot(c, 1, [], undefined, p);
  expect(a.layers.filter((l) => l.quad).map((l) => l.source.id)).toEqual(
    [...layers].reverse().map((l) => l.id),
  );
  const width = (input: typeof a) => {
    const quad = input.layers.find((l) => l.source.id === layers[0]!.id)!.quad!;
    return quad[1]!.x - quad[0]!.x;
  };
  expect(width(b)).toBeGreaterThan(width(a));
  expect(hitTest(a, { x: 960, y: 540 })).toBe(layers[0]!.id);
});
