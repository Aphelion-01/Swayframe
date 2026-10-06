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
import * as referenceImport from '../src/agent/references';
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
it('keeps failed input and lets the user retry instead of clearing it before execution', async () => {
  const s = await setup();
  const id = s.manager.resolve().provider.id;
  s.manager.register(
    new MockAIProvider(id, 'Failing QA', async () => {
      throw Error('测试网络错误');
    }),
  );
  render(<AgentPanel {...s} />);
  fireEvent.change(screen.getByLabelText('Agent 需求'), {
    target: { value: '保留这段修改需求' },
  });
  fireEvent.click(screen.getByText('发送'));
  await waitFor(() => expect(s.agent.getSnapshot().status).toBe('failed'));
  expect(
    (screen.getByLabelText('Agent 需求') as HTMLTextAreaElement).value,
  ).toBe('保留这段修改需求');
  expect(screen.getAllByText('测试网络错误').length).toBeGreaterThan(0);
  expect((screen.getByText('发送') as HTMLButtonElement).disabled).toBe(false);
});
it('warns about text-only models when references are present, preserves input and allows text after reference removal', async () => {
  const s = await setup();
  const provider = s.manager.resolve().provider;
  await s.manager.saveProvider({
    ...provider,
    models: provider.models.map((m) => ({ ...m, capabilities: ['text'] })),
  });
  s.agent.setReferences(
    [
      {
        id: crypto.randomUUID(),
        name: '参考.png',
        kind: 'image',
        frames: ['data:image/png;base64,AAAA'],
      },
    ],
    'overall',
  );
  render(<AgentPanel {...s} />);
  fireEvent.change(screen.getByLabelText('Agent 需求'), {
    target: { value: '参照图片创建标题' },
  });
  fireEvent.click(screen.getByText('发送'));
  expect(screen.getByText(/当前参考无法发送/)).toBeTruthy();
  expect(s.agent.getSnapshot().status).toBe('idle');
  expect(
    (screen.getByLabelText('Agent 需求') as HTMLTextAreaElement).value,
  ).toBe('参照图片创建标题');
  fireEvent.click(screen.getByLabelText('移除参考 参考.png'));
  fireEvent.click(screen.getByText('发送'));
  await waitFor(() => expect(s.agent.getSnapshot().status).toBe('completed'));
  expect(
    (screen.getByLabelText('Agent 需求') as HTMLTextAreaElement).value,
  ).toBe('');
});
it('imports dropped and pasted images through the same reference path without adding Scene assets', async () => {
  const s = await setup();
  const importer = vi
    .spyOn(referenceImport, 'importAgentReference')
    .mockImplementation(async (file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      kind: 'image',
      frames: ['data:image/png;base64,AAAA'],
    }));
  render(
    <div
      onDrop={() => {
        throw Error('drop must not reach Scene importer');
      }}
    >
      <AgentPanel {...s} />
    </div>,
  );
  const zone = screen.getByRole('region', { name: '参考图：支持拖入或粘贴' });
  fireEvent.drop(zone, {
    dataTransfer: {
      files: [new File(['image'], 'drop.png', { type: 'image/png' })],
    },
  });
  await screen.findByText('drop.png');
  fireEvent.paste(screen.getByLabelText('Agent 需求'), {
    clipboardData: {
      files: [new File(['image'], 'paste.png', { type: 'image/png' })],
    },
  });
  await screen.findByText('paste.png');
  expect(importer).toHaveBeenCalledTimes(2);
  expect(s.agent.getSnapshot().references).toHaveLength(2);
  expect(s.store.commands.getSnapshot().assets).toHaveLength(0);
  fireEvent.drop(zone, {
    dataTransfer: {
      files: [new File(['image'], 'third.png', { type: 'image/png' })],
    },
  });
  await screen.findByText('最多添加两份参考，请先移除已有参考');
  expect(importer).toHaveBeenCalledTimes(2);
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
