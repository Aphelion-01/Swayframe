// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AISettings } from '../src/ui/ai/AISettings';
import { AIProviderManager } from '../src/ai/provider-manager';
import { createAIPlatform } from '../src/ai/platform';
import type { ProviderConfig } from '../src/ai/contracts';
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it('supports provider CRUD/default/connection/model capabilities and does not persist secrets in browser storage', async () => {
  const platform = createAIPlatform(undefined, true);
  const manager = new AIProviderManager(platform.storage, {
    chat: vi.fn(),
    listModels: async () => [
      { id: 'test-model', name: 'test-model', capabilities: ['text'] },
    ],
    testConnection: async () => ({ ok: true, message: '测试已通过' }),
  });
  await manager.initialize();
  render(<AISettings manager={manager} onClose={vi.fn()} />);
  fireEvent.click(screen.getByText('添加服务'));
  fireEvent.change(screen.getByLabelText('默认模型'), {
    target: { value: 'test-model' },
  });
  fireEvent.change(screen.getByLabelText('API Key'), {
    target: { value: 'FAKE_SECRET_TEST' },
  });
  fireEvent.click(screen.getByText('保存服务'));
  await waitFor(() => expect(screen.getByText('编辑')).toBeTruthy());
  expect(JSON.stringify(localStorage)).not.toContain('FAKE_SECRET_TEST');
  expect(manager.getSnapshot().settings.providers).toHaveLength(1);
  expect(manager.getSnapshot().settings.defaultProviderId).toBe(
    manager.getSnapshot().settings.providers[0]?.id,
  );
  fireEvent.click(screen.getByText('测试连接'));
  await screen.findByText('测试已通过');
  fireEvent.click(screen.getByRole('tab', { name: '模型' }));
  fireEvent.click(screen.getByText('获取模型列表'));
  await screen.findByText('test-model');
  fireEvent.click(screen.getByLabelText('test-model vision'));
  await waitFor(() =>
    expect(manager.models.list()[0]?.capabilities).toContain('vision'),
  );
  fireEvent.click(screen.getByRole('tab', { name: '服务' }));
  fireEvent.click(screen.getByText('停用'));
  await screen.findByText('启用');
  expect(() => manager.resolve()).toThrow('启用');
  fireEvent.click(screen.getByText('启用'));
  await screen.findByText('停用');
  fireEvent.click(screen.getByText('删除'));
  await waitFor(() =>
    expect(manager.getSnapshot().settings.providers).toHaveLength(0),
  );
});
it('production web rejects credential saving and model registry requires explicit vision capabilities', async () => {
  const platform = createAIPlatform(undefined, false);
  await expect(
    platform.storage.setCredentials(crypto.randomUUID(), {
      apiKey: 'secret',
      headers: {},
    }),
  ).rejects.toThrow('桌面版');
  expect(await platform.storage.storageStatus()).toBe('unavailable');
  const manager = new AIProviderManager(platform.storage, platform.transport);
  await manager.initialize();
  const config: ProviderConfig = {
    id: crypto.randomUUID(),
    name: 'test',
    type: 'openai-compatible',
    baseUrl: 'https://example.com',
    enabled: true,
    defaultModel: 'text-only',
    models: [{ id: 'text-only', name: 'test', capabilities: ['text'] }],
  };
  await manager.saveProvider(config);
  expect(() => manager.resolve('vision')).toThrow('视觉');
});
