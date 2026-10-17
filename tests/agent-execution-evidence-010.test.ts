import { it, expect } from 'vitest';
import { CommandSystem } from '../src/core/command-system';
import {
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { AgentTransaction } from '../src/agent/transaction';
import {
  verifyExecutionState,
  verifyPixelEvidence,
  expectsVisibleForeground,
} from '../src/agent/execution-verification';
import {
  workingMemory,
  exportAgentDiagnostic,
} from '../src/agent/working-memory';
const setup = () => {
  const host = new CommandSystem(createDefaultProject());
  const registry = registerAnimationTools(
    registerCoreWriteTools(new AgentToolRegistry()),
  );
  return {
    host,
    registry,
    tx: new AgentTransaction(host, registry, host.getSnapshot(), {
      time: 0,
      selection: [],
    }),
  };
};
it('verifies actual aggregate commands and real object bindings; detects replaced Scene', async () => {
  const { host, registry, tx } = setup(),
    signal = new AbortController().signal;
  await tx.execute('createText', { content: 'Cubic' }, signal, 'text');
  const evidence = tx.evidence();
  const result = verifyExecutionState(
    registry,
    host.getSnapshot(),
    tx.getSnapshot(),
    evidence,
    ['native-scene', 'text-visible'],
  );
  expect(result.command.count).toBeGreaterThan(0);
  expect(evidence.bindings.text!.layerId).toBe(
    activeComposition(tx.getSnapshot()).layers[0]!.id,
  );
  expect(result.visual.status).toBe('NOT_VERIFIED');
  expect(() =>
    verifyExecutionState(
      registry,
      host.getSnapshot(),
      host.getSnapshot(),
      evidence,
    ),
  ).toThrow();
  expect(() =>
    verifyPixelEvidence({ width: 500, height: 300, foregroundPixels: 0 }, true),
  ).toThrow();
  expect(host.undoStack).toHaveLength(0);
});
it('blank checks allow intentional opacity zero and enforce plain visible foreground', async () => {
  const { tx } = setup(),
    s = new AbortController().signal;
  await tx.execute('createRectangle', {}, s, 'shape');
  expect(expectsVisibleForeground(tx.getSnapshot(), 0)).toBe(true);
  await tx.execute(
    'addKeyframe',
    {
      layerId: { kind: 'stepResult', stepId: 'shape', output: 'layerId' },
      property: 'opacity',
      time: 0,
      value: 0,
    },
    s,
    'fade',
  );
  expect(expectsVisibleForeground(tx.getSnapshot(), 0)).toBe(false);
  expect(() =>
    verifyPixelEvidence(
      { width: 500, height: 300, foregroundPixels: 0 },
      false,
    ),
  ).not.toThrow();
});
it('memory tracks actual outputs and terminal recovery; export excludes user goal', async () => {
  const { tx } = setup();
  await tx.execute(
    'createText',
    { content: 'Private words' },
    new AbortController().signal,
    'a',
  );
  const memory = workingMemory(
    tx.getSnapshot(),
    {
      id: 'p',
      goal: 'Private words',
      risk: 'low',
      steps: [
        { id: 'a', label: 'a', tool: 'createText', arguments: {} },
        { id: 'b', label: 'b', tool: 'setFill', arguments: {} },
      ],
    },
    [],
    [
      {
        id: 'a',
        stepId: 'a',
        tool: 'createText',
        label: 'a',
        status: 'failed',
      },
      {
        id: 'a',
        stepId: 'a',
        tool: 'createText',
        label: 'a',
        status: 'completed',
      },
    ],
    tx.evidence(),
    1,
  );
  expect(memory.completedTasks).toEqual(['a']);
  expect(memory.failedTasks).toEqual([]);
  expect(memory.pendingTasks).toEqual(['b']);
  expect(memory.createdObjectReferences.a!.layerId).toMatch(/^[a-f0-9-]{36}$/);
  const exported = exportAgentDiagnostic({
    sessionId: 's',
    status: 'completed',
    workingMemory: memory,
  });
  expect(exported).not.toContain('Private words');
  expect(exported).not.toContain('data:image');
});
it('a real Command draft is discarded before commit when renderer evidence fails', async () => {
  const { host, registry } = setup(),
    base = host.getSnapshot();
  const { AgentOrchestrator } = await import('../src/agent/orchestrator');
  const { defaultAISettings } = await import('../src/ai/contracts');
  const settings = defaultAISettings();
  settings.agent.visualVerification = false;
  settings.agent.autoApplySafe = true;
  const agent = new AgentOrchestrator(
    {
      project: host.getSnapshot,
      context: () => ({}),
      tools: () => registry.definitions(),
      permission: (n, a) => registry.permission(n, a),
      validate: (p) =>
        registry.validatePlan(p, undefined, {
          project: base,
          time: 0,
          selection: [],
        }),
      begin: () =>
        new AgentTransaction(host, registry, base, { time: 0, selection: [] }),
      executionMetadata: () => ({
        skillIds: [],
        selectedCapabilities: ['createText'],
      }),
      verifyExecution: async (b, d, e) => {
        verifyExecutionState(registry, b, d, e);
        verifyPixelEvidence(
          { width: 720, height: 405, foregroundPixels: 0 },
          true,
        );
        throw Error('unreachable');
      },
    },
    {
      chat: async () => ({
        model: 'controlled fixture',
        text: '',
        toolCalls: [
          {
            id: 'call',
            name: 'submitPlan',
            arguments: {
              id: 'p',
              goal: 'text',
              risk: 'low',
              steps: [
                {
                  id: 'a',
                  label: 'text',
                  tool: 'createText',
                  arguments: { content: 'Cubic' },
                },
              ],
            },
          },
        ],
      }),
    },
    () => settings,
  );
  await agent.run('text');
  expect(agent.getSnapshot().status).toBe('failed');
  expect(host.getSnapshot()).toBe(base);
  expect(host.undoStack).toHaveLength(0);
  expect(agent.getSnapshot().trace?.objectBindings.a?.layerId).toBeTruthy();
});
