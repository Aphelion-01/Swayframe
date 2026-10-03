import { expect, it } from 'vitest';
import { createLayer, createDefaultProject } from '../src/core/project-model';
import { CommandSystem } from '../src/core/command-system';
import { CompositingGraphService } from '../src/core/compositing-service';
import { AgentBridge } from '../src/core/agent-contracts';
import { newId } from '../src/core/core-types';
function setup() {
  const p = createDefaultProject(),
    l = createLayer('solid'),
    s = new CommandSystem({
      ...p,
      compositions: p.compositions.map((c) => ({ ...c, layers: [l] })),
    }),
    api = new CompositingGraphService(s);
  return { s, l, api };
}
it('Agent 服务批量建图、参数与坐标提交一条历史，非法最后一步整体拒绝', () => {
  const { s, l, api } = setup(),
    before = s.getSnapshot();
  expect(
    api.batch('建节点', (session) => {
      const a = session.createNode(l.id, 'exposure');
      session.setNodeParameter(a.id, 'exposure', 1);
      session.setNodePosition(a.id, { x: 500, y: 20 });
      session.enableNode(a.id, false);
    }).ok,
  ).toBe(true);
  expect(s.undoStack).toHaveLength(1);
  expect(s.undoStack[0]?.transaction.source).toBe('agent');
  s.undo();
  expect(s.getSnapshot()).toEqual(before);
  expect(
    api.batch('错误操作', (session) => {
      const a = session.createNode(l.id, 'gaussianBlur');
      session.setNodeParameter(a.id, 'radius', -1);
    }).ok,
  ).toBe(false);
  expect(s.getSnapshot()).toEqual(before);
  expect(api.compileGraph(l.id).valid).toBe(true);
  expect(s.undoStack).toHaveLength(0);
});
it('AgentBridge 的结构化工具与原有 batch 共用命令，并可解析先创建的节点编号', () => {
  const { s, l } = setup(),
    id = newId(),
    bridge = new AgentBridge({
      getProjectSnapshot: s.getSnapshot,
      executeTransaction: (tx) => s.executeTransaction(tx),
      getCurrentTime: () => 0,
      getSelection: () => [l.id],
      undoLastTransaction: () => s.undo(),
    });
  expect(
    bridge.executeBatch('图操作', [
      { name: 'createNode', layerId: l.id, type: 'gaussianBlur', nodeId: id },
      { name: 'setNodeParameter', nodeId: id, key: 'radius', value: 30 },
      { name: 'setNodePosition', nodeId: id, position: { x: 400, y: 200 } },
    ]).ok,
  ).toBe(true);
  expect(s.undoStack).toHaveLength(1);
  expect(bridge.executeTool({ name: 'inspectGraph', layerId: l.id }).ok).toBe(
    true,
  );
  expect(bridge.executeTool({ name: 'compileGraph', layerId: l.id }).ok).toBe(
    true,
  );
  expect(
    bridge.executeTool({
      name: 'deleteNode',
      nodeId: l.editor!.graph!.outputNodeId,
    }).ok,
  ).toBe(false);
});
