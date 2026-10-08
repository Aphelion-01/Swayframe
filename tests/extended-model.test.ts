import { expect, it } from 'vitest';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import {
  createDefaultProject,
  createLayer,
  createLayerEditor,
  createComposition,
  findProperty,
} from '../src/core/project-model';
import { evaluateProperty } from '../src/core/animation-engine';
import { loadProject, saveProject } from '../src/core/project-io';
import { newId } from '../src/core/core-types';

it('扩展颜色、路径和三维属性共用命令、原子历史与序列化', () => {
  const p = createDefaultProject(),
    base = createLayer('rectangle'),
    layer = { ...base, editor: createLayerEditor(base) },
    system = new CommandSystem(p);
  const prop = layer.editor.properties.fill!;
  expect(
    system.executeTransaction(
      transaction('动画', 'human', [
        command({
          type: 'layer.create',
          compositionId: p.activeCompositionId,
          layer,
        }),
        ...[0, 1].map((time) =>
          command({
            type: 'keyframe.add',
            propertyId: prop.id,
            keyframe: {
              id: newId(),
              time,
              value: time ? [1, 0, 0, 1] : [0, 0, 1, 1],
              interpolation: { type: 'linear' },
            },
          }),
        ),
      ]),
    ).ok,
  ).toBe(true);
  expect(
    evaluateProperty(findProperty(system.getSnapshot(), prop.id).property, 0.5),
  ).toEqual([0.5, 0, 0.5, 1]);
  expect(loadProject(saveProject(system.getSnapshot()))).toEqual(
    system.getSnapshot(),
  );
  system.undo();
  expect(system.getSnapshot()).toEqual(p);
  system.redo();
  const before = system.getSnapshot();
  expect(
    system.executeTransaction(
      transaction('坏颜色', 'human', [
        command({
          type: 'property.setBase',
          propertyId: prop.id,
          value: [2, 0, 0, 1],
        }),
      ]),
    ).ok,
  ).toBe(false);
  expect(system.getSnapshot()).toBe(before);
});
it('父级和预合成循环不允许进入历史；合成命令精确恢复', () => {
  const p = createDefaultProject(),
    system = new CommandSystem(p),
    other = createComposition();
  expect(
    system.executeTransaction(
      transaction('合成', 'human', [
        command({ type: 'composition.add', composition: other }),
        command({ type: 'project.activate', compositionId: other.id }),
      ]),
    ).ok,
  ).toBe(true);
  system.undo();
  expect(system.getSnapshot()).toEqual(p);
  const a = createLayer('null'),
    b = createLayer('rectangle');
  const la = { ...a, editor: { ...createLayerEditor(a), parentId: b.id } },
    lb = { ...b, editor: { ...createLayerEditor(b), parentId: a.id } };
  expect(
    system.executeTransaction(
      transaction(
        '循环',
        'human',
        [la, lb].map((layer) =>
          command({
            type: 'layer.create',
            compositionId: p.activeCompositionId,
            layer,
          }),
        ),
      ),
    ).ok,
  ).toBe(false);
  const loop = createLayer('precomp', { compositionId: p.activeCompositionId });
  expect(
    system.executeTransaction(
      transaction('循环合成', 'human', [
        command({
          type: 'layer.create',
          compositionId: p.activeCompositionId,
          layer: loop,
        }),
      ]),
    ).ok,
  ).toBe(false);
});
it('旧版严格验证后迁移，保留实体身份与曲线', () => {
  const p = createDefaultProject(),
    layer = createLayer('rectangle');
  const raw = {
    ...p,
    schemaVersion: '0.1.0',
    compositions: [
      {
        ...p.compositions[0]!,
        layers: [{ ...layer, editor: undefined, ui: undefined }],
      },
    ],
  };
  const loaded = loadProject(JSON.stringify(raw));
  expect(loaded.schemaVersion).toBe('0.7.0');
  expect(loaded.compositions[0]!.layers[0]!.id).toBe(layer.id);
  expect(
    loaded.compositions[0]!.layers[0]!.editor?.properties.fill,
  ).toBeDefined();
  expect(() => loadProject(JSON.stringify({ ...raw, unknown: 1 }))).toThrow();
});
