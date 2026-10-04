// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AgentPanel } from '../src/ui/AgentPanel';
import { createNativeAgent } from '../src/ui/native-agent-controller';
import { EditorStore } from '../src/ui/editor-store';
import { createDefaultProject } from '../src/core/project-model';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { AIProviderManager } from '../src/ai/provider-manager';
import { createAIPlatform } from '../src/ai/platform';
import { MockAIProvider } from '../src/ai/mock-provider';
afterEach(() => {
  cleanup();
  localStorage.clear();
});
async function setup(configured = true) {
  const platform = createAIPlatform(undefined, true),
    manager = new AIProviderManager(platform.storage, platform.transport);
  await manager.initialize();
  const store = new EditorStore(createDefaultProject());
  if (configured) {
    const id = crypto.randomUUID(),
      layerId = crypto.randomUUID();
    await manager.saveProvider({
      id,
      name: 'Mock QA',
      type: 'mock',
      baseUrl: 'https://example.invalid/v1',
      enabled: true,
      defaultModel: 'mock-v1',
      models: [
        { id: 'mock-v1', name: 'Mock', capabilities: ['text', 'vision'] },
      ],
    });
    manager.register(
      new MockAIProvider(id, 'Mock QA', async () => ({
        text: '',
        model: 'mock-v1',
        toolCalls: [
          {
            id: 'plan',
            name: 'submitPlan',
            arguments: {
              id: 'qa-plan',
              goal: '创建中心标题',
              risk: 'low',
              steps: [
                {
                  id: 'create',
                  label: '创建标题',
                  tool: 'createText',
                  arguments: { layerId, content: 'HELLO SWAYFRAME' },
                },
              ],
            },
          },
        ],
      })),
    );
  }
  const { agent } = createNativeAgent(store, manager);
  return { store, manager, agent };
}
it('no-provider state opens application settings and keeps prompt execution disabled', async () => {
  const s = await setup(false),
    open = vi.fn();
  window.addEventListener('swayframe:ai-settings', open);
  try {
    render(<AgentPanel {...s} />);
    fireEvent.click(screen.getByText('配置 AI 服务'));
    expect(open).toHaveBeenCalledOnce();
    expect((screen.getByText('发送') as HTMLButtonElement).disabled).toBe(true);
  } finally {
    window.removeEventListener('swayframe:ai-settings', open);
  }
});
it('real panel prompt runs native controller tools and commands, updates scene renderer input and Undo once', async () => {
  const s = await setup();
  render(<AgentPanel {...s} />);
  fireEvent.change(screen.getByLabelText('Agent 需求'), {
    target: { value: '创建一个标题 HELLO SWAYFRAME，放在中心' },
  });
  fireEvent.keyDown(screen.getByLabelText('Agent 需求'), { key: 'Enter' });
  await waitFor(() => expect(s.agent.getSnapshot().status).toBe('completed'));
  const project = s.store.commands.getSnapshot(),
    c = project.compositions[0]!,
    layer = c.layers[0]!;
  expect(layer).toMatchObject({ type: 'text', text: 'HELLO SWAYFRAME' });
  expect(layer.transform.position.baseValue).toEqual({ x: 960, y: 540 });
  expect(
    createRenderSnapshot(c, 0, [], undefined, project).layers[0]?.source.id,
  ).toBe(layer.id);
  expect(s.store.commands.undoStack).toHaveLength(1);
  fireEvent.click(screen.getByText('撤销 Agent 修改'));
  await waitFor(() =>
    expect(s.store.commands.getSnapshot().compositions[0]!.layers).toHaveLength(
      0,
    ),
  );
  expect(s.store.commands.undoStack).toHaveLength(0);
});
it('Assist only plans and Shift+Enter retains multiline input', async () => {
  const s = await setup();
  render(<AgentPanel {...s} />);
  fireEvent.change(screen.getByLabelText('Agent 模式'), {
    target: { value: 'ASSIST' },
  });
  fireEvent.change(screen.getByLabelText('Agent 需求'), {
    target: { value: '创建标题' },
  });
  fireEvent.keyDown(screen.getByLabelText('Agent 需求'), {
    key: 'Enter',
    shiftKey: true,
  });
  expect(s.agent.getSnapshot().status).toBe('idle');
  fireEvent.click(screen.getByText('发送'));
  await waitFor(() => expect(s.agent.getSnapshot().status).toBe('completed'));
  expect(s.store.commands.undoStack).toHaveLength(0);
  expect(s.store.commands.getSnapshot().compositions[0]!.layers).toHaveLength(
    0,
  );
});
