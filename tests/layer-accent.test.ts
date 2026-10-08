import { expect, it } from 'vitest';
import {
  createComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
import { loadProject, saveProject } from '../src/core/project-io';
import { layerAccent, layerAccentIds } from '../src/core/layer-accent';
import { sameVisualProject } from '../src/core/render-invalidation';
import { compositingSourceKey } from '../src/renderers/compositing-source-key';
it('新图层循环分配六种身份；旧0.5迁移不改变Transform/实体id', () => {
  const layers = Array.from({ length: 7 }, () => createLayer('rectangle'));
  expect(new Set(layers.slice(0, 6).map(layerAccent)).size).toBe(6);
  expect(layerAccent(layers[0]!)).toBe(layerAccent(layers[6]!));
  const p = createDefaultProject(),
    raw = {
      ...p,
      schemaVersion: '0.5.0',
      compositions: [
        {
          ...p.compositions[0]!,
          layers: layers.map((l) => ({ ...l, ui: undefined })),
        },
      ],
    };
  const loaded = loadProject(JSON.stringify(raw));
  expect(loaded.schemaVersion).toBe('0.7.0');
  expect(loaded.compositions[0]!.layers.map((l) => l.transform)).toEqual(
    layers.map((l) => l.transform),
  );
  expect(loaded.compositions[0]!.layers.map((l) => l.id)).toEqual(
    layers.map((l) => l.id),
  );
  expect(loaded.compositions[0]!.layers.map(layerAccent)).toEqual([
    'accent-1',
    'accent-2',
    'accent-3',
    'accent-4',
    'accent-5',
    'accent-6',
    'accent-1',
  ]);
});
it('None及所有色标严格保存/重开，非法颜色与未知metadata拒绝', () => {
  const p = createDefaultProject(),
    l = createLayer('rectangle');
  for (const id of layerAccentIds) {
    const project = {
      ...p,
      compositions: [
        {
          ...p.compositions[0]!,
          layers: [{ ...l, ui: { accentColorId: id } }],
        },
      ],
    };
    expect(
      layerAccent(
        loadProject(saveProject(project)).compositions[0]!.layers[0]!,
      ),
    ).toBe(id);
  }
  const invalid = {
    ...p,
    compositions: [
      {
        ...p.compositions[0]!,
        layers: [{ ...l, ui: { accentColorId: '#ff0000' } }],
      },
    ],
  };
  expect(() => loadProject(JSON.stringify(invalid))).toThrow(/无效/);
  expect(saveProject(p)).not.toContain('pivotMode');
});
it('色标与嵌套Precomp像素缓存隔离；未知ui字段或真实属性变化仍失效', () => {
  const child = createLayer('rectangle'),
    nested = { ...createComposition(), layers: [child] },
    pre = createLayer('precomp', { compositionId: nested.id }),
    root = { ...createComposition(), layers: [pre] },
    p = { ...createDefaultProject(root), compositions: [root, nested] };
  const after = {
    ...p,
    compositions: [
      root,
      {
        ...nested,
        layers: [{ ...child, ui: { accentColorId: 'none' as const } }],
      },
    ],
  };
  expect(sameVisualProject(p, after)).toBe(true);
  expect(compositingSourceKey(pre, 0, 1, 0, p)).toBe(
    compositingSourceKey(pre, 0, 1, 0, after),
  );
  const unknown = {
    ...p,
    compositions: [
      root,
      {
        ...nested,
        layers: [{ ...child, ui: { ...child.ui, futurePixelField: 1 } }],
      },
    ],
  };
  expect(sameVisualProject(p, unknown)).toBe(false);
  expect(compositingSourceKey(pre, 0, 1, 0, p)).not.toBe(
    compositingSourceKey(pre, 0, 1, 0, unknown),
  );
});
