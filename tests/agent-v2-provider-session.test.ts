import { expect, it, vi } from 'vitest';
import { AIProviderManager } from '../src/ai/provider-manager';
import { AIError, defaultAISettings } from '../src/ai/contracts';
import type { AITransport } from '../src/ai/contracts';
import { CommandSystem } from '../src/core/command-system';
import {
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import {
  createProviderCoreV2,
  exportCoreV2Diagnostic,
} from '../src/agent-v2/provider-session';
import {
  creationAndFillExample,
  validateIntent,
} from '../src/agent-v2/planner';
import { ProviderBridge } from '../src/agent-v2/provider';
import { modelUnavailableMessage } from '../src/ai/provider-diagnostics';
const provider = {
  id: crypto.randomUUID(),
  name: 'Fixture (offline)',
  type: 'openai-compatible' as const,
  baseUrl: 'https://example.invalid',
  enabled: true,
  defaultModel: 'fixture',
  models: [{ id: 'fixture', name: 'Fixture', capabilities: ['text' as const] }],
};
const intent = {
  goal: 'Private goal',
  actions: [{ id: 'text', type: 'createText', content: 'Private content' }],
};
async function setup(chat: AITransport['chat']) {
  const settings = defaultAISettings();
  settings.providers = [provider];
  settings.defaultProviderId = provider.id;
  // Deliberately incompatible V1 settings and retries to catch accidental protocol override.
  settings.agent.planTransport = 'structured-plan';
  settings.failover = { enabled: true, maxRetries: 2 };
  const records = new Map();
  const manager = new AIProviderManager(
    {
      loadSettings: async () => settings,
      saveSettings: async () => {},
      setCredentials: async () => {},
      removeCredentials: async () => {},
      hasCredentials: async () => true,
      storageStatus: async () => 'memory-only',
      readData: async (key) => records.get(key),
      writeData: async (key, value) => {
        records.set(key, value);
      },
    },
    {
      chat,
      listModels: async () => [],
      testConnection: async () => ({ ok: true, message: 'offline' }),
    },
  );
  await manager.initialize();
  const host = new CommandSystem(createDefaultProject());
  const make = (mode: 'tools' | 'structured-plan' = 'tools') =>
    createProviderCoreV2({
      isolatedProject: true,
      host,
      manager,
      mode,
      scope: {
        compositionId: host.getSnapshot().activeCompositionId,
        existingLayerIds: [],
        allowCreate: true,
      },
      renderer: async () => ({
        image: 'data:image/png;base64,YQ==',
        width: 10,
        height: 10,
        foregroundPixels: 2,
      }),
    });
  return { manager, host, make, records };
}
it('uses the explicit V2 protocol, actual object binding, pending proposal and manager accounting', async () => {
  const chat = vi.fn<AITransport['chat']>(async (_p, request) => ({
    model: 'fixture',
    text: '',
    toolCalls: [{ id: '1', name: request.toolChoice!, arguments: intent }],
    usage: { inputTokens: 7, outputTokens: 8, totalTokens: 15 },
  }));
  const { host, make, records } = await setup(chat);
  const { runtime, planner } = make();
  const state = await runtime.planAndRun('Private input', planner);
  expect(chat.mock.calls[0]![1].maxOutputTokens).toBe(6000);
  expect(chat.mock.calls[0]![1].responseMode).toBe('tools');
  expect(state.phase).toBe('AWAITING_ACCEPTANCE');
  expect(activeComposition(host.getSnapshot()).layers).toHaveLength(0);
  expect(state.references.text?.layerId).toBeTruthy();
  expect(records.get('usage')).toBeTruthy();
  runtime.accept(state.proposalId!);
  expect(activeComposition(host.getSnapshot()).layers[0]?.id).toBe(
    state.references.text?.layerId,
  );
  expect(host.undoStack).toHaveLength(1);
  host.undo();
  expect(activeComposition(host.getSnapshot()).layers).toHaveLength(0);
  host.redo();
  expect(activeComposition(host.getSnapshot()).layers).toHaveLength(1);
  const snapshot = runtime.getSnapshot();
  snapshot.steps[0]!.resolvedArguments = {
    content: 'Private body',
    apiKey: 'Private key',
  };
  const diagnostic = exportCoreV2Diagnostic(snapshot, {
    provider: 'Fixture',
    model: 'fixture',
    mode: 'tools',
    runtime,
    credential: 'Private credential',
  } as { provider: string; model: string; mode: string });
  const decoded = JSON.parse(diagnostic);
  expect(decoded.version).toBe(2);
  expect(decoded.task.requests[0].inputUpper).toBeGreaterThan(0);
  expect(decoded.task.steps[0].attempts).toBe(1);
  expect(decoded.task.draftDisposition).toBe('COMMITTED');
  expect(diagnostic).not.toMatch(/Private|data:image/);
  expect(JSON.parse(diagnostic).task.steps[0].argumentFields).toEqual([
    'content',
    'apiKey',
  ]);
});
it('structured JSON crosses the same formal schema and can be rejected without changes', async () => {
  const { host, make } = await setup(async (_p, request) => {
    expect(request.responseMode).toBe('structured-plan');
    expect(request.tools).toBeUndefined();
    return { model: 'fixture', text: JSON.stringify(intent), toolCalls: [] };
  });
  const { runtime, planner } = make('structured-plan');
  expect((await runtime.planAndRun('title', planner)).phase).toBe(
    'AWAITING_ACCEPTANCE',
  );
  runtime.discard();
  expect(activeComposition(host.getSnapshot()).layers).toHaveLength(0);
  expect(host.undoStack).toHaveLength(0);
});
it('a network failure gets one audited same-provider retry, never failover or protocol change', async () => {
  const chat = vi.fn<AITransport['chat']>(async () => {
    throw new AIError('network', 'offline network failure');
  });
  const { host, make } = await setup(chat);
  const { runtime, planner } = make();
  const result = await runtime.planAndRun('title', planner);
  expect(chat).toHaveBeenCalledTimes(2);
  expect(result.providerRetries).toBe(1);
  expect(result.modelRequests).toBe(2);
  expect(result.errors[0]?.code).toBe('PROVIDER_TRANSIENT_FAILURE');
  expect(host.undoStack).toHaveLength(0);
});
it('a missing model reported as 503 is actionable and non-recoverable, with no failover or Scene mutation', async () => {
  const chat = vi.fn<AITransport['chat']>(async () => {
    throw new AIError('invalid_request', modelUnavailableMessage, {
      kind: 'http',
      status: 503,
      code: 'model_not_found',
    });
  });
  const { host, make } = await setup(chat);
  const { runtime, planner } = make();
  const result = await runtime.planAndRun('create a title', planner);
  expect(result.phase).toBe('FAILED');
  expect(result.errors[0]).toMatchObject({
    code: 'PROVIDER_RESPONSE',
    message: modelUnavailableMessage,
    recoverable: false,
    strategy: 'NONE',
  });
  expect(result.providerRetries).toBe(0);
  expect(result.recoveryAttempts).toBe(0);
  expect(chat).toHaveBeenCalledTimes(1);
  expect(host.undoStack).toHaveLength(0);
  expect(activeComposition(host.getSnapshot()).layers).toHaveLength(0);
});
it('pins the selected provider/model and rejects configuration changes before request', async () => {
  const chat = vi.fn<AITransport['chat']>();
  const { manager, make } = await setup(chat);
  const { runtime, planner } = make();
  await manager.update((s) => ({
    ...s,
    providers: s.providers.map((p) => ({ ...p, defaultModel: 'changed' })),
  }));
  expect((await runtime.planAndRun('title', planner)).phase).toBe('FAILED');
  expect(chat).not.toHaveBeenCalled();
});
it.each([
  'broken JSON',
  JSON.stringify({ ...intent, scene: {} }),
  JSON.stringify({
    goal: 'bad',
    actions: [
      {
        id: 'a',
        type: 'createShape',
        shape: 'rectangle',
        layerId: crypto.randomUUID(),
      },
    ],
  }),
])(
  'rejects invalid provider text and preserves formal Scene: %s',
  async (text) => {
    const { host, make } = await setup(async () => ({
      model: 'fixture',
      text,
      toolCalls: [],
    }));
    const { runtime, planner } = make('structured-plan');
    expect((await runtime.planAndRun('title', planner)).phase).toBe('FAILED');
    expect(host.undoStack).toHaveLength(0);
    expect(activeComposition(host.getSnapshot()).layers).toHaveLength(0);
  },
);
it('does not reinterpret plain text as Tool Calling or accept multiple intent calls', async () => {
  const { manager } = await setup(async () => ({
    model: 'fixture',
    text: JSON.stringify(intent),
    toolCalls: [],
  }));
  const bridge = new ProviderBridge(
    {
      chat: (request, signal) =>
        manager.chat('planning', request, signal, undefined, {
          singleAttempt: true,
        }),
    },
    provider,
    'fixture',
    'tools',
  );
  await expect(
    bridge.request(
      { messages: [{ role: 'user', content: 'title' }] },
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ diagnostic: { code: 'PROVIDER_RESPONSE' } });
});

it('plans with one semantic parameter contract, live registry availability and explicit text/fill guidance', async () => {
  const chat = vi.fn<AITransport['chat']>(async (_p, request) => ({
    model: 'fixture',
    text: '',
    toolCalls: [{ id: '1', name: request.toolChoice!, arguments: intent }],
    usage: { inputTokens: 7, outputTokens: 8, totalTokens: 15 },
  }));
  const { host, make } = await setup(chat);
  const { runtime, planner } = make();
  const state = await runtime.planAndRun('Create actual text', planner);
  const request = chat.mock.calls[0]![1],
    system = request.messages[0]!.content;
  const metadata = JSON.parse(system.split('\n').at(-1)!);
  expect(metadata.capabilities.length).toBeGreaterThan(0);
  expect(
    metadata.capabilities.every(
      (c: Record<string, unknown>) =>
        typeof c.name === 'string' &&
        c.available === true &&
        'parameters' in c &&
        'outputSchema' in c,
    ),
  ).toBe(true);
  expect(system).toContain('Never substitute shapes for text');
  expect(system).toContain('authoritative flat [offset,r,g,b,a,...]');
  expect(request.tools?.[0]?.parameters).toHaveProperty('properties.actions');
  expect(state.phase).toBe('AWAITING_ACCEPTANCE');
  expect(activeComposition(host.getSnapshot()).layers).toHaveLength(0);
  runtime.accept(state.proposalId!);
  expect(activeComposition(host.getSnapshot()).layers[0]?.type).toBe('text');
});

it('creation/style format example satisfies the real intent contract and never executes instead of the current goal', async () => {
  expect(validateIntent(creationAndFillExample)).toEqual(
    creationAndFillExample,
  );
  const chat = vi.fn<AITransport['chat']>(async (_p, request) => ({
    model: 'fixture',
    text: '',
    toolCalls: [{ id: '1', name: request.toolChoice!, arguments: intent }],
  }));
  const { host, make } = await setup(chat);
  const { runtime, planner } = make();
  const state = await runtime.planAndRun('Current text goal', planner);
  const req = chat.mock.calls[0]![1],
    metadata = JSON.parse(req.messages[0]!.content.split('\n').at(-1)!);
  expect(req.messages.at(-1)!.content).toBe('Current text goal');
  expect(metadata.exampleIntent).toEqual(creationAndFillExample);
  expect(activeComposition(host.getSnapshot()).layers).toHaveLength(0);
  runtime.accept(state.proposalId!);
  const ls = activeComposition(host.getSnapshot()).layers;
  expect(ls).toHaveLength(1);
  expect(ls[0]!.type).toBe('text');
});

it('edit-only planning hides creation while the host independently rejects a malicious creation reply', async () => {
  const chat = vi.fn<AITransport['chat']>(async (_p, request) => ({
    model: 'fixture',
    text: '',
    toolCalls: [{ id: '1', name: request.toolChoice!, arguments: intent }],
  }));
  const { manager, host } = await setup(chat);
  const { runtime, planner } = createProviderCoreV2({
    isolatedProject: true,
    host,
    manager,
    mode: 'tools',
    scope: {
      compositionId: host.getSnapshot().activeCompositionId,
      existingLayerIds: [],
      allowCreate: false,
    },
    renderer: async () => ({
      image: 'data:image/png;base64,YQ==',
      width: 10,
      height: 10,
      foregroundPixels: 2,
    }),
  });
  const state = await runtime.planAndRun('Only edit existing objects', planner);
  const req = chat.mock.calls[0]![1],
    metadata = JSON.parse(req.messages[0]!.content.split('\n').at(-1)!);
  const schema = req.tools![0]!.parameters as {
    properties: {
      actions: {
        items: { oneOf: { properties: { type: { const: string } } }[] };
      };
    };
  };
  const types = schema.properties.actions.items.oneOf.map(
    (s) => s.properties.type.const,
  );
  expect(types).not.toContain('createShape');
  expect(types).not.toContain('createText');
  expect(types).toContain('setFill');
  expect(metadata.exampleIntent).toBeUndefined();
  expect(
    metadata.capabilities
      .filter((c: { name: string; available: boolean }) =>
        ['createRectangle', 'createEllipse', 'createText'].includes(c.name),
      )
      .every(
        (c: { name: string; available: boolean }) => c.available === false,
      ),
  ).toBe(true);
  expect(state.phase).toBe('FAILED');
  expect(state.errors.some((e) => e.code === 'COMMAND_REJECTION')).toBe(true);
  expect(activeComposition(host.getSnapshot()).layers).toHaveLength(0);
  expect(host.undoStack).toHaveLength(0);
});
