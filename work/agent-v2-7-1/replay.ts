import { readFileSync, writeFileSync } from 'node:fs';
import { OpenAICompatibleProvider } from '@product/ai/openai-provider';
import { ProviderBridge } from '@product/agent-v2/provider';
import { AgentPlanner } from '@product/agent-v2/planner';
import { TaskRuntime } from '@product/agent-v2/runtime';
import { EditorAdapter } from '@product/agent-v2/editor-adapter';
import { AgentToolRegistry } from '@product/agent/tool-registry';
import { registerReadTools } from '@product/agent/read-tools';
import { registerSemanticActions } from '@product/agent/semantic-actions';
import { registerCoreWriteTools, registerAnimationTools } from '@product/agent/write-tools';
import { CommandSystem } from '@product/core/command-system';
import { createDefaultProject, activeComposition } from '@product/core/project-model';
import { saveProject } from '@product/core/project-io';
const results = [];
for (const index of [29, 30]) {
  const call = JSON.parse(readFileSync(`docs/qa/agent-v2-7-1/call-${index}.json`, 'utf8'));
  const config = { id: '00000000-0000-4000-8000-000000000111', name: 'Offline captured response', type: 'openai-compatible' as const, baseUrl: 'https://offline.invalid/v1', enabled: true, defaultModel: 'deepseek-v4-flash', models: [{ id: 'deepseek-v4-flash', name: 'Replay', capabilities: ['text' as const] }] };
  let requests = 0;
  const transport = new OpenAICompatibleProvider(config, async () => ({ apiKey: 'offline-fixture', headers: {} }), async () => { requests++; return new Response(JSON.stringify(call.response)); });
  const planner = new AgentPlanner(new ProviderBridge(transport, config, config.defaultModel, 'tools'));
  const host = new CommandSystem(createDefaultProject());
  const before = saveProject(host.getSnapshot());
  const registry = registerReadTools(registerSemanticActions(registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry()))));
  const adapter = new EditorAdapter(host, registry, { compositionId: host.getSnapshot().activeCompositionId, existingLayerIds: [], allowCreate: true }, []);
  const runtime = new TaskRuntime(adapter, undefined, { recoveries: 0 });
  const state = await runtime.planAndRun(call.body.messages.at(-1).content, planner);
  results.push({ index, origin: 'captured-original-response-offline-replay', state, requests, formalUnchanged: before === saveProject(host.getSnapshot()), undoEntries: host.undoStack.length, draftLayers: activeComposition(adapter.snapshot()).layers.map((l) => ({ id: l.id, type: l.type, ...(l.type === 'text' ? { text: l.text } : {}) })), historicalSemanticAcceptance: index === 30 ? activeComposition(adapter.snapshot()).layers.length === 1 && activeComposition(adapter.snapshot()).layers[0]?.type === 'text' : null });
}
writeFileSync(process.argv[2]!, JSON.stringify(results, null, 2) + '\n');
