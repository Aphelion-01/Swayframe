import { expect, it, vi } from 'vitest';
import { IntelligenceService } from '../src/agent/intelligence';
import type { AgentModelPort } from '../src/agent/session';
import { createDefaultProject } from '../src/core/project-model';
const tools = [
  {
    name: 'setPosition',
    description: 'position',
    parameters: { type: 'object' },
  },
];
it('professional analysis returns a typed Proposal with pixels, never changes Scene or executes its suggested command', async () => {
  const project = createDefaultProject(),
    before = JSON.stringify(project),
    plan = {
      id: 'proposal',
      goal: '布局建议',
      risk: 'low',
      steps: [
        {
          id: 'p',
          label: '移动',
          tool: 'setPosition',
          arguments: {
            layerId: crypto.randomUUID(),
            value: { x: 300, y: 200 },
          },
        },
      ],
    };
  const chat = vi.fn<AgentModelPort['chat']>(async () => ({
    text: '',
    model: 'vision',
    toolCalls: [{ id: 'p', name: 'submitProposal', arguments: plan }],
  }));
  const service = new IntelligenceService({ chat });
  const proposal = await service.analyzeLayout(
    {
      goal: 'improve layout',
      context: { projectName: project.name },
      tools,
      images: ['data:image/png;base64,AAAA'],
    },
    new AbortController().signal,
  );
  expect(proposal).toMatchObject({ kind: 'layout', plan });
  expect(chat.mock.calls[0]?.[0]).toBe('vision');
  expect(JSON.stringify(project)).toBe(before);
  expect(Object.isFrozen(proposal)).toBe(true);
});
it('analysis cannot suggest arbitrary execution or bypass its supplied tool scope', async () => {
  const service = new IntelligenceService({
    chat: async () => ({
      text: '',
      model: 'm',
      toolCalls: [
        {
          id: 'p',
          name: 'submitProposal',
          arguments: {
            id: 'p',
            goal: 'bad',
            risk: 'low',
            steps: [
              {
                id: 'p',
                label: 'execute',
                tool: 'eval',
                arguments: { code: 'steal()' },
              },
            ],
          },
        },
      ],
    }),
  });
  await expect(
    service.analyzeReference(
      {
        goal: 'layout only',
        context: { referenceMode: 'layout-only' },
        tools,
        images: ['data:image/png;base64,AAAA'],
      },
      new AbortController().signal,
    ),
  ).rejects.toThrow('工具范围');
});

it('advertises the real 12-step limit and exact tool arguments; repairs an oversized proposal once', async () => {
  const step = (id: string) => ({
    id,
    label: '移动',
    tool: 'setPosition',
    arguments: {},
  });
  const plan = {
    id: 'p',
    goal: '融合效果的可编辑近似',
    risk: 'low',
    steps: Array.from({ length: 13 }, (_, i) => step(String(i))),
  };
  const chat = vi
    .fn<AgentModelPort['chat']>()
    .mockResolvedValueOnce({
      text: '',
      model: 'm',
      toolCalls: [{ id: 'a', name: 'submitProposal', arguments: plan }],
    })
    .mockResolvedValueOnce({
      text: '',
      model: 'm',
      toolCalls: [
        {
          id: 'b',
          name: 'submitProposal',
          arguments: { ...plan, steps: [step('one')] },
        },
      ],
    });
  const result = await new IntelligenceService({ chat }).analyzeMotion(
    { goal: '融合图形', context: {}, tools },
    new AbortController().signal,
  );
  expect(result.plan.steps).toHaveLength(1);
  expect(chat).toHaveBeenCalledTimes(2);
  const schema = chat.mock.calls[0]![1].tools![0]!.parameters;
  expect(schema).toMatchObject({
    properties: {
      steps: {
        maxItems: 12,
        items: {
          oneOf: [
            {
              properties: {
                tool: { const: 'setPosition' },
                arguments: tools[0]!.parameters,
              },
            },
          ],
        },
      },
    },
  });
  expect(chat.mock.calls[1]![1].messages.at(-1)!.content).toContain('13');
});

it('unknown tools remain rejected after one correction, with actionable names and no execution', async () => {
  const chat = vi.fn<AgentModelPort['chat']>(async () => ({
    text: '',
    model: 'm',
    toolCalls: [
      {
        id: 'p',
        name: 'submitProposal',
        arguments: {
          id: 'p',
          goal: '融合',
          risk: 'low',
          steps: [
            { id: 's', label: '融合', tool: 'mergeShapes', arguments: {} },
          ],
        },
      },
    ],
  }));
  await expect(
    new IntelligenceService({ chat }).analyzeMotion(
      { goal: '融合', context: {}, tools },
      new AbortController().signal,
    ),
  ).rejects.toThrow('mergeShapes');
  expect(chat).toHaveBeenCalledTimes(2);
});

it('cancel during invalid proposal response never starts correction', async () => {
  const controller = new AbortController();
  const chat = vi.fn<AgentModelPort['chat']>(async () => {
    controller.abort();
    return { text: '', model: 'm', toolCalls: [] };
  });
  await expect(
    new IntelligenceService({ chat }).analyzeMotion(
      { goal: '融合', context: {}, tools },
      controller.signal,
    ),
  ).rejects.toThrow();
  expect(chat).toHaveBeenCalledTimes(1);
});
