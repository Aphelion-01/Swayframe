import { afterAll, expect, it } from 'vitest';
import fs from 'node:fs';
import { CommandSystem } from '../src/core/command-system';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
import { saveProject, loadProject } from '../src/core/project-io';
import { contentHash } from '../src/core/content-hash';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import {
  registerAnimationTools,
  registerCoreWriteTools,
} from '../src/agent/write-tools';
import { EditorAdapter } from '../src/agent-v2/editor-adapter';
import { TaskRuntime } from '../src/agent-v2/runtime';
import { longTasks, verifyLongProject } from './helpers/agent-v2-long-tasks';
import { installFaults } from './helpers/agent-v2-faults';
const records: unknown[] = [];
it('long model goal survives acceptance while the shared history label remains bounded', async () => {
  const base = createDefaultProject(),
    host = new CommandSystem(base),
    registry = registerAnimationTools(
      registerCoreWriteTools(new AgentToolRegistry()),
    ),
    adapter = new EditorAdapter(
      host,
      registry,
      {
        compositionId: base.activeCompositionId,
        existingLayerIds: [],
        allowCreate: true,
      },
      [],
    ),
    runtime = new TaskRuntime(adapter),
    goal = '完整任务描述🎬'.repeat(100),
    state = await runtime.run({ ...longTasks[2]!.intent, goal });
  expect(state.phase).toBe('AWAITING_ACCEPTANCE');
  expect(host.getSnapshot()).toEqual(base);
  runtime.accept(state.proposalId!);
  expect(runtime.getSnapshot().goal).toBe(goal);
  expect(runtime.getSnapshot().phase).toBe('COMPLETED');
  expect(host.undoStack).toHaveLength(1);
  expect(host.undoStack[0]!.transaction.label.length).toBeLessThanOrEqual(300);
  expect(verifyLongProject(host.getSnapshot(), 2)).toBe(true);
  const saved = saveProject(host.getSnapshot());
  expect(saveProject(loadProject(saved))).toBe(saved);
  host.undo();
  expect(host.getSnapshot()).toEqual(base);
  host.redo();
  expect(saveProject(host.getSnapshot())).toBe(saved);
});
afterAll(() => {
  fs.mkdirSync('outputs/agent-v2-6', { recursive: true });
  fs.writeFileSync(
    'outputs/agent-v2-6/long-horizon-offline.json',
    JSON.stringify(
      {
        status:
          'OFFLINE VERIFIED ONLY; 60 repetitions of three fixed tasks, not independent LLM samples; Renderer verified separately in Electron',
        rows: records,
      },
      null,
      2,
    ) + '\n',
  );
});
it.each(longTasks)(
  '$id: 20 repetitions preserve latest draft, references, late recovery and undo',
  async ({ id, intent }) => {
    // Retrieve the stable fixture index by identity.
    const index = longTasks.findIndex((t) => t.id === id);
    for (let repeat = 0; repeat < 20; repeat++) {
      let base = createDefaultProject();
      base = {
        ...base,
        compositions: base.compositions.map((c) => ({
          ...c,
          layers: [
            createLayer('rectangle', {
              name: 'Protected',
              position: { x: -1000, y: -1000 },
            }),
          ],
        })),
      };
      const host = new CommandSystem(base),
        registry = registerAnimationTools(
          registerCoreWriteTools(new AgentToolRegistry()),
        ),
        adapter = new EditorAdapter(
          host,
          registry,
          {
            compositionId: base.activeCompositionId,
            existingLayerIds: [],
            allowCreate: true,
          },
          [],
        );
      const last = intent.actions.at(-1)!,
        mode =
          repeat % 3 === 1 ? 'stale' : repeat % 3 === 2 ? 'arguments' : null;
      const faults = installFaults(
        adapter,
        registry,
        mode
          ? [
              {
                actionId: last.id,
                mode,
                times: 1,
                field: last.type === 'setFill' ? 'color' : 'value',
                actual:
                  last.type === 'setFill' ? { r: -1, g: 0, b: 0, a: 1 } : 3,
              },
            ]
          : [],
      );
      let fixtureRepair = 0;
      const runtime = new TaskRuntime(adapter, async (a) => {
        fixtureRepair++;
        return { action: a, usage: { inputTokens: 10, outputTokens: 10 } };
      });
      const execute = adapter.execute.bind(adapter);
      let reads = 0;
      adapter.execute = async (a, t, k, s) => {
        const state = runtime.getSnapshot();
        expect(state.sceneVersion).toBe(contentHash(adapter.snapshot()));
        expect(state.references).toEqual(
          Object.fromEntries(
            state.steps
              .filter((step) => step.status === 'SUCCEEDED')
              .map((step) => [step.action.id, step.result]),
          ),
        );
        if (t) {
          adapter.inspectLayer(t);
          reads++;
        }
        return execute(a, t, k, s);
      };
      const state = await runtime.run(intent);
      expect(state.phase).toBe('AWAITING_ACCEPTANCE');
      expect(state.completedActions).toHaveLength(intent.actions.length);
      expect(verifyLongProject(runtime.draftSnapshot(), index)).toBe(true);
      expect(state.sceneVersion).toBe(contentHash(runtime.draftSnapshot()));
      expect(state.pendingActions).toHaveLength(0);
      expect(reads).toBeGreaterThan(5);
      expect(faults.events.length).toBe(mode ? 1 : 0);
      expect(
        state.steps
          .filter((step) =>
            ['createShape', 'createText', 'addEffect', 'addKeyframe'].includes(
              step.action.type,
            ),
          )
          .every((step) => step.attempts === 1),
      ).toBe(true);
      expect(
        activeComposition(runtime.draftSnapshot()).layers[0]!.id,
      ).not.toBeUndefined();
      expect(host.getSnapshot()).toEqual(base);
      runtime.accept(state.proposalId!);
      expect(host.undoStack).toHaveLength(1);
      expect(verifyLongProject(host.getSnapshot(), index)).toBe(true);
      const saved = saveProject(host.getSnapshot());
      expect(saveProject(loadProject(saved))).toBe(saved);
      host.undo();
      expect(host.getSnapshot()).toEqual(base);
      host.redo();
      expect(saveProject(host.getSnapshot())).toBe(saved);
      expect(
        JSON.stringify(
          activeComposition(host.getSnapshot()).layers.find(
            (l) => l.name === 'Protected',
          ),
        ),
      ).toBe(JSON.stringify(activeComposition(base).layers[0]));
      records.push({
        id,
        repeat,
        actions: intent.actions.length,
        phase: runtime.getSnapshot().phase,
        completed: state.completedActions.length,
        readWriteObservations: reads,
        faults: faults.events,
        deterministicRecoveries: state.deterministicRecoveries,
        fixtureModelRepairs: fixtureRepair,
        commits: host.undoStack.length,
        undo: true,
        redo: true,
        serialization: true,
        unexpectedMutations: 0,
        sceneVersion: state.sceneVersion,
      });
    }
  },
);
