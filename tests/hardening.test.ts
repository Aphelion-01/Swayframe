import { describe, expect, it, vi } from 'vitest';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import type { Transaction } from '../src/core/command-system';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { loadProject } from '../src/core/project-io';
import { evaluateProperty } from '../src/core/animation-engine';
import { newId } from '../src/core/core-types';
import { createPersistedStore } from '../src/ui/persistence';

describe('集成边界回归', () => {
  it('无效事务身份、来源和额外命令参数被拒绝', () => {
    const p = createDefaultProject();
    const system = new CommandSystem(p);
    const before = system.getSnapshot();
    const tx = transaction('create', 'human', [
      command({
        type: 'layer.create',
        compositionId: p.activeCompositionId,
        layer: createLayer('rectangle'),
      }),
    ]);
    for (const bad of [
      { ...tx, source: 'untrusted' },
      { ...tx, id: 'invalid' },
      { ...tx, commands: [{ ...tx.commands[0], extra: true }] },
    ])
      expect(system.executeTransaction(bad as unknown as Transaction).ok).toBe(
        false,
      );
    expect(system.getSnapshot()).toBe(before);
  });
  it('视图订阅错误不影响提交结果和其他订阅者', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const next = vi.fn();
    const p = createDefaultProject();
    const system = new CommandSystem(p);
    system.subscribe(() => {
      throw new Error('view');
    });
    system.subscribe(next);
    expect(
      system.executeTransaction(
        transaction('create', 'human', [
          command({
            type: 'layer.create',
            compositionId: p.activeCompositionId,
            layer: createLayer('rectangle'),
          }),
        ]),
      ).ok,
    ).toBe(true);
    expect(next).toHaveBeenCalled();
    expect(system.undoStack).toHaveLength(1);
    spy.mockRestore();
  });
  it('极大有限标量的线性中点不溢出', () => {
    expect(
      evaluateProperty(
        {
          id: newId(),
          baseValue: 0,
          keyframes: [
            {
              id: newId(),
              time: 0,
              value: -1e308,
              interpolation: { type: 'linear' },
            },
            {
              id: newId(),
              time: 1,
              value: 1e308,
              interpolation: { type: 'linear' },
            },
          ],
        },
        0.5,
      ),
    ).toBe(0);
  });
  it('缓存失败保留可读错误，工程仍可导出', async () => {
    const store = createPersistedStore({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    });
    const p = store.commands.getSnapshot();
    store.run('create', [
      command({
        type: 'layer.create',
        compositionId: p.activeCompositionId,
        layer: createLayer('rectangle'),
      }),
    ]);
    await Promise.resolve();
    expect(store.getSnapshot().error).toBe(true);
    expect(store.getSnapshot().status).toContain('缓存空间');
    expect(loadProject(store.save()).compositions[0]?.layers).toHaveLength(1);
  });
});
