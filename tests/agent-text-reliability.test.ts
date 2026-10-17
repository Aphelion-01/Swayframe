import { expect, it } from 'vitest';
import { AgentToolRegistry, AgentToolError } from '../src/agent/tool-registry';
import { registerCoreWriteTools } from '../src/agent/write-tools';
import { AgentTransaction } from '../src/agent/transaction';
import { CommandSystem } from '../src/core/command-system';
import {
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import { saveProject, loadProject } from '../src/core/project-io';
const registry = registerCoreWriteTools(new AgentToolRegistry());
it('creates styled Unicode text through the real adapter, preserves atomic Undo/Redo and roundtrip', async () => {
  const host = new CommandSystem(createDefaultProject());
  const base = host.getSnapshot();
  const tx = new AgentTransaction(host, registry, base, {
    time: 0,
    selection: [],
  });
  const signal = new AbortController().signal;
  await tx.execute(
    'createText',
    {
      content: 'Cubic',
      position: { x: 205, y: 142 },
      fontSize: 36,
      fontFamily: 'serif',
      color: { r: 0, g: 0.1, b: 0.1, a: 1 },
      alignment: 'center',
    },
    signal,
  );
  await tx.execute('createText', { content: '立方渐变' }, signal);
  expect(host.getSnapshot()).toBe(base);
  tx.commit('文字测试');
  const p = host.getSnapshot();
  const l = activeComposition(p).layers.find(
    (l) => l.type === 'text' && l.text === 'Cubic',
  )!;
  expect(l).toMatchObject({
    type: 'text',
    fontFamily: 'serif',
    fontSize: 36,
    editor: {
      textAlign: 'center',
      properties: {
        fontSize: { baseValue: 36 },
        fill: { baseValue: [0, 0.1, 0.1, 1] },
      },
    },
    transform: { position: { baseValue: { x: 205, y: 142 } } },
  });
  expect(activeComposition(loadProject(saveProject(p))).layers).toEqual(
    activeComposition(p).layers,
  );
  host.undo();
  expect(host.getSnapshot()).toEqual(base);
  host.redo();
  expect(host.getSnapshot()).toEqual(p);
});
it('returns exact failing fields, original arguments and model schema without silent coercion', () => {
  const args = { content: 22, position: [1, 2], fontSize: -5 };
  try {
    registry.permission('createText', args);
    throw Error('should reject');
  } catch (error) {
    expect(error).toBeInstanceOf(AgentToolError);
    const e = error as AgentToolError;
    expect(e.details?.arguments).toBe(args);
    expect(e.details?.issues.map((i) => i.field)).toEqual(
      expect.arrayContaining(['content', 'position', 'fontSize']),
    );
    expect(e.details?.expectedSchema).toEqual(
      registry.definitions(['createText'])[0]?.parameters,
    );
  }
});

it('postflight rejects a missing created layer instead of reporting a successful tool', () => {
  const project = createDefaultProject();
  const ops = registry.compile(
    'createText',
    { content: 'Cubic' },
    { project, time: 0, selection: [] },
  );
  expect(() => registry.verifyResults(ops, project)).toThrow('结果校验失败');
});

it('repairs an invalid createText plan with structured field feedback through the same real adapter', async () => {
  const { AgentOrchestrator } = await import('../src/agent/orchestrator');
  const { defaultAISettings } = await import('../src/ai/contracts');
  const host = new CommandSystem(createDefaultProject());
  let attempts = 0;
  let feedback = '';
  const context = () => ({
    project: host.getSnapshot(),
    time: 0,
    selection: [],
  });
  const agent = new AgentOrchestrator(
    {
      project: host.getSnapshot,
      context,
      tools: () => registry.definitions(),
      permission: (n, a) => registry.permission(n, a),
      validate: (p) => registry.validatePlan(p, undefined, context()),
      begin: (p) =>
        new AgentTransaction(host, registry, p, { time: 0, selection: [] }),
    },
    {
      chat: async (_t, r) => {
        attempts++;
        feedback = r.messages.at(-1)?.content ?? '';
        return {
          text: '',
          model: 'fixture',
          toolCalls: [
            {
              id: 'plan',
              name: attempts > 1 ? 'repairPlan' : 'submitPlan',
              arguments:
                attempts > 1
                  ? {
                      planId: 'p',
                      stepPatches: [
                        {
                          id: 'text',
                          arguments: { content: 'Cubic', fontSize: 36 },
                        },
                      ],
                    }
                  : {
                      id: 'p',
                      goal: '标题',
                      risk: 'low',
                      steps: [
                        {
                          id: 'text',
                          label: '标题',
                          tool: 'createText',
                          arguments:
                            attempts === 1
                              ? { content: 'Cubic', fontSize: 'large' }
                              : { content: 'Cubic', fontSize: 36 },
                        },
                      ],
                    },
            },
          ],
        };
      },
    },
    defaultAISettings,
  );
  await agent.run('标题');
  expect(attempts).toBe(2);
  expect(feedback).toContain('fontSize');
  expect(agent.getSnapshot().status).toBe('completed');
  expect(agent.getSnapshot().toolCalls.some((t) => t.status === 'failed')).toBe(
    true,
  );
  expect(host.undoStack).toHaveLength(1);
});
