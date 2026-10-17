import type { EditorStore } from './editor-store';
import type { AIProviderManager } from '../ai/provider-manager';
import type { AgentOrchestrator } from '../agent/orchestrator';
import { AgentSnapshotRenderer } from '../agent/vision';
import {
  createProviderCoreV2,
  exportCoreV2Diagnostic,
} from '../agent-v2/provider-session';
import { NativeSkillRegistry } from '../agent/native-skill-runtime';
import { ConversationSession } from '../agent-v2/session';
import { activeComposition } from '../core/project-model';
import { problem } from '../agent-v2/errors';
import type { TaskRuntime } from '../agent-v2/runtime';
import {
  agentRuntimeChoice,
  chooseAgentRuntime,
} from './agent-runtime-selection';

/** Editor integration only. TaskRuntime owns execution; Session owns committed reference metadata. */
export class CoreV2EditorController {
  session: ConversationSession;
  runtime: TaskRuntime | null = null;
  error = '';
  editMode: 'review' | 'direct' = 'review';
  reviewReason = '';
  lastOperation = '';
  private request = '';
  private turnId = '';
  private starting = false;
  private committing = false;
  private revision = 0;
  private listeners = new Set<() => void>();
  private route: { provider: string; model: string; mode: string } | undefined;
  // Completed-turn diagnostics only; TaskRuntime remains the sole execution state.
  private turnReports = new Map<string, unknown>();
  private observedProject;
  private observedSelection: string;
  constructor(
    readonly store: EditorStore,
    readonly manager: AIProviderManager,
    readonly legacy: AgentOrchestrator,
  ) {
    this.observedProject = store.commands.getSnapshot();
    this.observedSelection = JSON.stringify(store.getSnapshot().selection);
    this.session = new ConversationSession(this.observedProject);
    store.subscribe(() => {
      const project = store.commands.getSnapshot(),
        selected = JSON.stringify(store.getSnapshot().selection);
      if (
        project === this.observedProject &&
        selected === this.observedSelection
      )
        return;
      if (!this.committing && (this.running || this.pending)) {
        this.runtime?.cancel();
        this.error = '正式工程、合成或选区已变化；草稿已停止，用户修改已保留。';
      }
      this.session.observe(
        project,
        store.commands.undoStack.at(-1)?.transaction.source === 'human',
      );
      if (project.id !== this.observedProject.id) this.turnReports.clear();
      this.observedProject = project;
      this.observedSelection = selected;
      this.emit();
    });
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getRevision = () => this.revision;
  private emit() {
    this.revision++;
    this.listeners.forEach((f) => f());
  }
  private rememberTurn() {
    if (!this.state) return;
    this.turnReports.set(this.state.id, {
      turnId: this.turnId,
      ...JSON.parse(exportCoreV2Diagnostic(this.state, this.route)).task,
    });
    if (this.turnReports.size > 100)
      this.turnReports.delete(this.turnReports.keys().next().value!);
  }
  get state() {
    return this.runtime?.getSnapshot() ?? null;
  }
  get running() {
    return (
      this.starting ||
      (!!this.state &&
        ['IDLE', 'PLANNING', 'EXECUTING', 'RECOVERING', 'VERIFYING'].includes(
          this.state.phase,
        ))
    );
  }
  get pending() {
    return this.state?.phase === 'AWAITING_ACCEPTANCE';
  }
  select(choice: 'legacy-v1' | 'core-v2') {
    if (
      this.legacy.running ||
      this.legacy.getSnapshot().pendingConfirmation ||
      this.running
    )
      throw problem('COMMAND_REJECTION', '请先停止当前任务或处理待接受方案');
    if (this.pending) this.reject();
    chooseAgentRuntime(this.store, choice);
    this.emit();
  }
  setEditMode(mode: 'review' | 'direct') {
    if (this.running || this.pending)
      throw problem('COMMAND_REJECTION', '请先结束当前任务');
    this.editMode = mode;
    this.emit();
  }
  skillId = 'auto';
  async run(
    request: string,
    reference?: {
      projectId: string;
      compositionId: string;
      layerIds: readonly string[];
    },
  ) {
    if (agentRuntimeChoice(this.store) !== 'core-v2')
      throw problem('AUTHORIZATION_REQUIRED', '请明确选择Agent Core V2 Beta');
    if (
      this.running ||
      this.pending ||
      this.legacy.running ||
      this.legacy.getSnapshot().pendingConfirmation
    )
      throw problem(
        'COMMAND_REJECTION',
        '当前任务尚未结束，不能重复发送或启动两个引擎',
      );
    this.starting = true;
    this.error = '';
    this.reviewReason = '';
    this.lastOperation = '';
    this.rememberTurn();
    this.runtime = null;
    this.route = undefined;
    this.request = request;
    this.session.turn++;
    this.turnId = crypto.randomUUID();
    this.emit();
    let ticker: ReturnType<typeof setInterval> | undefined;
    try {
      if (!request.trim() || request.length > 4000)
        throw problem('INVALID_ARGUMENTS', '请输入1～4000字符的请求');
      this.store.cancelDrag();
      this.store.setPlaying(false);
      const project = this.store.commands.getSnapshot(),
        c = activeComposition(project),
        selection = this.store.getSnapshot().selection;
      if (
        reference &&
        (reference.projectId !== project.id || reference.compositionId !== c.id)
      )
        throw problem('STALE_BASE', '引用的工程或合成已变化，请重新选择图层');
      this.session.observe(project, false);
      if (
        /^(?:请)?(?:把)?(?:刚才|刚刚|上一轮)(?:的)?(?:修改|操作)?撤销[。.!！]?$|^(?:请)?撤销(?:刚才|刚刚|上一轮)(?:的)?(?:修改|操作)[。.!！]?$/.test(
          request.trim(),
        )
      ) {
        const last = this.session.lastAccepted;
        if (
          !last ||
          this.store.commands.undoStack.at(-1)?.transaction.id !==
            last.transactionId
        )
          throw problem(
            'INVALID_REFERENCE',
            '上一轮事务与当前历史不一致，请使用全局撤销',
          );
        this.committing = true;
        try {
          const beforeUndo = this.store.commands.getSnapshot();
          this.store.undo();
          if (
            this.store.commands.getSnapshot() === beforeUndo ||
            this.store.commands.undoStack.at(-1)?.transaction.id ===
              last.transactionId
          )
            throw problem(
              'COMMAND_REJECTION',
              '原生 Undo 未完成，历史引用已保留',
            );
          this.session.lastAccepted = null;
          this.lastOperation = '已通过原生 Undo 撤销上一轮修改';
        } finally {
          this.committing = false;
        }
        return;
      }
      const undoAnimation =
          /撤销.*(?:动画|关键帧).*(?:保留|渐变)|移除上一轮动画/.test(request),
        last = this.session.lastAccepted;
      if (
        undoAnimation &&
        (!last?.animation.length ||
          this.store.commands.undoStack.at(-1)?.transaction.id !==
            last.transactionId)
      )
        throw problem(
          'INVALID_REFERENCE',
          '上一轮动画与当前历史不一致；请使用全局撤销或明确选择动画属性，不能盲目撤销',
        );
      const scope = undoAnimation
        ? {
            ids: [...new Set(last!.animation.map((a) => a.layerId))],
            allowCreate: false,
          }
        : this.session.resolveRequest(
            request,
            project,
            selection,
            reference?.layerIds,
          );
      scope.ids.forEach((id) => this.session.validate(id, project));
      const selectedSkill =
        this.skillId === 'auto' ||
        this.manager.getSnapshot().settings.agent.nativeSkills === false
          ? undefined
          : new NativeSkillRegistry().load(
              this.skillId,
              this.manager.getSnapshot().settings.agent.disabledNativeSkills,
            );
      const binding = createProviderCoreV2({
        isolatedProject: false,
        betaOptIn: true,
        host: this.store.commands,
        manager: this.manager,
        mode:
          this.manager.getSnapshot().settings.agent.planTransport ?? 'tools',
        scope: {
          compositionId: c.id,
          existingLayerIds: scope.ids,
          allowCreate: scope.allowCreate,
        },
        selection,
        time: this.store.getSnapshot().time,
        renderer: async (p, time, signal) => {
          const result = await new AgentSnapshotRenderer().render(
            p,
            time,
            signal,
            undefined,
            undefined,
            true,
          );
          return { image: result.image, ...result.pixelEvidence! };
        },
      });
      this.runtime = binding.runtime;
      this.route = binding;
      this.starting = false;
      this.emit();
      ticker = setInterval(() => this.emit(), 80);
      if (undoAnimation) {
        await binding.runtime.run({
          goal: '移除上一轮新增关键帧，保留渐变（新的可撤销事务）',
          actions: last!.animation.map((a, i) => ({
            id: 'remove' + i,
            type: 'deleteKeyframe',
            target: { kind: 'existing', id: a.layerId },
            property: a.property,
            keyframeId: a.keyframeId,
          })),
        });
      } else {
        const context = this.session.context(project, selection);
        // Host-driven READs use V1's native definitions. No hidden model loop or unaccounted requests.
        const nativeContext = {
          project,
          selection,
          time: this.store.getSnapshot().time,
        };
        const signal = new AbortController().signal;
        const read = (name: string, args: unknown) =>
          binding.registry.read(name, args, nativeContext, signal);
        const tree: unknown[] = [];
        for (
          let offset = 0;
          offset < Math.min(c.layers.length, 1000);
          offset += 50
        )
          tree.push(
            await read('listLayers', {
              compositionId: c.id,
              offset,
              limit: 50,
            }),
          );
        const relevantScene = [];
        for (const id of scope.ids)
          relevantScene.push(await read('inspectLayer', { layerId: id }));
        const reads = {
          project: await read('inspectProject', {}),
          canvas: await read('getCanvasInfo', {}),
          selection: await read('inspectSelection', {}),
          currentTime: await read('getCurrentTime', {}),
          sceneTree: tree,
          treeTruncated: c.layers.length > 1000,
          relevantScene,
          ...(/图片|素材|image|asset/i.test(request)
            ? { assets: await read('inspectAssets', {}) }
            : {}),
          ...(/效果|模糊|effect|blur|遮罩|mask/i.test(request)
            ? {
                effects: await Promise.all(
                  scope.ids.map((layerId) =>
                    read('inspectEffects', { layerId }),
                  ),
                ),
              }
            : {}),
        };
        await binding.runtime.planAndRun(request, binding.planner, {
          ...context,
          planningPreference: this.manager.planningPreference(),
          explicitReferences:
            reference?.layerIds.map((id) => {
              const layer = this.session.validate(id, project);
              return { id: layer.id, name: layer.name, type: layer.type };
            }) ?? [],
          // Compiled app-owned guidance only; this never installs tools or changes mutation scope.
          skill: selectedSkill,
          reads,
        });
      }
      if (this.pending && this.editMode === 'direct') {
        const steps = this.state!.steps;
        const ordinary = new Set([
          'createShape',
          'createText',
          'setFill',
          'setProperty',
          'setDimensions',
          'setFont',
          'addKeyframe',
          'modifyKeyframe',
          'deleteKeyframe',
          'addEffect',
        ]);
        const safeNative = new Set([
          'setTextContent',
          'setTextColor',
          'setTextAlignment',
          'setTracking',
          'setLeading',
          'setStroke',
          'renameLayer',
          'setLayerVisibility',
          'setEffectParameter',
          'enableEffect',
          'moveKeyframe',
          'setKeyframeValue',
          'setInterpolation',
          'addKeyframe',
          'deleteKeyframe',
        ]);
        const safe =
          steps.length <= 40 &&
          this.state!.targets.length <= 20 &&
          steps.every(
            (s) =>
              ordinary.has(s.action.type) ||
              (s.action.type === 'editNative' && safeNative.has(s.action.tool)),
          );
        if (!/预览|先看|审阅|preview|review/i.test(request) && safe)
          this.accept();
        else
          this.reviewReason =
            '本轮包含效果移除、素材、结构或较大范围操作，或明确要求预览；请审阅后应用。';
      }
    } catch (e) {
      if (this.state?.phase === 'IDLE') this.runtime?.cancel();
      this.error = e instanceof Error ? e.message : '请求未完成';
      throw e;
    } finally {
      clearInterval(ticker);
      this.starting = false;
      this.rememberTurn();
      this.emit();
    }
  }
  accept() {
    const state = this.state;
    if (!state?.proposalId || !this.pending)
      throw problem('AUTHORIZATION_REQUIRED', '当前没有可接受的方案');
    this.committing = true;
    try {
      const completed = this.runtime!.accept(state.proposalId);
      this.session.accept(
        completed,
        this.store.commands.getSnapshot(),
        this.request,
        this.turnId,
      );
      this.store.setStatus('Agent Core V2：修改已验证并提交');
      this.rememberTurn();
      this.emit();
    } catch (e) {
      this.error = e instanceof Error ? e.message : '提交失败';
      this.emit();
      throw e;
    } finally {
      this.committing = false;
    }
  }
  reject() {
    this.runtime?.discard();
    this.rememberTurn();
    this.emit();
  }
  cancel() {
    this.runtime?.cancel();
    this.rememberTurn();
    this.emit();
  }
  newSession() {
    if (this.running || this.pending)
      throw problem('COMMAND_REJECTION', '请先结束当前任务');
    this.session = new ConversationSession(this.store.commands.getSnapshot());
    this.runtime = null;
    this.turnReports.clear();
    this.error = '';
    this.lastOperation = '';
    this.reviewReason = '';
    this.request = '';
    this.turnId = '';
    this.route = undefined;
    this.emit();
  }
  diagnostic() {
    this.rememberTurn();
    const report = JSON.parse(exportCoreV2Diagnostic(this.state, this.route));
    return JSON.stringify(
      {
        ...report,
        runtime: 'core-v2-capability-unlock',
        editMode: this.editMode,
        isolated: false,
        sessionId: this.session.id,
        turnId: this.turnId,
        projectId: this.store.commands.getSnapshot().id,
        compositionId: this.store.commands.getSnapshot().activeCompositionId,
        selection: this.store.getSnapshot().selection,
        turns: [...this.turnReports.values()],
        inFlightResume: 'NOT SUPPORTED',
      },
      null,
      2,
    );
  }
}
const controllers = new WeakMap<EditorStore, CoreV2EditorController>();
export function coreV2For(
  store: EditorStore,
  manager: AIProviderManager,
  legacy: AgentOrchestrator,
) {
  let controller = controllers.get(store);
  if (!controller) {
    controller = new CoreV2EditorController(store, manager, legacy);
    controllers.set(store, controller);
  }
  return controller;
}
