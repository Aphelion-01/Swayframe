import { expect, it, vi } from 'vitest';
import { registerReadTools } from '../src/agent/read-tools';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { CommandSystem } from '../src/core/command-system';
import { AgentOrchestrator } from '../src/agent/orchestrator';
import { defaultAISettings } from '../src/ai/contracts';
import type {
  AgentModelPort,
  AgentRuntimePort,
  AgentPlan,
} from '../src/agent/session';
function fixture() {
  const project = createDefaultProject();
  return {
    ...project,
    compositions: [
      { ...project.compositions[0]!, layers: [createLayer('rectangle')] },
    ],
  };
}
it('12 typed read tools inspect real scene without modifying history and reject unknown/invalid/scoped calls', async () => {
  const registry = registerReadTools(new AgentToolRegistry());
  const commands = new CommandSystem(fixture());
  const project = commands.getSnapshot(),
    c = project.compositions[0]!,
    l = c.layers[0]!;
  const context = { project, time: 0, selection: [l.id] };
  const signal = new AbortController().signal;
  expect(registry.definitions()).toHaveLength(12);
  expect(
    await registry.read('inspectSelection', {}, context, signal),
  ).toMatchObject({ layerIds: [l.id] });
  expect(
    await registry.read(
      'inspectProperty',
      { propertyId: l.transform.position.id },
      context,
      signal,
    ),
  ).toMatchObject({ layerId: l.id, value: l.transform.position.baseValue });
  expect(
    await registry.read('inspectLayer', { layerId: l.id }, context, signal),
  ).toMatchObject({ id: l.id });
  expect(
    await registry.read('inspectGraph', { layerId: l.id }, context, signal),
  ).toHaveProperty('nodes');
  expect(
    await registry.read('inspectAssets', {}, context, signal),
  ).toMatchObject({ total: 0 });
  await expect(
    registry.read('inspectProject', { shell: 'bad' }, context, signal),
  ).rejects.toMatchObject({ code: 'invalid_arguments' });
  await expect(
    registry.read('shell', {}, context, signal),
  ).rejects.toMatchObject({ code: 'unknown_tool' });
  await expect(
    registry.read('inspectSelection', {}, context, signal, ['inspectProject']),
  ).rejects.toMatchObject({ code: 'permission_denied' });
  expect(commands.getSnapshot()).toBe(project);
  expect(commands.undoStack).toHaveLength(0);
});
it('planner consumes structured read tool results before producing a read-only ASSIST plan', async () => {
  const registry = registerReadTools(new AgentToolRegistry()),
    project = fixture();
  const plan: AgentPlan = {
    id: '1',
    goal: 'inspect',
    risk: 'low',
    steps: [
      { id: '1', label: '查看选区', tool: 'inspectSelection', arguments: {} },
    ],
  };
  const context = {
    project,
    time: 0,
    selection: [project.compositions[0]!.layers[0]!.id],
  };
  const model = {
    chat: vi
      .fn<AgentModelPort['chat']>()
      .mockResolvedValueOnce({
        text: '',
        model: 'mock',
        toolCalls: [{ id: 'read1', name: 'inspectSelection', arguments: {} }],
      })
      .mockResolvedValueOnce({
        text: '',
        model: 'mock',
        toolCalls: [{ id: 'plan', name: 'submitPlan', arguments: plan }],
      }),
  };
  const runtime: AgentRuntimePort = {
    project: () => project,
    context: () => ({}),
    tools: () => registry.definitions(),
    readTools: () => registry.definitions(),
    permission: (name, args) => registry.permission(name, args),
    validate: (plan) => registry.validatePlan(plan),
    inspect: (name, args, signal) => registry.read(name, args, context, signal),
    begin: () => {
      throw Error('ASSIST must not begin');
    },
  };
  const settings = defaultAISettings();
  settings.agent.mode = 'ASSIST';
  const agent = new AgentOrchestrator(runtime, model, () => settings);
  await agent.run('查看选区');
  expect(agent.getSnapshot().status).toBe('completed');
  expect(model.chat).toHaveBeenCalledTimes(2);
  expect(
    model.chat.mock.calls[1]![1].messages.find((m) => m.role === 'tool'),
  ).toMatchObject({ toolCallId: 'read1' });
  expect(agent.getSnapshot().toolCalls[0]?.tool).toBe('inspectSelection');
});
