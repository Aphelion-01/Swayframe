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
