import { expect, it } from 'vitest';
import {
  createDefaultProject,
  createLayer,
  createProperty,
} from '../src/core/project-model';
import { createEffect } from '../src/core/effect-model';
import { loadProject, saveProject } from '../src/core/project-io';
import { linearGraphEffects } from '../src/core/compositing-migration';
import { cloneLayer } from '../src/core/editing-commands';
it('0.4 效果迁移保留节点/属性/关键帧 ID 与顺序，工程只保存图，复制重建引用', () => {
  const p = createDefaultProject(),
    l = createLayer('image', {
      assetId: '550e8400-e29b-41d4-a716-446655440000',
    }),
    effects = [createEffect('exposure'), createEffect('gaussianBlur')];
  const radius = createProperty(0);
  effects[1] = {
    ...effects[1]!,
    parameters: {
      radius: {
        ...radius,
        keyframes: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            time: 1,
            value: 30,
            interpolation: { type: 'linear' },
          },
        ],
      },
    },
  };
  const layer = {
    ...l,
    type: 'solid' as const,
    assetId: undefined,
    editor: { ...l.editor!, graph: undefined, effects },
  };
  const { assetId, ...solid } = layer;
  void assetId;
  const raw = {
    ...p,
    schemaVersion: '0.4.0',
    compositions: p.compositions.map((c) => ({ ...c, layers: [solid] })),
  };
  const loaded = loadProject(JSON.stringify(raw)),
    m = loaded.compositions[0]!.layers[0]!;
  expect(m.editor?.effects).toBeUndefined();
  expect(linearGraphEffects(m.editor!.graph!)).toEqual(effects);
  expect(loadProject(saveProject(loaded))).toEqual(loaded);
  const copy = cloneLayer(m);
  expect(copy.editor?.graph?.owner.id).toBe(copy.id);
  expect(copy.editor?.graph?.nodes[1]?.params.exposure?.id).not.toBe(
    effects[0]?.parameters.exposure?.id,
  );
});
it('旧色相效果自动补齐明度，原参数 ID 与像素保持不变', () => {
  const p = createDefaultProject(),
    l = createLayer('solid'),
    hue = createEffect('hueSaturation');
  const { lightness, ...parameters } = hue.parameters;
  void lightness;
  const raw = {
    ...p,
    schemaVersion: '0.4.0',
    compositions: p.compositions.map((c) => ({
      ...c,
      layers: [
        {
          ...l,
          editor: {
            ...l.editor!,
            graph: undefined,
            effects: [{ ...hue, parameters }],
          },
        },
      ],
    })),
  };
  const graph = loadProject(JSON.stringify(raw)).compositions[0]?.layers[0]
    ?.editor?.graph;
  expect(graph?.nodes[1]?.params.lightness?.baseValue).toBe(0);
  expect(graph?.nodes[1]?.params.hue?.id).toBe(hue.parameters.hue?.id);
});
