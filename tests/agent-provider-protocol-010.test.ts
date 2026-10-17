import { it, expect, vi } from 'vitest';
import { OpenAICompatibleProvider } from '../src/ai/openai-provider';
import { AIError, type ProviderConfig } from '../src/ai/contracts';
import { RecoveryController } from '../src/agent/recovery-controller';
import { createAIPlatform } from '../src/ai/platform';
import type { DesktopAIAPI } from '../src/ai/desktop-contracts';
const config: ProviderConfig = {
  id: crypto.randomUUID(),
  name: 'fixture',
  baseUrl: 'https://example.org/v1',
  type: 'openai-compatible',
  enabled: true,
  defaultModel: 'test',
  models: [{ id: 'test', name: 'test', capabilities: ['text'] }],
};
const credentials = async () => ({ apiKey: 'SECRET', headers: {} });
const request = {
  model: 'test',
  messages: [{ role: 'user' as const, content: 'test' }],
  tools: [
    { name: 'submitPlan', description: 'test', parameters: { type: 'object' } },
  ],
  toolChoice: 'submitPlan',
};
it('HTTP errors retain bounded whitelisted code/field and never secret body; 401 does not retry', async () => {
  const fetcher = vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 'invalid_tool_parameter',
            param: 'radius',
            message: 'SECRET user material',
          },
        }),
        { status: 401, headers: { 'x-request-id': 'req-1' } },
      ),
  );
  const p = new OpenAICompatibleProvider(config, credentials, fetcher);
  const r = new RecoveryController({ providerRetries: 2 });
  let caught: unknown;
  try {
    await r.chat(
      { chat: async () => p.chat(request) },
      'planning',
      'planning',
      { messages: request.messages },
    );
  } catch (e) {
    caught = e;
  }
  expect(caught).toMatchObject({
    code: 'invalid_key',
    details: {
      kind: 'http',
      status: 401,
      code: 'invalid_tool_parameter',
      field: 'radius',
    },
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(caught)).not.toContain('SECRET');
});
it('rate limit with long Retry-After safely stops instead of retrying too early; 5xx is bounded', async () => {
  const rate = new AIError('rate_limit', 'fixture', {
    kind: 'http',
    status: 429,
    retryAfterMs: 120000,
  });
  const chat = vi.fn(async () => {
    throw rate;
  });
  await expect(
    new RecoveryController().chat({ chat }, 'planning', 'planning', {
      messages: request.messages,
    }),
  ).rejects.toBe(rate);
  expect(chat).toHaveBeenCalledTimes(1);
  const transient = vi
    .fn()
    .mockRejectedValueOnce(
      new AIError('provider', 'fixture', { kind: 'http', status: 503 }),
    )
    .mockResolvedValue({ text: 'ok', toolCalls: [] });
  await new RecoveryController().chat(
    { chat: transient },
    'planning',
    'planning',
    { messages: request.messages },
  );
  expect(transient).toHaveBeenCalledTimes(2);
});
it('equivalent structured text and tool responses normalize to the same host plan arguments', async () => {
  const plan = {
    id: 'a',
    goal: 'rect',
    risk: 'low',
    steps: [{ id: 's', label: 'rect', tool: 'createRectangle', arguments: {} }],
  };
  const fetcher = vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({
          model: 'test',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  toolCalls: [{ name: 'submitPlan', arguments: plan }],
                }),
              },
              finish_reason: 'stop',
            },
          ],
        }),
      ),
  );
  const p = new OpenAICompatibleProvider(config, credentials, fetcher);
  const result = await p.chat({ ...request, responseMode: 'structured-plan' });
  expect(result.toolCalls[0]?.arguments).toEqual(plan);
  const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
  expect(body).not.toHaveProperty('tools');
  expect(body.messages[0].content).toContain('Authoritative contracts');
  const invalid = new OpenAICompatibleProvider(
    config,
    credentials,
    async () =>
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: '{"toolCalls":[' }, finish_reason: 'stop' },
          ],
        }),
      ),
  );
  await expect(
    invalid.chat({ ...request, responseMode: 'structured-plan' }),
  ).rejects.toMatchObject({
    code: 'invalid_response',
    details: { incomplete: true },
  });
});
it('incomplete SSE never returns half an executable plan and has typed protocol details', async () => {
  const p = new OpenAICompatibleProvider(
    config,
    credentials,
    async () =>
      new Response('data: {"choices":[{"delta":{"content":"thinking"}}]}\n\n', {
        headers: { 'content-type': 'text/event-stream' },
      }),
  );
  await expect(p.chat({ ...request, stream: true })).rejects.toMatchObject({
    details: { kind: 'incomplete-stream', incomplete: true },
  });
});
it('desktop error bridge preserves typed details while hiding its serialized envelope from UI', async () => {
  const details = { kind: 'http', status: 429, retryAfterMs: 1000 };
  const native = {
    chat: async () => {
      throw Error(
        '[SF_AI:rate_limit]限流\n[SF_DETAIL:' +
          encodeURIComponent(JSON.stringify(details)) +
          ']',
      );
    },
    cancel: async () => {},
    chunks: async () => [],
  } as unknown as DesktopAIAPI;
  await expect(
    createAIPlatform(native).transport.chat(config, request),
  ).rejects.toMatchObject({ code: 'rate_limit', message: '限流', details });
});
it('two endpoint fixtures with equivalent transports produce the same real Command behavior', async () => {
  const { CommandSystem } = await import('../src/core/command-system');
  const { createDefaultProject, activeComposition } =
    await import('../src/core/project-model');
  const { AgentToolRegistry } = await import('../src/agent/tool-registry');
  const { registerCoreWriteTools, registerAnimationTools } =
    await import('../src/agent/write-tools');
  const { registerSemanticActions } =
    await import('../src/agent/semantic-actions');
  const { AgentTransaction } = await import('../src/agent/transaction');
  const plan = {
    id: 'p',
    goal: 'same semantic edit',
    risk: 'low' as const,
    steps: [
      {
        id: 'create',
        label: 'shape',
        tool: 'createShape',
        arguments: { width: 300, height: 200 },
      },
      {
        id: 'center',
        label: 'center',
        tool: 'placeAtCompositionCenter',
        arguments: {
          layerId: { kind: 'stepResult', stepId: 'create', output: 'layerId' },
        },
      },
    ],
  };
  const results = [];
  for (const structured of [false, true]) {
    const fixture = {
      choices: [
        {
          message: structured
            ? {
                content: JSON.stringify({
                  toolCalls: [{ name: 'submitPlan', arguments: plan }],
                }),
              }
            : {
                tool_calls: [
                  {
                    id: 'call',
                    type: 'function',
                    function: {
                      name: 'submitPlan',
                      arguments: JSON.stringify(plan),
                    },
                  },
                ],
              },
          finish_reason: 'stop',
        },
      ],
    };
    const provider = new OpenAICompatibleProvider(
      {
        ...config,
        id: crypto.randomUUID(),
        baseUrl: structured
          ? 'https://provider-b.example/v1'
          : 'https://provider-a.example/v1',
      },
      credentials,
      async () => new Response(JSON.stringify(fixture)),
    );
    const response = await provider.chat({
      ...request,
      ...(structured ? { responseMode: 'structured-plan' as const } : {}),
    });
    const actual = response.toolCalls[0]!.arguments as typeof plan;
    const host = new CommandSystem(createDefaultProject()),
      registry = registerSemanticActions(
        registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
      ),
      tx = new AgentTransaction(host, registry, host.getSnapshot(), {
        time: 0,
        selection: [],
      });
    registry.validatePlan(actual, undefined, {
      project: host.getSnapshot(),
      time: 0,
      selection: [],
    });
    for (const step of actual.steps)
      await tx.execute(
        step.tool,
        step.arguments,
        new AbortController().signal,
        step.id,
      );
    const commands = tx.evidence().commands.map((c) => c.type);
    tx.commit('fixture');
    const l = activeComposition(host.getSnapshot()).layers[0]!;
    results.push({
      commands,
      type: l.type,
      width: l.width,
      height: l.height,
      position: l.transform.position.baseValue,
      undo: host.undoStack.length,
    });
  }
  expect(results[0]).toEqual(results[1]);
  expect(results[0]!.position).toEqual({ x: 960, y: 540 });
});
it('duplicate provider call identities are rejected before planning', async () => {
  const call = {
    id: 'duplicate',
    type: 'function',
    function: { name: 'submitPlan', arguments: '{}' },
  };
  const p = new OpenAICompatibleProvider(
    config,
    credentials,
    async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: { tool_calls: [call, call] },
              finish_reason: 'tool_calls',
            },
          ],
        }),
      ),
  );
  await expect(p.chat(request)).rejects.toMatchObject({
    details: { kind: 'protocol', incomplete: false },
  });
});
