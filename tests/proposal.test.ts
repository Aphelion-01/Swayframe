import { describe, expect, it } from 'vitest';
import {
  MockLayoutAdvisor,
  MockColorAdvisor,
  MockMotionAdvisor,
} from '../src/core/intelligence-contracts';
import { proposalToTransaction } from '../src/core/proposal-commands';
import { AgentBridge, DEMO_PROMPT } from '../src/core/agent-contracts';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { newId } from '../src/core/core-types';

describe('Intelligence Proposal pipeline', () => {
  it('三个 Mock Provider 只输出可预测建议，不修改冻结的 Scene', async () => {
    const p = createDefaultProject();
    const system = new CommandSystem(p);
    const layer = createLayer('rectangle', { position: { x: 100, y: 100 } });
    system.executeTransaction(
      transaction('create', 'human', [
        command({
          type: 'layer.create',
          compositionId: p.activeCompositionId,
          layer,
        }),
      ]),
    );
    const before = system.getSnapshot();
    const input = {
      composition: before.compositions[0]!,
      selection: [layer.id],
      time: 0,
    };
    for (const advisor of [
      new MockLayoutAdvisor(),
      new MockColorAdvisor(),
      new MockMotionAdvisor(),
    ]) {
      const beforeSuggest = system.getSnapshot();
      const first = await advisor.suggest(input);
      expect(first).toHaveLength(1);
      expect(await advisor.suggest(input)).toEqual(first);
      expect(system.getSnapshot()).toBe(beforeSuggest);
      const tx = proposalToTransaction(first[0], before);
      expect(system.executeTransaction(tx).ok).toBe(true);
      system.undo();
      expect(system.getSnapshot()).toEqual(before);
    }
  });
  it('校验失败不会部分修改；未知 operation、越界值与未知 Layer 被拒绝', () => {
    const system = new CommandSystem(createDefaultProject());
    const before = system.getSnapshot();
    for (const operation of [
      { type: 'eval', code: 'x' },
      {
        type: 'property.set',
        layerId: newId(),
        property: 'position',
        value: { x: 0, y: 0 },
        time: 0,
      },
    ])
      expect(() =>
        proposalToTransaction(
          {
            id: newId(),
            kind: 'layout',
            label: 'bad',
            operations: [operation],
          },
          before,
        ),
      ).toThrow();
    expect(system.getSnapshot()).toBe(before);
  });
  it('Proposal 修改已动画属性时在指定时间更新关键帧；一次 Undo 恢复', async () => {
    const system = new CommandSystem(createDefaultProject());
    const bridge = new AgentBridge({
      getProjectSnapshot: system.getSnapshot,
      executeTransaction: (tx) => system.executeTransaction(tx),
      getCurrentTime: () => 0.5,
      getSelection: () => [],
      undoLastTransaction: () => system.undo(),
    });
    bridge.runDemo(DEMO_PROMPT);
    const before = system.getSnapshot();
    const layer = before.compositions[0]!.layers[0]!;
    const proposals = await new MockLayoutAdvisor().suggest({
      composition: before.compositions[0]!,
      selection: [layer.id],
      time: 0.5,
    });
    const tx = proposalToTransaction(proposals[0], before);
    expect(system.executeTransaction(tx).ok).toBe(true);
    expect(
      system.getSnapshot().compositions[0]?.layers[0]?.transform.position
        .keyframes,
    ).toHaveLength(3);
    system.undo();
    expect(system.getSnapshot()).toEqual(before);
  });
  it('空选择且空场景不返回候选，锁定图层不自动修改', async () => {
    const p = createDefaultProject();
    expect(
      await new MockLayoutAdvisor().suggest({
        composition: p.compositions[0]!,
        selection: [],
        time: 0,
      }),
    ).toEqual([]);
    const layer = { ...createLayer('rectangle'), locked: true };
    const c = { ...p.compositions[0]!, layers: [layer] };
    expect(
      await new MockLayoutAdvisor().suggest({
        composition: c,
        selection: [layer.id],
        time: 0,
      }),
    ).toEqual([]);
  });
});
