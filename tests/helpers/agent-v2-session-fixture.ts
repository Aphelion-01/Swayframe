import { AIProviderManager } from '../../src/ai/provider-manager';
import {
  defaultAISettings,
  type ChatRequest,
  type ChatResponse,
} from '../../src/ai/contracts';
import { EditorStore } from '../../src/ui/editor-store';
import { createDefaultProject } from '../../src/core/project-model';
import { createNativeAgent } from '../../src/ui/native-agent-controller';
import { coreV2For } from '../../src/ui/core-v2-controller';
import type { z } from 'zod';
import type { actionSchema } from '../../src/agent-v2/actions';
import { validateIntent } from '../../src/agent-v2/planner';
type InputAction = z.input<typeof actionSchema>;
export const existing = (id: string) => ({ kind: 'existing' as const, id });
export const result = (actionId: string) => ({
  kind: 'result' as const,
  actionId,
});
export const rgb = (r: number, g: number, b: number) => ({ r, g, b, a: 1 });
export async function sessionFixture() {
  const settings = defaultAISettings(),
    provider = {
      id: crypto.randomUUID(),
      name: 'OFFLINE FIXTURE',
      type: 'openai-compatible' as const,
      baseUrl: 'https://example.invalid',
      enabled: true,
      defaultModel: 'fixture',
      models: [
        { id: 'fixture', name: 'Fixture', capabilities: ['text' as const] },
      ],
    };
  settings.providers = [provider];
  settings.defaultProviderId = provider.id;
  settings.routing.planning = { providerId: provider.id, modelId: 'fixture' };
  settings.agent.nativeSkills = false;
  settings.agent.planTransport = 'tools';
  settings.privacy.saveHistory = false;
  const queued: ((r: ChatRequest) => Promise<ChatResponse>)[] = [],
    calls: ChatRequest[] = [],
    data = new Map<string, unknown>();
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
      chat: async (_p, r, signal) => {
        signal?.throwIfAborted();
        calls.push(r);
        const next = queued.shift();
        if (!next)
          throw Error('Unplanned fixture request; network never allowed');
        return next(r);
      },
      listModels: async () => [],
      testConnection: async () => ({ ok: true, message: 'offline' }),
    },
  );
  await manager.initialize();
  const store = new EditorStore(createDefaultProject()),
    native = createNativeAgent(store, manager),
    core = coreV2For(store, manager, native.agent);
  core.select('core-v2');
  const enqueue = (actions: InputAction[], goal = 'offline session fixture') =>
    queued.push(async () => ({
      model: 'fixture',
      text: '',
      toolCalls: [
        {
          id: 'fixture',
          name: 'submitIntent',
          arguments: validateIntent({ goal, actions }),
        },
      ],
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    }));
  const turn = async (request: string, actions: InputAction[]) => {
    enqueue(actions);
    await core.run(request);
    if (!core.pending) throw Error(JSON.stringify(core.state?.errors));
    core.accept();
  };
  return { core, store, native, manager, calls, queued, enqueue, turn };
}
