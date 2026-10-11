import { expect, it } from 'vitest';
import { AgentOrchestrator } from '../src/agent/orchestrator';
import { AIError, defaultAISettings } from '../src/ai/contracts';
import { createDefaultProject } from '../src/core/project-model';
import type { AgentRuntimePort } from '../src/agent/session';

function runtime() {
  const project = createDefaultProject();
  return {
    project: () => project,
    context: () => ({}),
    creationContext: () => ({}),
    tools: () => [],
    permission: () => 'WRITE',
    validate: () => {},
    reviewDraft: () => {
      throw Error('Planning must not create a draft');
    },
    begin: () => {
      throw Error('Planning must not execute');
    },
  } satisfies AgentRuntimePort;
}
it('requests one fresh complete plan after malformed JSON without executing writes', async () => {
  const r = runtime(),
    before = r.project();
  let calls = 0;
  const agent = new AgentOrchestrator(
    r,
    {
      chat: async (_task, request) => {
        calls++;
        if (calls === 1)
          throw new AIError('invalid_response', '工具参数不是完整 JSON');
        expect(request.messages.at(-1)?.content).toContain(
          'rejected without executing',
        );
        return {
          model: 'fixture',
          text: '',
          toolCalls: [
            {
              id: 'call',
              name: 'submitPlan',
              arguments: {
                id: 'plan',
                goal: 'Modify parameter',
                risk: 'low',
                steps: [
                  {
                    id: 'step',
                    label: 'Radius',
                    tool: 'setNodeParameter',
                    arguments: { nodeId: 'target', key: 'radius', value: 35 },
                  },
                ],
              },
            },
          ],
        };
      },
    },
    defaultAISettings,
  );
  await agent.run('修改参数');
  expect(calls).toBe(2);
  expect(agent.getSnapshot().currentPlan?.id).toBe('plan');
  expect(r.project()).toBe(before);
});
it('stops after a second malformed response and never retries transport failures', async () => {
  for (const error of [
    new AIError('invalid_response', '工具参数不是完整 JSON'),
    new AIError('network', '无法连接模型服务'),
  ]) {
    let calls = 0;
    const agent = new AgentOrchestrator(
      runtime(),
      {
        chat: async () => {
          calls++;
          throw error;
        },
      },
      defaultAISettings,
    );
    await agent.run('修改参数');
    expect(calls).toBe(error.code === 'network' ? 1 : 2);
    expect(agent.getSnapshot().status).toBe('failed');
    expect(agent.getSnapshot().currentPlan).toBeNull();
  }
});

it('ends repeated inspection with a forced plan at the last allowed round', async () => {
  let calls = 0;
  const agent = new AgentOrchestrator(
    {
      ...runtime(),
      readTools: () => [
        { name: 'inspectGraph', description: 'read graph', parameters: {} },
      ],
      inspect: async () => ({ nodes: [] }),
      permission: () => 'READ',
    },
    {
      chat: async (_task, request) => {
        calls++;
        if (calls < 4)
          return {
            model: 'fixture',
            text: '',
            toolCalls: [
              { id: `read-${calls}`, name: 'inspectGraph', arguments: {} },
            ],
          };
        expect(request.toolChoice).toBe('submitPlan');
        expect(request.messages.at(-1)?.content).toContain(
          'inspection budget is exhausted',
        );
        return {
          model: 'fixture',
          text: '',
          toolCalls: [
            {
              id: 'call',
              name: 'submitPlan',
              arguments: {
                id: 'plan',
                goal: 'Scope preserving change',
                risk: 'low',
                steps: [
                  {
                    id: 's',
                    label: 'Radius',
                    tool: 'setNodeParameter',
                    arguments: {},
                  },
                ],
              },
            },
          ],
        };
      },
    },
    defaultAISettings,
  );
  await agent.run('修改参数');
  expect(calls).toBe(4);
  expect(agent.getSnapshot().currentPlan?.id).toBe('plan');
});

it('asks for one corrected invalid plan and retains validation before any execution', async () => {
  let calls = 0,
    validates = 0;
  const agent = new AgentOrchestrator(
    {
      ...runtime(),
      validate: (plan) => {
        validates++;
        if (plan.goal === 'invalid')
          throw Error('创作任务必须恰好覆盖每个计划步骤');
      },
    },
    {
      chat: async (_task, request) => {
        calls++;
        if (calls === 2)
          expect(request.messages.at(-1)?.content).toContain(
            'Every step must belong to exactly one',
          );
        return {
          model: 'fixture',
          text: '',
          toolCalls: [
            {
              id: 'call',
              name: 'submitPlan',
              arguments: {
                id: 'plan',
                goal: calls === 1 ? 'invalid' : 'valid',
                risk: 'low',
                steps: [
                  {
                    id: 's',
                    label: 'Radius',
                    tool: 'setNodeParameter',
                    arguments: {},
                  },
                ],
              },
            },
          ],
        };
      },
    },
    defaultAISettings,
  );
  await agent.run('修改参数');
  expect(calls).toBe(2);
  expect(validates).toBe(3);
  expect(agent.getSnapshot().currentPlan?.goal).toBe('valid');
});

it('recovers prose-only thinking with a forced plan without executing prose', async () => {
  let calls = 0;
  const agent = new AgentOrchestrator(
    runtime(),
    {
      chat: async (_task, request) => {
        calls++;
        if (calls === 1)
          return { model: 'fixture', text: '我将创建路径渐变', toolCalls: [] };
        expect(request.toolChoice).toBe('submitPlan');
        expect(request.tools?.map((t) => t.name)).toEqual(['submitPlan']);
        return {
          model: 'fixture',
          text: '',
          toolCalls: [
            {
              id: 'call',
              name: 'submitPlan',
              arguments: {
                id: 'plan',
                goal: '路径渐变',
                risk: 'low',
                steps: [
                  {
                    id: 's',
                    label: '修改',
                    tool: 'setNodeParameter',
                    arguments: {},
                  },
                ],
              },
            },
          ],
        };
      },
    },
    defaultAISettings,
  );
  await agent.run('创建一个路径渐变');
  expect(calls).toBe(2);
  expect(agent.getSnapshot().currentPlan?.goal).toBe('路径渐变');
});
it('bounds repeated prose-only responses and reports tool compatibility', async () => {
  let calls = 0;
  const agent = new AgentOrchestrator(
    runtime(),
    {
      chat: async () => {
        calls++;
        return { model: 'fixture', text: '思考', toolCalls: [] };
      },
    },
    defaultAISettings,
  );
  await agent.run('创建路径渐变');
  expect(calls).toBe(2);
  expect(agent.getSnapshot().status).toBe('failed');
  expect(agent.getSnapshot().response).toContain('工具调用');
});
