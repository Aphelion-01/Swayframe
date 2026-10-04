// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { AIError, credentialsSchema } from '../src/ai/contracts';
import { AIProviderManager } from '../src/ai/provider-manager';
import { createAIPlatform } from '../src/ai/platform';
import { MockAIProvider } from '../src/ai/mock-provider';
import { createAIPlatform as nativePlatform } from '../src/ai/platform';
import type { DesktopAIAPI } from '../src/ai/desktop-contracts';
afterEach(() => localStorage.clear());
async function setup() {
  const p = createAIPlatform(undefined, true),
    m = new AIProviderManager(p.storage, p.transport);
  await m.initialize();
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  for (const [i, id] of ids.entries())
    await m.saveProvider({
      id,
      name: i ? 'B' : 'A',
      type: 'mock',
      baseUrl: 'https://example.invalid',
      enabled: true,
      defaultModel: 'mock',
      models: [{ id: 'mock', name: 'mock', capabilities: ['text', 'vision'] }],
    });
  return { m, p, ids };
}
const request = { messages: [{ role: 'user' as const, content: 'test' }] };
it('rate limit switches provider once, shows fallback and records only returned usage', async () => {
  const s = await setup(),
    a = vi.fn(async () => {
      throw new AIError('rate_limit', '限流');
    }),
    b = vi.fn(async () => ({
      text: 'OK',
      model: 'mock',
      toolCalls: [],
      usage: { inputTokens: 8, outputTokens: 2, totalTokens: 10 },
    }));
  s.m.register(new MockAIProvider(s.ids[0]!, 'A', a));
  s.m.register(new MockAIProvider(s.ids[1]!, 'B', b));
  const reply = await s.m.chat('planning', request);
  expect(reply.text).toBe('OK');
  expect(a).toHaveBeenCalledOnce();
  expect(b).toHaveBeenCalledOnce();
  expect(s.m.getSnapshot().fallback).toContain('切换 B');
  expect(s.m.getSnapshot().usage.records[0]?.cost).toBeUndefined();
  expect(s.m.getSnapshot().usage.records[0]?.providerId).toBe(s.ids[1]);
  const reopened = new AIProviderManager(s.p.storage, s.p.transport);
  await reopened.initialize();
  expect(reopened.getSnapshot().usage.records).toHaveLength(1);
});
it('invalid keys never fail over; Stop cancels bounded backoff and does not call fallback', async () => {
  const s = await setup(),
    b = vi.fn(async () => ({ text: 'OK', model: 'mock', toolCalls: [] }));
  s.m.register(
    new MockAIProvider(s.ids[0]!, 'A', async () => {
      throw new AIError('invalid_key', '密钥无效');
    }),
  );
  s.m.register(new MockAIProvider(s.ids[1]!, 'B', b));
  await expect(s.m.chat('planning', request)).rejects.toMatchObject({
    code: 'invalid_key',
  });
  expect(b).not.toHaveBeenCalled();
  const c = new AbortController();
  s.m.register(
    new MockAIProvider(s.ids[0]!, 'A', async () => {
      c.abort();
      throw new AIError('rate_limit', '限流');
    }),
  );
  await expect(s.m.chat('planning', request, c.signal)).rejects.toThrow();
  expect(b).not.toHaveBeenCalled();
});
it('budget warns at 80%, blocks the next call at 100% and respects vision capability routes', async () => {
  const s = await setup(),
    handler = vi.fn(async () => ({
      text: 'OK',
      model: 'mock',
      toolCalls: [],
      usage: { inputTokens: 8, outputTokens: 2, totalTokens: 10 },
    }));
  s.m.register(new MockAIProvider(s.ids[0]!, 'A', handler));
  await s.m.update((a) => ({
    ...a,
    budget: { dailyTokens: 10, action: 'stop' },
    routing: {
      ...a.routing,
      vision: { providerId: s.ids[0]!, modelId: 'mock' },
    },
  }));
  await s.m.chat('vision', request);
  expect(s.m.getSnapshot().budgetWarning).toContain('已达到');
  await expect(s.m.chat('planning', request)).rejects.toThrow('预算');
  expect(handler).toHaveBeenCalledOnce();
  expect(s.m.getSnapshot().settings.routing.vision?.providerId).toBe(s.ids[0]);
});
it('native bridge serialized error keeps rate_limit classification; credential newline injection is rejected', async () => {
  const api = {
    chat: async () => {
      throw Error('[SF_AI:rate_limit]请求限流');
    },
    cancel: async () => {},
    chunks: async () => [],
  } as unknown as DesktopAIAPI;
  const platform = nativePlatform(api);
  await expect(
    platform.transport.chat(
      {
        id: crypto.randomUUID(),
        name: 'test',
        type: 'openai-compatible',
        baseUrl: 'https://example.invalid',
        enabled: true,
        defaultModel: 'm',
        models: [],
      },
      { ...request, model: 'm' },
    ),
  ).rejects.toMatchObject({ code: 'rate_limit', message: '请求限流' });
  expect(
    credentialsSchema.safeParse({ apiKey: 'secret\nInjected', headers: {} })
      .success,
  ).toBe(false);
  expect(
    credentialsSchema.safeParse({
      apiKey: 'secret',
      headers: { 'X-Test': 'value\r\nHost:evil' },
    }).success,
  ).toBe(false);
});
