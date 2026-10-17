import { coreExecutionTools } from '../../src/agent-v2/editor-adapter';
import { AgentExecutionError } from '../../src/agent/execution-error';
import { AIError, defaultAISettings } from '../../src/ai/contracts';
import { AIProviderManager } from '../../src/ai/provider-manager';
import { createNativeAgent } from '../../src/ui/native-agent-controller';
import { EditorStore } from '../../src/ui/editor-store';
import {
  createDefaultProject,
  activeComposition,
  createLayer,
} from '../../src/core/project-model';
import { saveProject, loadProject } from '../../src/core/project-io';
import { AgentSnapshotRenderer } from '../../src/agent/vision';
import { evaluateProperty } from '../../src/core/animation-engine';
import { createProviderCoreV2 } from '../../src/agent-v2/provider-session';
import { benchmarks } from '../../src/agent-v2/benchmarks';
import { legacyPlan } from '../agent-v2/legacy-plan';
const api = (window as any).bench;
const goals = [
  '仅新建三个矩形，名称分别 Red、Green、Blue，尺寸均200×200，位置分别(650,540)、(960,540)、(1270,540)。分别填充红色RGB(1,0,0)、绿色RGB(0,1,0)、蓝色RGB(0,0,1)。随后将第二个 Green 改为紫色RGB(0.5,0,0.5)。不修改任何已有对象。',
  '仅创建一个文字图层，名称Title，内容Cubic，字体serif，字号96，位置(960,450)，颜色白色RGB(1,1,1)。不修改已有对象。',
  '仅创建一个矩形，名称Gradient，尺寸600×400，位置(960,540)。设置原生径向渐变，中心(0.4,0.6)、半径0.7，色标0处RGBA(0,0.7,0.8,1)，色标1处RGBA(0,0.05,0.15,1)。不修改已有对象。',
  '仅创建一个矩形，名称Animated，尺寸200×200。添加位置关键帧，0秒位置(400,540)，2秒位置(1500,540)，使用线性插值，让它在两秒内移动。不修改已有对象。',
  '仅创建一个矩形，名称Blurred，尺寸200×200，位置(960,540)，并为该图层添加一次Gaussian Blur（gaussianBlur）。本次只添加效果实例，不要求调整Radius，不修改已有对象。',
];
const near = (a, b) => Math.abs(Number(a) - b) < 1e-5;
function checks(project, index) {
  const ls = activeComposition(project).layers.filter(
    (l) => l.name !== 'Protected',
  );
  const fill = (l) => l.editor?.properties.fill?.baseValue;
  const pos = (l, x, y) =>
    near(l?.transform.position.baseValue.x, x) &&
    near(l?.transform.position.baseValue.y, y);
  const col = (l, c) => JSON.stringify(fill(l)) === JSON.stringify(c);
  if (index === 0)
    return (
      ls.length === 3 &&
      ['Red', 'Green', 'Blue'].every((name, i) => {
        const l = ls.find((l) => l.name === name);
        return (
          l?.shapeKind === 'rectangle' &&
          l.width === 200 &&
          l.height === 200 &&
          pos(l, 650 + i * 310, 540) &&
          col(
            l,
            [
              [1, 0, 0, 1],
              [0.5, 0, 0.5, 1],
              [0, 0, 1, 1],
            ][i],
          )
        );
      })
    );
  const l = ls[0];
  if (ls.length !== 1 || !l) return false;
  if (index === 1)
    return (
      l.type === 'text' &&
      l.text === 'Cubic' &&
      l.fontFamily === 'serif' &&
      l.fontSize === 96 &&
      pos(l, 960, 450) &&
      col(l, [1, 1, 1, 1])
    );
  if (index === 2) {
    const p = l.editor?.properties ?? {};
    return (
      l.shapeKind === 'rectangle' &&
      l.width === 600 &&
      l.height === 400 &&
      pos(l, 960, 540) &&
      l.editor?.gradient === 'radial' &&
      JSON.stringify(p.radial_center?.baseValue) ===
        JSON.stringify({ x: 0.4, y: 0.6 }) &&
      near(p.radial_radius?.baseValue, 0.7) &&
      JSON.stringify(p.radial_stops?.baseValue) ===
        JSON.stringify([0, 0, 0.7, 0.8, 1, 1, 0, 0.05, 0.15, 1])
    );
  }
  if (index === 3) {
    const p = l.transform.position,
      mid = evaluateProperty(p, 1);
    return (
      p.keyframes.length === 2 &&
      p.keyframes.some(
        (k) => near(k.time, 0) && near(k.value.x, 400) && near(k.value.y, 540),
      ) &&
      p.keyframes.some(
        (k) => near(k.time, 2) && near(k.value.x, 1500) && near(k.value.y, 540),
      ) &&
      near(mid.x, 950) &&
      near(mid.y, 540)
    );
  }
  return (
    l.editor?.graph?.nodes.filter((n) => n.type === 'gaussianBlur').length === 1
  );
}
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
async function main() {
  const live = await api.mode();
  const matchedRecheck = await api.matchedRecheck();
  const report: any = {
    version: '1.0.1',
    status: live ? 'LIVE_PROVIDER_SAMPLES' : 'OFFLINE_INTEGRATION_ONLY',
    rows: [],
    protocols: {
      tools: live ? 'NOT VERIFIED' : 'OFFLINE VERIFIED',
      structured: live ? 'NOT VERIFIED' : 'OFFLINE VERIFIED',
    },
    advanced: 'NOT IMPLEMENTED in V2',
    blurRadius: 'NOT IMPLEMENTED in V2; instance only, no visual blur claim',
  };
  try {
    let config = live ? await api.settings() : defaultAISettings();
    const provider = live
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
          enabled: true,
          baseUrl: 'http://localhost',
          defaultModel: 'fixture',
          models: [{ id: 'fixture', name: 'Fixture', capabilities: ['text'] }],
        };
    if (!provider) throw Error('Configured DeepSeek deepseek-flash not found');
    if (live && !(await api.has(provider.id)))
      throw Error('Configured credentials unavailable');
    report.provider = {
      name: provider.name,
      baseUrl: provider.baseUrl,
      model: provider.defaultModel,
    };
    report.testSetup = matchedRecheck
      ? 'Supplemental V1 D/E: catalog READ + same nine allowed WRITE tools, actual Native V1; initial results retained'
      : 'Initial: V1 full advertised catalog, test host nine WRITE tools; advertised/executable mismatch limits comparison';
    const cases = matchedRecheck
      ? [
          { index: 3, variant: 'V1', mode: 'tools' },
          { index: 4, variant: 'V1', mode: 'tools' },
        ]
      : [
          ...Array.from({ length: 5 }, (_, index) => [
            { index, variant: 'V2', mode: 'tools' },
            { index, variant: 'V1', mode: 'tools' },
          ]).flat(),
          { index: 0, variant: 'V2', mode: 'structured-plan' },
        ];
    for (const test of cases) {
      const id = `${matchedRecheck ? 'recheck-' : ''}${test.variant}-${test.index + 1}-${test.mode}`;
      await api.progress((live ? 'LIVE ' : 'OFFLINE ') + id);
      let requests = 0,
        scene: any,
        state: any,
        failure: any = null,
        session: any;
      const data = new Map(),
        transportRecords: any[] = [];
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
          planTransport: test.mode,
          recovery: {
            deterministicRepairs: 4,
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
          chat: async (p, r, s) => {
            s?.throwIfAborted();
            requests++;
            let response: any;
            if (live)
              response = await api.chat(p.id, r, {
                caseId: id,
                variant: test.variant,
                mode: test.mode,
                userRequest: goals[test.index],
              });
            else {
              const intent = structuredClone(benchmarks[test.index].intent);
              if (test.index === 2)
                intent.actions[0].position = { x: 960, y: 540 };
              if (test.index === 3) {
                intent.actions[0].width = 200;
                intent.actions[0].height = 200;
                intent.actions = intent.actions.filter(
                  (a) => a.type !== 'modifyKeyframe',
                );
              }
              const payload =
                test.variant === 'V1' ? legacyPlan(intent) : intent;
              response = {
                model: 'fixture',
                toolCalls:
                  test.mode === 'tools'
                    ? [
                        {
                          id: 'fixture',
                          name: r.toolChoice ?? 'submitPlan',
                          arguments: payload,
                        },
                      ]
                    : [],
                text:
                  test.mode === 'structured-plan'
                    ? JSON.stringify(payload)
                    : '',
              };
            }
            transportRecords.push({ request: r, response });
            if (response.benchError)
              throw new AIError(
                response.benchError.code,
                response.benchError.message,
                response.benchError.details,
              );
            s?.throwIfAborted();
            return response;
          },
          listModels: async () => [],
          testConnection: async () => ({ ok: true, message: 'not called' }),
        },
      );
      await manager.initialize();
      const base = createDefaultProject();
      base.compositions = base.compositions.map((c) => ({
        ...c,
        layers: [
          createLayer('rectangle', {
            name: 'Protected',
            width: 100,
            height: 100,
            position: { x: -1000, y: -1000 },
          }),
        ],
      }));
      const host = new EditorStore(base),
        before = host.commands.getSnapshot(),
        started = performance.now();
      let precommitUntouched = false;
      try {
        if (test.variant === 'V2') {
          session = createProviderCoreV2({
            isolatedProject: true,
            host: host.commands,
            manager,
            mode: test.mode as any,
            scope: {
              compositionId: before.activeCompositionId,
              existingLayerIds: [],
              allowCreate: true,
            },
            renderer: render,
          });
          state = await session.runtime.planAndRun(
            goals[test.index],
            session.planner,
          );
          precommitUntouched =
            saveProject(host.commands.getSnapshot()) === saveProject(before);
          if (state.phase !== 'AWAITING_ACCEPTANCE')
            throw Error(
              state.errors.at(-1)?.code + ': ' + state.errors.at(-1)?.message,
            );
          scene = session.runtime.draftSnapshot();
          if (!checks(scene, test.index))
            throw Error('INDEPENDENT_GOAL_CHECK_FAILED');
          session.runtime.accept(state.proposalId);
          state = session.runtime.getSnapshot();
        } else {
          const native = createNativeAgent(host, manager);
          if (matchedRecheck) {
            const catalog = native.registry.catalog.bind(native.registry);
            native.registry.catalog = () =>
              catalog().filter(
                (t) =>
                  t.permission === 'READ' ||
                  coreExecutionTools.includes(t.name as any),
              );
          }
          const begin = native.runtime.begin.bind(native.runtime);
          native.runtime.begin = (...args) => {
            const tx = begin(...args),
              execute = tx.execute.bind(tx),
              commit = tx.commit.bind(tx);
            tx.execute = async (name, args, signal, stepId) => {
              if (!coreExecutionTools.includes(name as any))
                throw new AgentExecutionError({
                  code: 'TOOL_NOT_ALLOWED',
                  phase: 'execute',
                  toolName: name,
                  recoverable: false,
                  message:
                    'Shared baseline permissions exclude this write tool',
                });
              const result = await execute(name, args, signal, stepId);
              const draft = tx.getSnapshot(),
                protectedLayer = activeComposition(before).layers[0];
              if (
                JSON.stringify(
                  activeComposition(draft).layers.find(
                    (l) => l.id === protectedLayer.id,
                  ),
                ) !== JSON.stringify(protectedLayer)
              )
                throw new AgentExecutionError({
                  code: 'PERMISSION_DENIED',
                  phase: 'execute',
                  recoverable: false,
                  message: 'Existing layer mutation forbidden in both arms',
                });
              return result;
            };
            tx.commit = (label) => {
              if (!checks(tx.getSnapshot(), test.index))
                throw new AgentExecutionError({
                  code: 'RESULT_VERIFICATION_FAILED',
                  phase: 'verify',
                  recoverable: false,
                  message: 'Independent goal check failed before acceptance',
                });
              return commit(label);
            };
            return tx;
          };
          await native.agent.run(goals[test.index]);
          session = native;
          state = native.agent.getSnapshot();
          precommitUntouched =
            saveProject(host.commands.getSnapshot()) === saveProject(before);
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
        failure = String(e);
        if (test.variant === 'V2') session?.runtime.discard();
        state =
          test.variant === 'V2'
            ? session?.runtime.getSnapshot()
            : session?.agent.getSnapshot();
      }
      const next = host.commands.getSnapshot(),
        final = saveProject(next),
        old = activeComposition(before).layers[0],
        protectedUnchanged =
          JSON.stringify(old) ===
          JSON.stringify(
            activeComposition(next).layers.find((l) => l.id === old.id),
          );
      const goalCorrect = checks(next, test.index),
        commits = host.commands.undoStack.length;
      const image = await render(
        next,
        test.index === 3 ? 1 : 0,
        new AbortController().signal,
      );
      const roundTrip = saveProject(loadProject(final)) === final;
      let undo = false,
        redo = false;
      if (commits) {
        host.commands.undo();
        undo = saveProject(host.commands.getSnapshot()) === saveProject(before);
        host.commands.redo();
        redo = saveProject(host.commands.getSnapshot()) === final;
      }
      const unexpectedMutation =
        !protectedUnchanged || (!!failure && final !== saveProject(before));
      const errors =
        test.variant === 'V2'
          ? (state?.errors ?? [])
          : [
              ...(state?.executionError ? [state.executionError] : []),
              ...(state?.recoveries ?? []).map((r) => r.error),
              ...(state?.recoveryTrace ?? [])
                .map((r) => r.error)
                .filter(Boolean),
            ];
      const toolValidationFailures = errors.filter((e) =>
          [
            'INVALID_ARGUMENTS',
            'TOOL_ARGUMENT_INVALID',
            'SCHEMA_INVALID',
            'SEMANTIC_INVALID',
          ].includes(e.code),
        ).length,
        objectReferenceFailures = errors.filter((e) =>
          [
            'INVALID_REFERENCE',
            'INVALID_OBJECT_ID',
            'TARGET_NOT_FOUND',
            'OBJECT_REFERENCE_INVALID',
            'STEP_RESULT_UNRESOLVED',
          ].includes(e.code),
        ).length,
        planFailures = errors.filter(
          (e) =>
            e.phase === 'planning' ||
            [
              'PLAN_SCHEMA_INVALID',
              'PLAN_CYCLE_DETECTED',
              'DEPENDENCY_ERROR',
            ].includes(e.code),
        ).length;
      const row = {
        toolValidationFailures,
        objectReferenceFailures,
        planFailures,
        caseId: id,
        task: String.fromCharCode(65 + test.index),
        variant: test.variant,
        mode: test.mode,
        pass:
          !failure &&
          goalCorrect &&
          protectedUnchanged &&
          commits === 1 &&
          undo &&
          redo &&
          roundTrip &&
          image.foregroundPixels > 0,
        goalCorrect,
        precommitUntouched,
        unexpectedMutation,
        requests,
        commits,
        undo,
        redo,
        roundTrip,
        durationMs: performance.now() - started,
        error: failure,
        errors,
        automaticRecovery:
          test.variant === 'V2'
            ? (state?.recoveryAttempts ?? 0)
            : (state?.recoveryTrace?.filter((r) => r.outcome === 'resumed')
                .length ?? 0),
        render: {
          width: image.width,
          height: image.height,
          foregroundPixels: image.foregroundPixels,
        },
        usage: manager.getSnapshot().usage.records,
      };
      report.rows.push(row);
      if (
        live &&
        test.variant === 'V2' &&
        transportRecords.some((r) => !r.response.benchError)
      )
        report.protocols[test.mode === 'tools' ? 'tools' : 'structured'] =
          'LIVE RESPONSE RECEIVED; outcome in row';
      await api.save(
        id + '-trace.json',
        JSON.stringify(
          {
            row,
            provider: report.provider,
            userRequest: goals[test.index],
            transportRecords,
            parsedIntent:
              test.variant === 'V2'
                ? state?.steps.map((s) => s.action)
                : state?.currentPlan,
            validation: state?.verification,
            resolvedObjects:
              test.variant === 'V2'
                ? state?.references
                : state?.trace?.bindings,
            commandExecution: state,
            sceneState: next,
            failureStage:
              errors.at(-1)?.phase ?? (failure ? 'goal-verification' : null),
          },
          null,
          2,
        ),
      );
      await api.save(id + '.swayframe', final);
      await api.saveImage(id + '.png', image.image);
      await api.save('progress.json', JSON.stringify(report, null, 2));
    }
    report.summary = Object.fromEntries(
      ['V1', 'V2'].map((v) => [
        v,
        {
          tasks: report.rows.filter(
            (r) => r.variant === v && r.mode === 'tools',
          ).length,
          passed: report.rows.filter(
            (r) => r.variant === v && r.mode === 'tools' && r.pass,
          ).length,
          unexpectedMutations: report.rows.filter(
            (r) => r.variant === v && r.unexpectedMutation,
          ).length,
        },
      ]),
    );
  } catch (e) {
    report.setupFailure = String(e);
  }
  await api.done(report);
}
void main();
