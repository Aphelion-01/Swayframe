import { describe, expect, it } from 'vitest';
import { createRenderSnapshot, hitTest } from '../src/core/renderer-core';
import { createComposition, createLayer } from '../src/core/project-model';
import { newId } from '../src/core/core-types';

describe('Renderer input / hit test', () => {
  it('相同工程和时间生成相同快照；按动画求值', () => {
    const layer = createLayer('rectangle');
    const c = {
      ...createComposition(),
      layers: [
        {
          ...layer,
          transform: {
            ...layer.transform,
            position: {
              ...layer.transform.position,
              keyframes: [
                {
                  id: newId(),
                  time: 0,
                  value: { x: 0, y: 540 },
                  interpolation: { type: 'linear' as const },
                },
                {
                  id: newId(),
                  time: 1,
                  value: { x: 960, y: 540 },
                  interpolation: { type: 'linear' as const },
                },
              ],
            },
          },
        },
      ],
    };
    expect(createRenderSnapshot(c, 0.5, [])).toEqual(
      createRenderSnapshot(c, 0.5, []),
    );
    expect(createRenderSnapshot(c, 0.5, []).layers[0]?.position.x).toBe(480);
  });
  it('选择最上方可见图层，逆变换包含旋转与缩放', () => {
    const first = createLayer('rectangle');
    const top = createLayer('ellipse');
    const c = { ...createComposition(), layers: [first, top] };
    expect(hitTest(createRenderSnapshot(c, 0, []), { x: 960, y: 540 })).toBe(
      top.id,
    );
    const hidden = { ...c, layers: [first, { ...top, visible: false }] };
    expect(
      hitTest(createRenderSnapshot(hidden, 0, []), { x: 960, y: 540 }),
    ).toBe(first.id);
    const rotated = {
      ...first,
      width: 400,
      height: 40,
      transform: {
        ...first.transform,
        rotation: { ...first.transform.rotation, baseValue: 90 },
      },
    };
    const snapshot = createRenderSnapshot({ ...c, layers: [rotated] }, 0, []);
    expect(hitTest(snapshot, { x: 960, y: 700 })).toBe(first.id);
    expect(hitTest(snapshot, { x: 1120, y: 540 })).toBeNull();
  });
  it('零 Scale 安全，拖动 preview 不修改 Composition', () => {
    const layer = createLayer('rectangle');
    const c = { ...createComposition(), layers: [layer] };
    const json = JSON.stringify(c);
    expect(
      createRenderSnapshot(c, 0, [], {
        layerId: layer.id,
        position: { x: 0, y: 0 },
      }).layers[0]?.position.x,
    ).toBe(0);
    expect(JSON.stringify(c)).toBe(json);
    const zero = {
      ...layer,
      transform: {
        ...layer.transform,
        scale: { ...layer.transform.scale, baseValue: { x: 0, y: 0 } },
      },
    };
    expect(
      hitTest(createRenderSnapshot({ ...c, layers: [zero] }, 0, []), {
        x: 960,
        y: 540,
      }),
    ).toBeNull();
  });
});
