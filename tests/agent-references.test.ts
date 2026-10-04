// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { AIProviderManager } from '../src/ai/provider-manager';
import { createAIPlatform } from '../src/ai/platform';
import { MockAIProvider } from '../src/ai/mock-provider';
import type { ChatRequest } from '../src/ai/contracts';
import { createNativeAgent } from '../src/ui/native-agent-controller';
import { EditorStore } from '../src/ui/editor-store';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { skillsFor } from '../src/agent/skills';
import { importAgentReference } from '../src/agent/references';
afterEach(() => localStorage.clear());
async function setup(tool = 'setPosition', args?: Record<string, unknown>) {
  const platform = createAIPlatform(undefined, true),
    manager = new AIProviderManager(platform.storage, platform.transport);
  await manager.initialize();
  const id = crypto.randomUUID(),
    layer = createLayer('rectangle'),
    p = createDefaultProject(),
    store = new EditorStore({
      ...p,
      compositions: [{ ...p.compositions[0]!, layers: [layer] }],
    });
  await manager.saveProvider({
    id,
    name: 'Vision',
    type: 'mock',
    baseUrl: 'https://example.invalid',
    enabled: true,
    defaultModel: 'vision',
    models: [
      { id: 'vision', name: 'vision', capabilities: ['text', 'vision'] },
    ],
  });
  const requests: ChatRequest[] = [];
  manager.register(
    new MockAIProvider(id, 'Mock', async (request) => {
      requests.push(request);
      return {
        text: '',
        model: 'vision',
        toolCalls: [
          {
            id: 'call',
            name: 'submitPlan',
            arguments: {
              id: 'plan',
              goal: 'reference layout',
              risk: 'low',
              steps: [
                {
                  id: 'step',
                  label: 'layout',
                  tool,
                  arguments: args ?? {
                    layerId: layer.id,
                    value: { x: 400, y: 300 },
                  },
                },
              ],
            },
          },
        ],
      };
    }),
  );
  const { agent } = createNativeAgent(store, manager);
  await waitFor(() =>
    expect(skillsFor(manager.storage).getSnapshot().ready).toBe(true),
  );
  agent.setReferences(
    [
      {
        id: crypto.randomUUID(),
        name: 'ref.png',
        kind: 'image',
        frames: ['data:image/png;base64,AAAA'],
      },
    ],
    'layout-only',
  );
  return { agent, manager, store, requests, layer };
}
it('authorized reference image reaches vision planning; layout-only changes position, retains color and never creates an Asset', async () => {
  const s = await setup();
  const fill = s.layer.editor!.properties.fill!.baseValue;
  await s.agent.run('参考图片的布局');
  expect(s.agent.getSnapshot().status).toBe('completed');
  expect(s.requests[0]!.messages.some((m) => m.images?.length)).toBe(true);
  const p = s.store.commands.getSnapshot();
  expect(p.assets).toHaveLength(0);
  expect(p.compositions[0]!.layers[0]!.transform.position.baseValue).toEqual({
    x: 400,
    y: 300,
  });
  expect(
    p.compositions[0]!.layers[0]!.editor!.properties.fill!.baseValue,
  ).toEqual(fill);
  expect(s.store.commands.undoStack).toHaveLength(1);
});
it('layout-only blocks a model color plan and privacy removes all reference pixels from requests', async () => {
  const s = await setup('setFill', {
    layerId: crypto.randomUUID(),
    color: { r: 1, g: 0, b: 0, a: 1 },
  });
  await s.agent.run('布局');
  expect(s.agent.getSnapshot().status).toBe('failed');
  expect(s.store.commands.undoStack).toHaveLength(0);
  await s.manager.update((a) => ({
    ...a,
    privacy: { ...a.privacy, sendReferences: false },
  }));
  await s.agent.run('普通任务');
  expect(s.requests.at(-1)!.messages.some((m) => m.images?.length)).toBe(false);
});
it('unsupported disk-like files and oversize references are rejected before any decoding', async () => {
  await expect(
    importAgentReference(
      new File(['shell'], 'command.sh', { type: 'text/plain' }),
      new AbortController().signal,
    ),
  ).rejects.toThrow('请选择');
  const controller = new AbortController();
  controller.abort();
  await expect(
    importAgentReference(
      new File([], 'image.png', { type: 'image/png' }),
      controller.signal,
    ),
  ).rejects.toThrow();
});
