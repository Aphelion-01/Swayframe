import { describe, expect, it } from 'vitest';
import { AgentBridge, DEMO_PROMPT } from '../src/core/agent-contracts';
import { CommandSystem } from '../src/core/command-system';
import { createDefaultProject } from '../src/core/project-model';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { newId } from '../src/core/core-types';

function setup() {
  const project = createDefaultProject();
  const system = new CommandSystem(project);
  const bridge = new AgentBridge({
    getProjectSnapshot: system.getSnapshot,
    executeTransaction: (tx) => system.executeTransaction(tx),
    getCurrentTime: () => 0.5,
    getSelection: () => [],
    undoLastTransaction: () => system.undo(),
  });
  return { project, system, bridge };
}
describe('Agent Tool Bridge', () => {
  it('蓝色方块 Demo 创建可编辑动画，只有一个 agent Transaction', () => {
    const { system, bridge, project } = setup();
    const result = bridge.runDemo(DEMO_PROMPT);
    expect(result.ok).toBe(true);
    const edited = system.getSnapshot();
    const c = edited.compositions[0]!;
    const layer = c.layers[0]!;
    expect(layer.type).toBe('shape');
    expect(layer.transform.position.keyframes).toHaveLength(2);
    expect(layer.transform.opacity.keyframes).toHaveLength(2);
    expect(layer.transform.position.keyframes[0]?.interpolation.type).toBe(
      'spring',
    );
    expect(createRenderSnapshot(c, 0, []).layers[0]?.position.x).toBe(-120);
    expect(createRenderSnapshot(c, 1, []).layers[0]?.position.x).toBe(960);
    expect(createRenderSnapshot(c, 0.5, []).layers[0]?.opacity).toBe(0.5);
    expect(
      Math.max(
        ...Array.from(
          { length: 100 },
          (_, i) => createRenderSnapshot(c, i / 100, []).layers[0]!.position.x,
        ),
      ),
    ).toBeGreaterThan(960);
    expect(system.undoStack).toHaveLength(1);
    expect(system.undoStack[0]?.transaction.source).toBe('agent');
    system.undo();
    expect(system.getSnapshot()).toEqual(project);
    system.redo();
    expect(system.getSnapshot()).toEqual(edited);
  });
  it('工具读取/preview 不改变工程，结果使用相同 Renderer 输入', () => {
    const { system, bridge } = setup();
    const before = system.getSnapshot();
    expect(bridge.executeTool({ name: 'inspect_scene' }).ok).toBe(true);
    expect(bridge.executeTool({ name: 'preview_frame', time: 0.5 }).ok).toBe(
      true,
    );
    expect(system.getSnapshot()).toBe(before);
    expect(system.undoStack).toHaveLength(0);
  });
  it('结构化工具 batch 可解析前面创建的图层，失败时无残留', () => {
    const { system, bridge, project } = setup();
    const layerId = newId();
    const calls = [
      { name: 'create_layer', kind: 'rectangle', layerId },
      { name: 'set_property', layerId, property: 'rotation', value: 30 },
    ];
    expect(bridge.executeBatch('create + rotate', calls).ok).toBe(true);
    expect(
      system.getSnapshot().compositions[0]?.layers[0]?.transform.rotation
        .baseValue,
    ).toBe(30);
    system.undo();
    expect(system.getSnapshot()).toEqual(project);
    expect(
      bridge.executeBatch('bad', [
        ...calls,
        { name: 'set_property', layerId, property: 'opacity', value: 4 },
      ]).ok,
    ).toBe(false);
    expect(system.getSnapshot()).toEqual(project);
  });
  it('未知工具、额外参数、未知图层与错误提示拒绝执行', () => {
    const { system, bridge, project } = setup();
    for (const call of [
      { name: 'eval', code: 'anything' },
      { name: 'inspect_scene', extra: true },
      {
        name: 'set_property',
        layerId: newId(),
        property: 'position',
        value: 5,
      },
    ])
      expect(bridge.executeTool(call).ok).toBe(false);
    expect(bridge.runDemo('create video').ok).toBe(false);
    expect(system.getSnapshot()).toEqual(project);
  });
  it('set_interpolation 与 undo 工具也走共享历史', () => {
    const { bridge, system, project } = setup();
    const layerId = newId();
    const keyframeId = newId();
    const result = bridge.executeBatch('keys', [
      { name: 'create_layer', kind: 'rectangle', layerId },
      {
        name: 'add_keyframe',
        layerId,
        property: 'rotation',
        keyframeId,
        time: 0,
        value: 0,
      },
      {
        name: 'set_interpolation',
        layerId,
        property: 'rotation',
        keyframeId,
        interpolation: {
          type: 'bezier',
          out: { x: 0.42, y: 0 },
          in: { x: 0.58, y: 1 },
        },
      },
    ]);
    expect(result.ok).toBe(true);
    expect(
      system.getSnapshot().compositions[0]?.layers[0]?.transform.rotation
        .keyframes[0]?.interpolation.type,
    ).toBe('bezier');
    expect(bridge.executeTool({ name: 'undo_last_transaction' }).ok).toBe(true);
    expect(system.getSnapshot()).toEqual(project);
  });
});
