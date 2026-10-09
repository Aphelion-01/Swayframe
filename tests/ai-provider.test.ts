import { expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from '../src/ai/openai-provider';
import {
  AIError,
  providerSchema,
  credentialsSchema,
} from '../src/ai/contracts';
import type { ProviderConfig } from '../src/ai/contracts';
const config: ProviderConfig = {
  id: '00000000-0000-4000-8000-000000000111',
  name: 'test',
  type: 'openai-compatible',
  baseUrl: 'https://example.com/v1',
  enabled: true,
  defaultModel: 'model',
  models: [{ id: 'model', name: 'model', capabilities: ['text', 'vision'] }],
};
const credentials = async () => ({
  apiKey: 'SECRET_TEST_VALUE',
  headers: { 'X-App': 'SF' },
});
const raw = {
  model: 'model',
  choices: [
    {
      message: {
        content: 'done',
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: { name: 'inspectSelection', arguments: '{}' },
          },
        ],
      },
      finish_reason: 'tool_calls',
    },
  ],
  usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
};
it('uses DeepSeek non-thinking mode for named Agent tools and leaves other services unchanged', async () => {
  const fetcher = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(raw)),
  );
  const provider = new OpenAICompatibleProvider(
    {
      ...config,
      baseUrl: 'https://api.deepseek.com',
      defaultModel: 'deepseek-flash',
    },
    credentials,
    fetcher,
  );
  await provider.chat({
    model: 'deepseek-flash',
    messages: [{ role: 'user', content: 'test' }],
    tools: [
      {
        name: 'inspectSelection',
        description: 'inspect',
        parameters: { type: 'object' },
      },
    ],
    toolChoice: 'inspectSelection',
  });
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    'https://api.deepseek.com/chat/completions',
  );
  expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
    thinking: { type: 'disabled' },
    tool_choice: { function: { name: 'inspectSelection' } },
  });
  await new OpenAICompatibleProvider(config, credentials, fetcher).chat({
    model: 'model',
    messages: [{ role: 'user', content: 'test' }],
  });
  expect(
    JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)),
  ).not.toHaveProperty('thinking');
});
it('accepts large compatible model catalogues while retaining the configured model within the 200-entry limit', async () => {
  const fetcher = vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({
          data: Array.from({ length: 400 }, (_, i) => ({ id: `model-${i}` })),
        }),
      ),
  );
  const provider = new OpenAICompatibleProvider(
    { ...config, defaultModel: 'model-399' },
    credentials,
    fetcher,
  );
  const models = await provider.listModels();
  expect(models).toHaveLength(200);
  expect(models[0]?.id).toBe('model-399');
});
it('sends typed tools and authorized images, reports actual usage and withholds keys from errors', async () => {
  const fetcher = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(raw), {
        headers: { 'content-type': 'application/json' },
      }),
  );
  const provider = new OpenAICompatibleProvider(config, credentials, fetcher);
  const result = await provider.chat({
    model: 'model',
    messages: [
      {
        role: 'user',
        content: 'inspect',
        images: ['data:image/png;base64,AAAA'],
      },
    ],
    tools: [
      {
        name: 'inspectSelection',
        description: 'inspect',
        parameters: { type: 'object', properties: {} },
      },
    ],
    toolChoice: 'inspectSelection',
  });
  expect(result.toolCalls).toEqual([
    { id: 'call-1', name: 'inspectSelection', arguments: {} },
  ]);
  expect(result.usage).toEqual({
    inputTokens: 12,
    outputTokens: 3,
    totalTokens: 15,
  });
  const [, request] = fetcher.mock.calls[0]!;
  expect(request?.redirect).toBe('error');
  expect(request?.headers).toMatchObject({
    Authorization: 'Bearer SECRET_TEST_VALUE',
  });
  expect(JSON.parse(String(request?.body))).toMatchObject({
    messages: [{ content: [{ type: 'text' }, { type: 'image_url' }] }],
    tool_choice: { function: { name: 'inspectSelection' } },
  });
  const bad = new OpenAICompatibleProvider(
    config,
    credentials,
    async () => new Response('SECRET_TEST_VALUE invalid', { status: 401 }),
  );
  await expect(
    bad.chat({ model: 'model', messages: [{ role: 'user', content: 'test' }] }),
  ).rejects.toMatchObject({ code: 'invalid_key' });
  try {
    await bad.listModels();
  } catch (e) {
    expect(String(e)).not.toContain('SECRET_TEST_VALUE');
  }
});
it('aggregates split SSE arguments and rejects interrupted streams without returning executable calls', async () => {
  const events = [
    {
      choices: [
        {
          delta: {
            content: 'go',
            tool_calls: [
              {
                index: 0,
                id: 'call-1',
                function: { name: 'inspectSelection', arguments: '{' },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    },
    {
      choices: [
        {
          delta: { tool_calls: [{ index: 0, function: { arguments: '}' } }] },
          finish_reason: 'tool_calls',
        },
      ],
    },
    { choices: [], usage: raw.usage },
  ];
  const text =
    events.map((e) => 'data: ' + JSON.stringify(e) + '\n\n').join('') +
    'data: [DONE]\n\n';
  const onText = vi.fn();
  const provider = new OpenAICompatibleProvider(
    config,
    credentials,
    async () =>
      new Response(text, { headers: { 'content-type': 'text/event-stream' } }),
  );
  const result = await provider.chat(
    {
      model: 'model',
      messages: [{ role: 'user', content: 'test' }],
      stream: true,
    },
    undefined,
    onText,
  );
  expect(result.toolCalls[0]?.arguments).toEqual({});
  expect(result.usage?.totalTokens).toBe(15);
  expect(onText).toHaveBeenCalledWith('go');
  const broken = new OpenAICompatibleProvider(
    config,
    credentials,
    async () =>
      new Response(text.replace('data: [DONE]', 'data: '), {
        headers: { 'content-type': 'text/event-stream' },
      }),
  );
  await expect(
    broken.chat({
      model: 'model',
      messages: [{ role: 'user', content: 'test' }],
      stream: true,
    }),
  ).rejects.toMatchObject({ code: 'invalid_response' });
});
it('bounds time, response size and rejects text-only vision, unsafe URLs and malformed calls', async () => {
  const abort = new AbortController();
  abort.abort();
  await expect(
    new OpenAICompatibleProvider(config, credentials).listModels(abort.signal),
  ).rejects.toMatchObject({ code: 'cancelled' });
  const timed = new OpenAICompatibleProvider(
    config,
    credentials,
    async (_url, options) =>
      new Promise((_resolve, reject) =>
        options?.signal?.addEventListener('abort', () =>
          reject(new Error('abort')),
        ),
      ),
    { timeoutMs: 5 },
  );
  await expect(timed.listModels()).rejects.toMatchObject({ code: 'timeout' });
  const large = new OpenAICompatibleProvider(
    config,
    credentials,
    async () => new Response('x'.repeat(100)),
    { maxResponseBytes: 10 },
  );
  await expect(large.listModels()).rejects.toMatchObject({
    code: 'invalid_response',
  });
  const textOnly = new OpenAICompatibleProvider(
    { ...config, models: [] },
    credentials,
  );
  await expect(
    textOnly.chat({
      model: 'model',
      messages: [
        {
          role: 'user',
          content: 'test',
          images: ['data:image/png;base64,AAAA'],
        },
      ],
    }),
  ).rejects.toMatchObject({ code: 'invalid_request' });
  expect(
    providerSchema.safeParse({
      ...config,
      baseUrl: 'https://user:password@example.com',
    }).success,
  ).toBe(false);
  expect(
    providerSchema.safeParse({
      ...config,
      baseUrl: 'http://remote.example.com',
    }).success,
  ).toBe(false);
  expect(
    credentialsSchema.safeParse({ apiKey: 'x', headers: { Host: 'evil' } })
      .success,
  ).toBe(false);
  const invalid = new OpenAICompatibleProvider(
    config,
    credentials,
    async () =>
      new Response(
        JSON.stringify({
          ...raw,
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    ...raw.choices[0]!.message.tool_calls[0],
                    function: { name: 'tool', arguments: '{' },
                  },
                ],
              },
            },
          ],
        }),
      ),
  );
  await expect(
    invalid.chat({
      model: 'model',
      messages: [{ role: 'user', content: 'test' }],
    }),
  ).rejects.toBeInstanceOf(AIError);
});
it('accepts pasted full API endpoints without duplicating chat/completions or models', async () => {
  const fetcher = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(raw)),
  );
  for (const suffix of [
    '/chat/completions',
    '/chat/completions/',
    '/models',
    '',
  ]) {
    await new OpenAICompatibleProvider(
      { ...config, baseUrl: config.baseUrl + suffix },
      credentials,
      fetcher,
    ).chat({ model: 'model', messages: [{ role: 'user', content: 'test' }] });
    expect(fetcher.mock.lastCall?.[0]).toBe(
      'https://example.com/v1/chat/completions',
    );
  }
});
