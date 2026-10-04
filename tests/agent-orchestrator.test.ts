import { expect, it, vi } from 'vitest';
import { AgentOrchestrator } from '../src/agent/orchestrator';
import { defaultAISettings } from '../src/ai/contracts';
import { createDefaultProject } from '../src/core/project-model';
import type {
  AgentPlan,
  AgentRuntimePort,
  AgentModelPort,
  AgentTransactionPort,
} from '../src/agent/session';
const plan: AgentPlan = {
  id: 'plan-1',
  goal: '测试修改',
  risk: 'low',
  steps: [
    { id: '1', label: '移动', tool: 'setPosition', arguments: { x: 1 } },
    { id: '2', label: '缩放', tool: 'setScale', arguments: { x: 2 } },
  ],
};
function setup(custom: Partial<AgentRuntimePort> = {}) {
  const project = createDefaultProject();
  const commit = vi.fn(() => ({
    added: [],
    modified: ['position'],
    deleted: [],
    transactionId: 'tx',
  }));
  const discard = vi.fn();
  const execute = vi.fn<AgentTransactionPort['execute']>(async () => ({
    ok: true,
  }));
  const begin = vi.fn(() => ({
    execute,
    commit,
    discard,
    getSnapshot: () => project,
  }));
  const runtime: AgentRuntimePort = {
    project: () => project,
    context: () => ({ selection: ['selected'] }),
    tools: () => [],
    permission: () => 'WRITE',
    validate: () => {},
    begin,
    ...custom,
  };
  const model = {
    chat: vi.fn<AgentModelPort['chat']>(async () => ({
      text: '',
      model: 'mock',
      toolCalls: [{ id: 'call', name: 'submitPlan', arguments: plan }],
    })),
  };
  const settings = defaultAISettings();
  const agent = new AgentOrchestrator(runtime, model, () => settings);
  return { agent, settings, runtime, model, commit, discard, execute, begin };
}
it('executes a structured plan, verifies before one commit and preserves refinement context', async () => {
  const verify = vi.fn(async () => ({ ok: true, message: 'pass' }));
  const s = setup({ verify });
  await s.agent.run('移动并缩放');
  expect(s.execute).toHaveBeenCalledTimes(2);
  expect(verify).toHaveBeenCalledOnce();
  expect(s.commit).toHaveBeenCalledOnce();
  expect(s.agent.getSnapshot()).toMatchObject({
    status: 'completed',
    pendingConfirmation: false,
    selectedContext: { selection: ['selected'] },
  });
  await s.agent.run('再快一点');
  const request = s.model.chat.mock.calls.at(-1)![1];
  expect(
    request.messages
      .filter((m) => m.role === 'user')
      .some((m) => m.content === '移动并缩放'),
  ).toBe(true);
});
it('ASSIST stays read-only; destructive and large plans require explicit runtime confirmation', async () => {
  const s = setup();
  s.settings.agent.mode = 'ASSIST';
  await s.agent.run('test');
  expect(s.begin).not.toHaveBeenCalled();
  expect(s.agent.getSnapshot().status).toBe('completed');
  const danger = setup({ permission: () => 'DESTRUCTIVE' });
  await danger.agent.run('delete');
  expect(danger.agent.getSnapshot().pendingConfirmation).toBe(true);
  expect(danger.begin).not.toHaveBeenCalled();
  await danger.agent.apply('plan-1');
  expect(danger.commit).toHaveBeenCalledOnce();
});
it('Stop aborts in-flight tool work, discards uncommitted draft and prevents following tools', async () => {
  const s = setup();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  s.execute.mockImplementationOnce(async (_tool, _args, signal) => {
    started();
    await new Promise<void>((resolve, reject) => {
      signal.addEventListener('abort', () => reject(Error('abort')), {
        once: true,
      });
      setTimeout(resolve, 1000);
    });
    return { ok: true };
  });
  const work = s.agent.run('test');
  await ready;
  s.agent.stop();
  await work;
  expect(s.execute).toHaveBeenCalledTimes(1);
  expect(s.commit).not.toHaveBeenCalled();
  expect(s.discard).toHaveBeenCalled();
  expect(s.agent.getSnapshot().status).toBe('cancelled');
});
it('invalid plans, tool failures, verification exhaustion and concurrent edits leave real project unchanged', async () => {
  const malformed = setup();
  malformed.model.chat.mockResolvedValueOnce({
    text: '',
    model: 'mock',
    toolCalls: [
      { id: 'call', name: 'submitPlan', arguments: { ...plan, steps: [] } },
    ],
  });
  await malformed.agent.run('test');
  expect(malformed.begin).not.toHaveBeenCalled();
  expect(malformed.agent.getSnapshot().status).toBe('failed');
  const failed = setup();
  failed.execute.mockRejectedValueOnce(Error('tool fail'));
  await failed.agent.run('test');
  expect(failed.commit).not.toHaveBeenCalled();
  expect(failed.discard).toHaveBeenCalled();
  const verify = vi.fn(async () => ({
    ok: false,
    message: 'still outside',
    refinement: plan,
  }));
  const refinement = setup({ verify });
  await refinement.agent.run('test');
  expect(verify).toHaveBeenCalledTimes(3);
  expect(refinement.commit).not.toHaveBeenCalled();
  let current = createDefaultProject();
  const conflict = setup({
    project: () => current,
    verify: async () => {
      current = createDefaultProject();
      return { ok: true, message: 'pass' };
    },
  });
  await conflict.agent.run('test');
  expect(conflict.commit).not.toHaveBeenCalled();
  expect(conflict.agent.getSnapshot().error).toContain('工程已被修改');
});
