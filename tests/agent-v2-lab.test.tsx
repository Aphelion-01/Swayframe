// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AgentV2Lab } from '../src/ui/AgentV2Lab';
import { AgentPanel } from '../src/ui/AgentPanel';
import { AgentSnapshotRenderer } from '../src/agent/vision';
import { AIProviderManager } from '../src/ai/provider-manager';
import { defaultAISettings } from '../src/ai/contracts';
import type { AITransport } from '../src/ai/contracts';
import { createNativeAgent } from '../src/ui/native-agent-controller';
import { EditorStore } from '../src/ui/editor-store';
import { createDefaultProject } from '../src/core/project-model';
const intent = {
  goal: 'test',
  actions: [{ id: 'shape', type: 'createShape', shape: 'rectangle' }],
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.location.hash = '';
});
async function setup(failure = false, response?: AITransport['chat']) {
  const settings = defaultAISettings();
  const p = {
    id: crypto.randomUUID(),
    name: 'OFFLINE',
    type: 'openai-compatible' as const,
    enabled: true,
    baseUrl: 'https://example.invalid',
    defaultModel: 'fixture',
    models: [
      { id: 'fixture', name: 'Fixture', capabilities: ['text' as const] },
    ],
  };
  settings.providers = [p];
  settings.defaultProviderId = p.id;
  const data = new Map();
  const chat = vi.fn<AITransport['chat']>(
    response ??
      (async () => {
        if (failure) throw Error('offline failure');
        return {
          model: 'fixture',
          text: '',
          toolCalls: [{ id: '1', name: 'submitIntent', arguments: intent }],
        };
      }),
  );
  const manager = new AIProviderManager(
    {
      loadSettings: async () => settings,
      saveSettings: async () => {},
      setCredentials: async () => {},
      removeCredentials: async () => {},
      hasCredentials: async () => true,
      storageStatus: async () => 'memory-only',
      readData: async (k) => data.get(k),
      writeData: async (k, v) => {
        data.set(k, v);
      },
    },
    {
      chat,
      listModels: async () => [],
      testConnection: async () => ({ ok: true, message: 'offline' }),
    },
  );
  await manager.initialize();
  // jsdom has no pixel renderer. These UI tests exercise the real runtime/commands, not optical output.
  vi.spyOn(AgentSnapshotRenderer.prototype, 'render').mockResolvedValue({
    image: 'data:image/png;base64,YQ==',
    pixelEvidence: { width: 10, height: 10, foregroundPixels: 4 },
  } as Awaited<ReturnType<AgentSnapshotRenderer['render']>>);
  return { manager, chat };
}
it('requires explicit enable, shows pending result, rejects and preserves input', async () => {
  const { manager, chat } = await setup();
  render(<AgentV2Lab manager={manager} onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText('V2 测试任务'), {
    target: { value: 'my test' },
  });
  expect((screen.getByText('执行隔离任务') as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(chat).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText('明确启用 Agent Core V2 隔离测试'));
  fireEvent.click(screen.getByText('执行隔离任务'));
  await waitFor(() =>
    expect(
      (screen.getByText('接受到隔离工程') as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  expect(screen.getByAltText('实际 Renderer 输出的隔离工程画面')).toBeTruthy();
  fireEvent.click(screen.getByText('拒绝结果'));
  await waitFor(() => expect(screen.getByText(/已拒绝，未提交/)).toBeTruthy());
  expect((screen.getByText('Undo') as HTMLButtonElement).disabled).toBe(true);
  expect(
    (screen.getByLabelText('V2 测试任务') as HTMLTextAreaElement).value,
  ).toBe('my test');
});
it('accepts into isolated Command history, supports Undo/Redo and never touches V1 store', async () => {
  const { manager } = await setup();
  const production = new EditorStore(createDefaultProject());
  const initial = production.commands.getSnapshot();
  render(<AgentV2Lab manager={manager} onClose={() => {}} />);
  fireEvent.click(screen.getByLabelText('明确启用 Agent Core V2 隔离测试'));
  fireEvent.change(screen.getByLabelText('V2 测试任务'), {
    target: { value: 'rectangle' },
  });
  fireEvent.click(screen.getByText('执行隔离任务'));
  await waitFor(() =>
    expect(
      (screen.getByText('接受到隔离工程') as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByText('接受到隔离工程'));
  expect((screen.getByText('Undo') as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByText('Undo'));
  expect((screen.getByText('Redo') as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByText('Redo'));
  expect(production.commands.getSnapshot()).toBe(initial);
  expect(production.commands.undoStack).toHaveLength(0);
});
it('failed task keeps typed input and cannot be accepted', async () => {
  const { manager } = await setup(true);
  render(<AgentV2Lab manager={manager} onClose={() => {}} />);
  fireEvent.click(screen.getByLabelText('明确启用 Agent Core V2 隔离测试'));
  fireEvent.change(screen.getByLabelText('V2 测试任务'), {
    target: { value: 'preserved' },
  });
  fireEvent.click(screen.getByText('执行隔离任务'));
  await waitFor(() =>
    expect(screen.getByText(/任务失败，未提交/)).toBeTruthy(),
  );
  expect(
    (screen.getByLabelText('V2 测试任务') as HTMLTextAreaElement).value,
  ).toBe('preserved');
  expect(
    (screen.getByText('接受到隔离工程') as HTMLButtonElement).disabled,
  ).toBe(true);
});
it('V1 remains default and developer entry is hidden without the explicit feature flag', async () => {
  const { manager } = await setup();
  const store = new EditorStore(createDefaultProject());
  const { agent } = createNativeAgent(store, manager);
  const view = render(
    <AgentPanel store={store} manager={manager} agent={agent} />,
  );
  expect(screen.getByText('Agent · Legacy V1')).toBeTruthy();
  expect(screen.queryByText('打开 V2 隔离测试')).toBeNull();
  view.unmount();
  window.location.hash = '#agent-v2-test';
  render(<AgentPanel store={store} manager={manager} agent={agent} />);
  expect(screen.getByText('打开 V2 隔离测试')).toBeTruthy();
});

const invalidOpacity = {
  goal: 'fixture recovery',
  actions: [
    { id: 'shape', type: 'createShape', shape: 'rectangle' },
    {
      id: 'opacity',
      type: 'setProperty',
      target: { kind: 'result', actionId: 'shape' },
      property: 'opacity',
      value: 2,
    },
  ],
};
it('shows recovery and completed prefix, then removes the historical error alert after success', async () => {
  let release: (() => void) | undefined;
  const { manager, chat } = await setup(false, async (_p, request) => {
    if (request.toolChoice === 'repairAction')
      await new Promise<void>((r) => {
        release = r;
      });
    return {
      model: 'fixture',
      text: '',
      toolCalls: [
        {
          id: 'fixture',
          name: request.toolChoice!,
          arguments:
            request.toolChoice === 'repairAction'
              ? { ...invalidOpacity.actions[1], value: 0.5 }
              : invalidOpacity,
        },
      ],
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
    };
  });
  render(<AgentV2Lab manager={manager} onClose={() => {}} />);
  fireEvent.click(screen.getByLabelText('明确启用 Agent Core V2 隔离测试'));
  fireEvent.change(screen.getByLabelText('V2 测试任务'), {
    target: { value: '保留这一任务' },
  });
  fireEvent.click(screen.getByText('执行隔离任务'));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain(
      '正在修复失败操作',
    ),
  );
  expect(screen.getByLabelText('任务进度').textContent).toContain(
    '已完成 1 / 2 步',
  );
  expect(screen.queryByRole('alert')).toBeNull();
  release!();
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('结果待接受'),
  );
  expect(screen.getByLabelText('任务进度').textContent).toContain(
    '已恢复 1 次',
  );
  expect(screen.queryByRole('alert')).toBeNull();
  expect(chat).toHaveBeenCalledTimes(2);
  const detail = screen.getByText('脱敏执行 Trace').parentElement!.textContent!;
  expect(detail).toContain('MODEL_ARGUMENTS');
  expect(detail).not.toContain('保留这一任务');
});
it('retains a failed prefix for explicitly labelled read-only preview and cannot accept it', async () => {
  const { manager, chat } = await setup(false, async (_p, request) => ({
    model: 'fixture',
    text: '',
    toolCalls: [
      {
        id: 'fixture',
        name: request.toolChoice!,
        arguments:
          request.toolChoice === 'repairAction'
            ? invalidOpacity.actions[1]
            : invalidOpacity,
      },
    ],
  }));
  render(<AgentV2Lab manager={manager} onClose={() => {}} />);
  fireEvent.click(screen.getByLabelText('明确启用 Agent Core V2 隔离测试'));
  fireEvent.change(screen.getByLabelText('V2 测试任务'), {
    target: { value: '继续保留' },
  });
  fireEvent.click(screen.getByText('执行隔离任务'));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('任务失败'),
  );
  expect(chat).toHaveBeenCalledTimes(2);
  expect(
    (screen.getByLabelText('V2 测试任务') as HTMLTextAreaElement).value,
  ).toBe('继续保留');
  fireEvent.click(screen.getByText('检查未完成草稿'));
  await waitFor(() =>
    expect(
      screen.getByText('未完成草稿 · 仅供检查，不代表任务通过'),
    ).toBeTruthy(),
  );
  const renderCall = vi
    .mocked(AgentSnapshotRenderer.prototype.render)
    .mock.calls.at(-1)!;
  expect(renderCall[0].compositions[0]!.layers).toHaveLength(1);
  expect(
    (screen.getByText('接受到隔离工程') as HTMLButtonElement).disabled,
  ).toBe(true);
  expect((screen.getByText('Undo') as HTMLButtonElement).disabled).toBe(true);
});
