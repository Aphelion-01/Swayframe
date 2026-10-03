import { expect, it } from 'vitest';
import { applyColorEffect } from '../src/core/color-effects';
import { createEffect, createMask } from '../src/core/effect-model';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import { saveProject, loadProject } from '../src/core/project-io';
it('曝光与色相真正处理像素，透明通道不变；效果顺序影响结果', () => {
  const exposure = createEffect('exposure'),
    hue = createEffect('hueSaturation');
  const exp = {
    ...exposure,
    parameters: {
      ...exposure.parameters,
      exposure: { ...exposure.parameters.exposure!, baseValue: 1 },
    },
  };
  const shift = {
    ...hue,
    parameters: {
      ...hue.parameters,
      hue: { ...hue.parameters.hue!, baseValue: 120 },
    },
  };
  const a = new Uint8ClampedArray([80, 20, 10, 128]);
  applyColorEffect(a, exp, 0);
  expect([...a]).toEqual([160, 40, 20, 128]);
  const b = new Uint8ClampedArray([255, 0, 0, 255]);
  applyColorEffect(b, shift, 0);
  expect([...b]).toEqual([0, 255, 0, 255]);
  const tint = createEffect('tintFill'),
    before = new Uint8ClampedArray([80, 50, 20, 100]),
    after = new Uint8ClampedArray(before);
  applyColorEffect(before, exp, 0);
  applyColorEffect(before, tint, 0);
  applyColorEffect(after, tint, 0);
  applyColorEffect(after, exp, 0);
  expect([...before]).not.toEqual([...after]);
  expect(after[3]).toBe(100);
});
it('遮罩动画、效果栈和排序保存后恢复；非法参数原子拒绝', () => {
  const p = createDefaultProject(),
    l = createLayer('rectangle'),
    mask = createMask(l, 'path'),
    effects = [createEffect('exposure'), createEffect('gaussianBlur')],
    system = new CommandSystem(p);
  const layer = {
    ...l,
    editor: { ...l.editor!, masks: [mask], graph: undefined, effects },
  };
  expect(
    system.executeTransaction(
      transaction('栈', 'human', [
        command({
          type: 'layer.create',
          compositionId: p.activeCompositionId,
          layer,
        }),
      ]),
    ).ok,
  ).toBe(true);
  const before = system.getSnapshot();
  expect(
    system.executeTransaction(
      transaction('坏值', 'human', [
        command({
          type: 'property.setBase',
          propertyId: effects[1]!.parameters.radius!.id,
          value: -10,
        }),
      ]),
    ).ok,
  ).toBe(false);
  expect(system.getSnapshot()).toBe(before);
  expect(
    system.executeTransaction(
      transaction('重排', 'human', [
        command({
          type: 'layer.replace',
          compositionId: p.activeCompositionId,
          layer: {
            ...layer,
            editor: { ...layer.editor, effects: [...effects].reverse() },
          },
        }),
      ]),
    ).ok,
  ).toBe(true);
  expect(
    loadProject(
      saveProject(system.getSnapshot()),
    ).compositions[0]?.layers[0]?.editor?.graph?.nodes.map((n) => n.type),
  ).toEqual(['source', 'gaussianBlur', 'exposure', 'output']);
  system.undo();
  expect(system.getSnapshot()).toEqual(before);
});
