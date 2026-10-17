import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../../src/core/project-model';
import { saveProject, loadProject } from '../../src/core/project-io';
import { EditorStore } from '../../src/ui/editor-store';
import { createNativeAgent } from '../../src/ui/native-agent-controller';
import { AIProviderManager } from '../../src/ai/provider-manager';
import { AIError, defaultAISettings } from '../../src/ai/contracts';
import { AgentToolRegistry } from '../../src/agent/tool-registry';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../../src/agent/write-tools';
import { AgentPlanner, validateIntent } from '../../src/agent-v2/planner';
import { ProviderBridge } from '../../src/agent-v2/provider';
import {
  EditorAdapter,
  coreExecutionTools,
} from '../../src/agent-v2/editor-adapter';
import { TaskRuntime } from '../../src/agent-v2/runtime';
import { AgentSnapshotRenderer } from '../../src/agent/vision';
import {
  longTasks,
  verifyLongProject,
} from '../../tests/helpers/agent-v2-long-tasks';
import { installFaults } from '../../tests/helpers/agent-v2-faults';
import { legacyPlan } from '../agent-v2/legacy-plan';
const api = (window as any).bench;
async function main() {
  const live = await api.live(),
    mode = await api.mode(),
    report: any = {
      version: '1.0.2',
      status: mode.replay ? 'OFFLINE REPLAY OF ORIGINAL LIVE L3 RESPONSE; NO NEW PROVIDER REQUEST' : live
        ? 'LIVE PROVIDER'
        : 'OFFLINE FIXTURE WITH REAL NATIVE V1/V2 AND RENDERER',
      rows: [],
      scope:
        'matched 10 WRITE tools plus READ; not full V1 product UX; no images sent; Blur instance only, no nonzero Radius claim',
    };
  try {
    const config = live ? await api.settings() : defaultAISettings(),
      provider = live
        ? config.providers.find(
            (p) =>
              p.enabled &&
              p.baseUrl === 'https://api.deepseek.com' &&
              p.defaultModel === 'deepseek-flash',
          )
        : {
            id: crypto.randomUUID(),
            name: 'OFFLINE FIXTURE',
            type: 'openai-compatible',
            baseUrl: 'http://localhost',
            enabled: true,
            defaultModel: 'fixture',
            models: [
              { id: 'fixture', name: 'fixture', capabilities: ['text'] },
            ],
          };
    if (!provider) throw Error('Existing DeepSeek route unavailable');
    report.provider = { name: provider.name, model: provider.defaultModel };
    const cases = [
      { id: 'L1-V2', index: 0, variant: 'V2', maxRequests: 3 },
      { id: 'L2-V2', index: 1, variant: 'V2', maxRequests: 3 },
      { id: 'L3-V2', index: 2, variant: 'V2', maxRequests: 3 },
      {
        id: 'R-A-V2-L1',
        index: 0,
        variant: 'V2',
        fault: 'stale',
        maxRequests: 1,
      },
      {
        id: 'R-B-V2-L1',
        index: 0,
        variant: 'V2',
        fault: 'arguments',
        maxRequests: 3,
      },
      { id: 'L1-V1-matched', index: 0, variant: 'V1', maxRequests: 3 },
      { id: 'L2-V1-matched', index: 1, variant: 'V1', maxRequests: 3 },
    ];
    for (const test of cases.filter((c) => !(mode.recheck || mode.replay) || c.id === 'L3-V2')) {
      await api.progress((live ? 'LIVE ' : 'OFFLINE ') + test.id);
      const task = longTasks[test.index]!,
        data = new Map(),
        transportRecords: any[] = [],
        started = performance.now();
      let runtime: TaskRuntime | undefined,
        state: any,
        error: string | null = null,
        failureStage = 'planning/execution',
        requests = 0;
      let faults: ReturnType<typeof installFaults> | undefined;
      const settings = {
        ...config,
        providers: [provider],
        defaultProviderId: provider.id,
        routing: {
          general: { providerId: provider.id, modelId: provider.defaultModel },
          planning: { providerId: provider.id, modelId: provider.defaultModel },
          vision: null,
        },
        agent: {
          ...config.agent,
          nativeSkills: false,
          visualVerification: false,
          autoApplySafe: false,
          streaming: false,
          planTransport: 'tools',
          recovery: {
            deterministicRepairs: 2,
            planModelRepairs: 1,
            stepModelRepairs: 1,
            executionModelRepairs: 1,
            planningRequests: 3,
            proposalRequests: 3,
            visualRequests: 0,
            providerRetries: 0,
          },
        },
        privacy: {
          sendReferences: false,
          sendRenderPreview: false,
          saveHistory: false,
        },
        failover: { enabled: false, maxRetries: 0 },
      };
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
          chat: async (p, r, signal) => {
            requests++;
            signal?.throwIfAborted();
            let response: any;
            if (live) {
              const abort = () => {
                void api.cancel();
              };
              signal?.addEventListener('abort', abort, { once: true });
              try {
                response = await api.chat(p.id, r, {
                  id: test.id,
                  maxRequests: test.maxRequests,
                });
              } finally {
                signal?.removeEventListener('abort', abort);
              }
            } else if (mode.replay) {
              if (requests !== 1 || r.toolChoice !== 'submitIntent')
                throw Error('Original live response replay allows no repair or extra planning');
              response = await api.replay();
              response = { ...response, usage: undefined };
            } else {
              const payload =
                test.variant === 'V1'
                  ? legacyPlan(task.intent)
                  : r.toolChoice === 'repairAction'
                    ? runtime!
                        .getSnapshot()
                        .steps.find((s) => s.status === 'RECOVERING')!.action
                    : task.intent;
              response = {
                model: 'fixture',
                text: '',
                toolCalls: [
                  {
                    id: 'fixture',
                    name: r.toolChoice ?? 'submitPlan',
                    arguments: payload,
                  },
                ],
                usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
              };
            }
            transportRecords.push({ request: r, response });
            if (response.benchError)
              throw new AIError(
                response.benchError.code,
                response.benchError.message,
                response.benchError.details,
              );
            if (test.fault && r.toolChoice === 'submitIntent') {
              const intent = validateIntent(response.toolCalls[0]?.arguments),
                a = intent.actions.filter((a) => a.type === 'setFill').at(-1);
              if (!a)
                throw Error(
                  'Required fault target absent; cannot claim recovery',
                );
              faults!.add({
                actionId: a.id,
                mode: test.fault as 'stale' | 'arguments',
                times: 1,
                field: 'color',
                actual: { r: -1, g: 0, b: 0, a: 1 },
              });
            }
            return response;
          },
          listModels: async () => [],
          testConnection: async () => ({ ok: true, message: 'not called' }),
        },
      );
      await manager.initialize();
      let base = createDefaultProject();
      base = {
        ...base,
        compositions: base.compositions.map((c) => ({
          ...c,
          layers: [
            createLayer('rectangle', {
              name: 'Protected',
              width: 100,
              height: 100,
              position: { x: -1000, y: -1000 },
            }),
          ],
        })),
      };
      const store = new EditorStore(base),
        before = saveProject(store.commands.getSnapshot()),
        protectedJSON = JSON.stringify(activeComposition(base).layers[0]);
      const render = async (project, time, signal) => {
        const r = await new AgentSnapshotRenderer().render(
          project,
          time,
          signal,
          undefined,
          undefined,
          true,
        );
        return { image: r.image, ...r.pixelEvidence! };
      };
      try {
        if (test.variant === 'V2') {
          const reg = registerAnimationTools(
              registerCoreWriteTools(new AgentToolRegistry()),
            ),
            adapter = new EditorAdapter(
              store.commands,
              reg,
              {
                compositionId: base.activeCompositionId,
                existingLayerIds: [],
                allowCreate: true,
              },
              [],
              render,
            );
          faults = installFaults(adapter, reg, []);
          const bridge = new ProviderBridge(
              {
                chat: (r, s) =>
                  manager.chat('planning', r, s, undefined, {
                    singleAttempt: true,
                  }),
              },
              provider,
              provider.defaultModel,
              'tools',
            ),
            planner = new AgentPlanner(bridge);
          runtime = new TaskRuntime(
            adapter,
            (a, e, s, c) => planner.repair(a, e, s, c),
            {
              modelRequests: test.maxRequests,
              recoveries: test.fault === 'stale' ? 0 : 2,
            },
            true,
          );
          state = await runtime.planAndRun(task.goal, planner);
          if (state.phase !== 'AWAITING_ACCEPTANCE')
            throw Error(
              state.errors.at(-1)?.code + ': ' + state.errors.at(-1)?.message,
            );
          failureStage = 'independent-goal-verification';
          verifyLongProject(runtime.draftSnapshot(), test.index);
          if (test.fault && faults.events.length !== 1)
            throw Error('Fault did not actually trigger');
          if (saveProject(store.commands.getSnapshot()) !== before)
            throw Error('Pre-accept formal mutation');
          failureStage = 'acceptance';
          runtime.accept(state.proposalId!);
          state = runtime.getSnapshot();
        } else {
          const native = createNativeAgent(store, manager),
            catalog = native.registry.catalog.bind(native.registry);
          native.registry.catalog = () =>
            catalog().filter(
              (t) =>
                t.permission === 'READ' ||
                coreExecutionTools.includes(t.name as any),
            );
          const begin = native.runtime.begin.bind(native.runtime);
          native.runtime.begin = (...args) => {
            const tx = begin(...args),
              execute = tx.execute.bind(tx),
              commit = tx.commit.bind(tx);
            tx.execute = async (name, a, s, id) => {
              if (!coreExecutionTools.includes(name as any))
                throw Error('Matched subset excludes tool');
              const result = await execute(name, a, s, id);
              if (
                JSON.stringify(
                  activeComposition(tx.getSnapshot()).layers.find(
                    (l) => l.name === 'Protected',
                  ),
                ) !== protectedJSON
              )
                throw Error('Protected object mutation');
              return result;
            };
            tx.commit = (label) => {
              verifyLongProject(tx.getSnapshot(), test.index);
              return commit(label);
            };
            return tx;
          };
          await native.agent.run(task.goal);
          state = native.agent.getSnapshot();
          if (state.pendingConfirmation && state.currentPlan) {
            await native.agent.preview(state.currentPlan.id);
            state = native.agent.getSnapshot();
            if (state.pendingConfirmation && state.creationProposal)
              await native.agent.apply(state.currentPlan.id);
          }
          state = native.agent.getSnapshot();
          if (state.status !== 'completed')
            throw Error(state.error ?? state.status);
        }
      } catch (e) {
        error = String(e);
        if (runtime?.getSnapshot().phase === 'AWAITING_ACCEPTANCE')
          runtime.discard();
        state = runtime?.getSnapshot() ?? state;
      }
      const next = store.commands.getSnapshot();
      let goalCorrect = false;
      try {
        goalCorrect = verifyLongProject(next, test.index);
      } catch {}
      const formalProtected =
        JSON.stringify(
          activeComposition(next).layers.find((l) => l.name === 'Protected'),
        ) === protectedJSON;
      const saved = saveProject(next),
        roundTrip = saveProject(loadProject(saved)) === saved,
        commits = store.commands.undoStack.length;
      let undo = false,
        redo = false;
      if (commits) {
        store.commands.undo();
        undo = saveProject(store.commands.getSnapshot()) === before;
        store.commands.redo();
        redo = saveProject(store.commands.getSnapshot()) === saved;
      }
      const frames = [];
      for (const time of [0, 1, 2]) {
        const r = await render(next, time, new AbortController().signal);
        await api.image(`${test.id}-${time}.png`, r.image);
        frames.push({
          time,
          width: r.width,
          height: r.height,
          foregroundPixels: r.foregroundPixels,
        });
      }
      const row = {
        id: test.id,
        variant: test.variant,
        task: task.id,
        label: mode.replay ? 'OFFLINE REPLAY OF REAL RESPONSE' : live ? 'REAL PROVIDER' : 'OFFLINE FIXTURE',
        fault: test.fault ?? null,
        pass:
          !error &&
          goalCorrect &&
          formalProtected &&
          commits === 1 &&
          undo &&
          redo &&
          roundTrip &&
          frames.every((f) => f.foregroundPixels > 0),
        error,
        failureStage: error ? failureStage : null,
        goalCorrect,
        requests,
        completedActions:
          state?.completedActions?.length ?? state?.toolCalls?.length,
        deterministicRecoveries: state?.deterministicRecoveries ?? 0,
        fixtureOrLiveModelRepairs: state?.recoveryAttempts ?? 0,
        faultEvents: faults?.events ?? [],
        commits,
        undo,
        redo,
        roundTrip,
        unexpectedMutation: !formalProtected || (!!error && before !== saved),
        frames,
        durationMs: performance.now() - started,
        usage: manager.getSnapshot().usage.records,
      };
      report.rows.push(row);
      await api.save(
        test.id + '-trace.json',
        JSON.stringify(
          { row, userRequest: task.goal, transportRecords, state, scene: next },
          null,
          2,
        ) + '\n',
      );
      await api.save(test.id + '.swayframe', saved);
      await api.save('progress.json', JSON.stringify(report, null, 2) + '\n');
    }
  } catch (e) {
    report.setupError = String(e);
  }
  await api.done(report);
}
void main();
