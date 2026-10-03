import { describe, expect, it } from 'vitest';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { newId } from '../src/core/core-types';

function setup() {
  const project = createDefaultProject();
  const layer = createLayer('rectangle');
  const system = new CommandSystem(project);
  const compositionId = project.activeCompositionId;
  const create = command({ type: 'layer.create', compositionId, layer });
  return { project, layer, system, compositionId, create };
}
describe('Command / Transaction / History', () => {
  it('创建、属性修改、关键帧增改删可精确撤销与重做', () => {
    const s = setup();
    const { system, layer } = s;
    const k = {
      id: newId(),
      time: 0,
      value: { x: 10, y: 20 },
      interpolation: { type: 'linear' as const },
    };
    const states = [system.getSnapshot()];
    for (const c of [
      s.create,
      command({
        type: 'property.setBase',
        propertyId: layer.transform.position.id,
        value: { x: 300, y: 400 },
      }),
      command({
        type: 'keyframe.add',
        propertyId: layer.transform.position.id,
        keyframe: k,
      }),
      command({
        type: 'keyframe.update',
        propertyId: layer.transform.position.id,
        keyframeId: k.id,
        patch: {
          time: 1,
          value: { x: 900, y: 540 },
          interpolation: {
            type: 'spring',
            stiffness: 170,
            damping: 18,
            mass: 1,
          },
        },
      }),
      command({
        type: 'keyframe.delete',
        propertyId: layer.transform.position.id,
        keyframeId: k.id,
      }),
    ]) {
      expect(
        system.executeTransaction(transaction('edit', 'human', [c])).ok,
      ).toBe(true);
      states.push(system.getSnapshot());
    }
    for (let i = states.length - 2; i >= 0; i--) {
      expect(system.undo().ok).toBe(true);
      expect(system.getSnapshot()).toEqual(states[i]);
    }
    for (let i = 1; i < states.length; i++) {
      expect(system.redo().ok).toBe(true);
      expect(system.getSnapshot()).toEqual(states[i]);
    }
  });
  it('失败 Transaction 不部分写入、不增加历史', () => {
    const s = setup();
    const before = s.system.getSnapshot();
    const result = s.system.executeTransaction(
      transaction('bad', 'agent', [
        s.create,
        command({
          type: 'property.setBase',
          propertyId: s.layer.transform.opacity.id,
          value: 2,
        }),
      ]),
    );
    expect(result.ok).toBe(false);
    expect(s.system.getSnapshot()).toBe(before);
    expect(s.system.undoStack).toHaveLength(0);
  });
  it('多命令作为一项撤销；新提交清空 redo；输入不能越权修改', () => {
    const s = setup();
    const tx = transaction('Agent demo', 'agent', [
      s.create,
      command({
        type: 'property.setBase',
        propertyId: s.layer.transform.rotation.id,
        value: 45,
      }),
    ]);
    expect(s.system.executeTransaction(tx).ok).toBe(true);
    expect(s.system.undoStack).toHaveLength(1);
    const edited = s.system.getSnapshot();
    expect(Object.isFrozen(edited.compositions[0]?.layers[0]?.transform)).toBe(
      true,
    );
    s.system.undo();
    expect(s.system.getSnapshot()).toEqual(s.project);
    s.system.redo();
    expect(s.system.getSnapshot()).toEqual(edited);
    s.system.undo();
    s.system.executeTransaction(transaction('new', 'human', [s.create]));
    expect(s.system.redoStack).toHaveLength(0);
  });
  it('删除恢复原顺序，排序和 Layer patch 保持精确历史', () => {
    const s = setup();
    const second = createLayer('text');
    s.system.executeTransaction(
      transaction('create', 'human', [
        s.create,
        command({
          type: 'layer.create',
          compositionId: s.compositionId,
          layer: second,
        }),
      ]),
    );
    const before = s.system.getSnapshot();
    for (const c of [
      command({
        type: 'layer.reorder',
        compositionId: s.compositionId,
        layerId: s.layer.id,
        toIndex: 1,
      }),
      command({
        type: 'layer.patch',
        compositionId: s.compositionId,
        layerId: s.layer.id,
        patch: {
          name: 'Renamed',
          visible: false,
          semantic: { semanticRole: 'logo', importance: 0.8 },
        },
      }),
      command({
        type: 'layer.delete',
        compositionId: s.compositionId,
        layerId: second.id,
      }),
    ])
      s.system.executeTransaction(transaction('edit', 'human', [c]));
    for (let i = 0; i < 3; i++) s.system.undo();
    expect(s.system.getSnapshot()).toEqual(before);
  });
  it('重复 ID / keyframe time、错误值类型与不存在的目标均被拒绝', () => {
    const s = setup();
    s.system.executeTransaction(transaction('create', 'human', [s.create]));
    const bad = [
      s.create,
      command({
        type: 'property.setBase',
        propertyId: s.layer.transform.position.id,
        value: 5,
      }),
      command({
        type: 'layer.delete',
        compositionId: s.compositionId,
        layerId: newId(),
      }),
    ];
    for (const c of bad)
      expect(
        s.system.executeTransaction(transaction('bad', 'human', [c])).ok,
      ).toBe(false);
    const frame = {
      id: newId(),
      time: 0,
      value: 0,
      interpolation: { type: 'linear' as const },
    };
    const propertyId = s.layer.transform.rotation.id;
    s.system.executeTransaction(
      transaction('key', 'human', [
        command({ type: 'keyframe.add', propertyId, keyframe: frame }),
      ]),
    );
    expect(
      s.system.executeTransaction(
        transaction('duplicate', 'human', [
          command({
            type: 'keyframe.add',
            propertyId,
            keyframe: { ...frame, id: newId() },
          }),
        ]),
      ).ok,
    ).toBe(false);
  });
  it('取消临时编辑不入历史；提交拖拽只有一个事务', () => {
    const s = setup();
    const edit = s.system.beginEdit('Drag', 'human');
    edit.cancel();
    expect(s.system.undoStack).toHaveLength(0);
    expect(() => edit.commit([s.create])).toThrow();
    const second = s.system.beginEdit('Drag', 'human');
    expect(second.commit([s.create]).ok).toBe(true);
    expect(s.system.undoStack).toHaveLength(1);
  });
});
