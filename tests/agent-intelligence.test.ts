import { expect, it, vi } from 'vitest';
import { AIError } from '../src/ai/contracts';
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
    service.analyzeLayout(
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

it('reference analysis requires actual pixels and validated element observations, never a fixed substitute', async () => {
  const chat = vi.fn<AgentModelPort['chat']>();
  const service = new IntelligenceService({ chat });
  await expect(
    service.analyzeReference(
      { goal: 'inspect', context: {}, tools },
      new AbortController().signal,
    ),
  ).rejects.toThrow('参考像素');
  expect(chat).not.toHaveBeenCalled();
  const referenceAnalysis = {
    canvas: { width: 410, height: 230, background: 'warm gray' },
    visualElements: [
      {
        id: 'title',
        type: 'text',
        bounds: { x: 165, y: 120, width: 90, height: 40 },
        position: 'front',
        layering: 2,
        geometry: 'text',
        colors: ['black'],
        gradients: [],
        effects: [],
        typography: 'Cubic serif',
        dependencies: [],
        confidence: 0.8,
        mapping: 'createText',
      },
    ],
    spatialRelationships: [],
    limitations: ['depth inferred from 2D'],
    confidence: 0.8,
  };
  const plan = {
    id: 'reference',
    goal: 'visual proposal',
    risk: 'low',
    steps: [{ id: 's', label: 'move', tool: 'setPosition', arguments: {} }],
    referenceAnalysis,
  };
  chat.mockResolvedValue({
    text: '',
    model: 'vision',
    toolCalls: [{ id: 'p', name: 'submitProposal', arguments: plan }],
  });
  const proposal = await service.analyzeReference(
    {
      goal: 'inspect',
      context: {},
      tools,
      images: ['data:image/png;base64,AAAA'],
    },
    new AbortController().signal,
  );
  expect(proposal.referenceAnalysis).toEqual(referenceAnalysis);
  expect(proposal.plan).not.toHaveProperty('referenceAnalysis');
  expect(chat.mock.calls[0]![1].messages[1]?.images).toEqual([
    'data:image/png;base64,AAAA',
  ]);
});

it('returns concrete missing fields to the model so it can repair a malformed proposal', async () => {
  const valid = {
    id: 'p',
    goal: '布局',
    risk: 'low',
    steps: [{ id: 's', label: '移动', tool: 'setPosition', arguments: {} }],
  };
  const chat = vi
    .fn<AgentModelPort['chat']>()
    .mockResolvedValueOnce({
      text: '',
      model: 'm',
      toolCalls: [
        {
          id: 'a',
          name: 'submitProposal',
          arguments: { id: 'p', goal: '布局', risk: 'low' },
        },
      ],
    })
    .mockResolvedValueOnce({
      text: '',
      model: 'm',
      toolCalls: [{ id: 'b', name: 'submitProposal', arguments: valid }],
    });
  const result = await new IntelligenceService({ chat }).analyzeLayout(
    { goal: '布局', context: {}, tools },
    new AbortController().signal,
  );
  expect(result.plan).toEqual(valid);
  expect(chat.mock.calls[1]![1].messages.at(-1)?.content).toContain('steps:');
  expect(chat.mock.calls[1]![1].messages.at(-1)?.content).toContain(
    'expected array',
  );
});

it('recovers one invalid JSON provider response but never retries a credentials failure', async () => {
  const plan = {
    id: 'p',
    goal: '布局',
    risk: 'low',
    steps: [{ id: 's', label: '移动', tool: 'setPosition', arguments: {} }],
  };
  const chat = vi
    .fn<AgentModelPort['chat']>()
    .mockRejectedValueOnce(
      new AIError('invalid_response', '工具参数不是完整 JSON'),
    )
    .mockResolvedValueOnce({
      text: '',
      model: 'm',
      toolCalls: [{ id: 'a', name: 'submitProposal', arguments: plan }],
    });
  const input = { goal: '布局', context: {}, tools };
  expect(
    (
      await new IntelligenceService({ chat }).analyzeLayout(
        input,
        new AbortController().signal,
      )
    ).plan,
  ).toEqual(plan);
  expect(chat).toHaveBeenCalledTimes(2);
  const denied = vi
    .fn<AgentModelPort['chat']>()
    .mockRejectedValue(new AIError('setup', '密钥不可用'));
  await expect(
    new IntelligenceService({ chat: denied }).analyzeLayout(
      input,
      new AbortController().signal,
    ),
  ).rejects.toThrow('密钥不可用');
  expect(denied).toHaveBeenCalledTimes(1);
});
