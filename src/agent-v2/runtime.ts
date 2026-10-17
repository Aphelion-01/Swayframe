import { verifyAction } from './verification';
import { contentHash } from '../core/content-hash';
import { activeComposition } from '../core/project-model';
import type { AgentChangeSet } from '../agent/session';
import type { ObjectOutput } from '../agent/object-reference';
import {
  dependencies,
  type LayerReference,
  type SemanticAction,
  type TaskIntent,
} from './actions';
import { EditorAdapter, type RenderEvidence } from './editor-adapter';
import { problem, normalizeError, type CoreError } from './errors';
import { creationContract, validateIntent, type AgentPlanner } from './planner';
import {
  canRecover,
  deterministicRecovery,
  validateRepair,
  type RepairPort,
} from './recovery';
import type { ChatRequest } from '../ai/contracts';
import { CoreV2Error } from './errors';
export interface ExecutionBudget {
  actions: number;
  recoveries: number;
  modelRequests: number;
  deterministicRecoveries: number;
  providerRetries: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}
export type StepStatus =
  | 'PENDING'
  | 'READY'
  | 'RUNNING'
  | 'RECOVERING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';
export interface TaskState {
  id: string;
  goal: string;
  phase:
    | 'IDLE'
    | 'PLANNING'
    | 'EXECUTING'
    | 'RECOVERING'
    | 'VERIFYING'
    | 'AWAITING_ACCEPTANCE'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED'
    | 'DISCARDED';
  baseVersion: string;
  sceneVersion: string;
  steps: {
    action: SemanticAction;
    status: StepStatus;
    result?: Partial<Record<ObjectOutput, string>>;
    resolvedArguments?: unknown;
    attempts: number;
    recoveryAttempts: number;
    draftVersion: string;
    failure?: CoreError;
  }[];
  references: Record<string, Partial<Record<ObjectOutput, string>>>;
  targets: string[];
  completedActions: string[];
  pendingActions: string[];
  errors: CoreError[];
  recoveryAttempts: number;
  deterministicRecoveries: number;
  providerRetries: number;
  recoveries: {
    actionId: string | null;
    method: string;
    code: string;
    outcome: 'REPAIRED' | 'SUCCEEDED' | 'REJECTED';
    draftVersion: string;
  }[];
  requests: {
    kind: 'planning' | 'repair';
    actionId: string | null;
    inputUpper: number;
    outputUpper: number;
    status: 'PENDING' | 'RECEIVED' | 'FAILED' | 'BLOCKED';
    usage?: { inputTokens: number; outputTokens: number };
  }[];
  draftDisposition:
    'ACTIVE' | 'INSPECTABLE' | 'UNSAFE' | 'DISCARDED' | 'COMMITTED';
  modelRequests: number;
  actionAttempts: number;
  budget: ExecutionBudget;
  verification: ReturnType<EditorAdapter['verify']> | null;
  preview: RenderEvidence | null;
  proposedChanges: ReturnType<EditorAdapter['proposal']> | null;
  proposalId: string | null;
  changes: AgentChangeSet | null;
  usage: { inputTokens: number; outputTokens: number }[];
}
/** Only V2 state owner; planner, recovery and adapter never own step status or reference authority. */
export class TaskRuntime {
  private readonly controller = new AbortController();
  private readonly fingerprints = new Set<string>();
  private state: TaskState;
  private busy = false;
  private deadline: ReturnType<typeof setTimeout> | undefined;
  private startedAt = 0;
  constructor(
    private readonly adapter: EditorAdapter,
    private readonly repair?: RepairPort,
    budget: Partial<ExecutionBudget> = {},
    private readonly requireRender = false,
  ) {
    const limits = {
      actions: 100,
      recoveries: 2,
      modelRequests: 3,
      deterministicRecoveries: 2,
      providerRetries: 0,
      inputTokens: 300000,
      outputTokens: 40000,
      durationMs: 180000,
      ...budget,
    };
    if (
      Object.values(limits).some((n) => !Number.isInteger(n) || n < 0) ||
      limits.actions > 100 ||
      limits.recoveries > 2 ||
      limits.modelRequests > 3 ||
      limits.deterministicRecoveries > 2 ||
      limits.providerRetries > 1 ||
      limits.inputTokens > 300000 ||
      limits.outputTokens > 40000 ||
      limits.durationMs < 1 ||
      limits.durationMs > 180000
    )
      throw problem('BUDGET_EXCEEDED', 'V2 执行预算无效');
    const version = contentHash(adapter.base);
    this.state = {
      id: crypto.randomUUID(),
      goal: '',
      phase: 'IDLE',
      baseVersion: version,
      sceneVersion: version,
      steps: [],
      references: {},
      targets: [],
      completedActions: [],
      pendingActions: [],
      errors: [],
      recoveryAttempts: 0,
      deterministicRecoveries: 0,
      providerRetries: 0,
      recoveries: [],
      requests: [],
      draftDisposition: 'ACTIVE',
      modelRequests: 0,
      actionAttempts: 0,
      budget: limits,
      verification: null,
      preview: null,
      proposedChanges: null,
      proposalId: null,
      changes: null,
      usage: [],
    };
  }
  getSnapshot = (): TaskState => structuredClone(this.state);
  draftSnapshot() {
    return structuredClone(this.adapter.snapshot());
  }
  private startDeadline() {
    this.startedAt = Date.now();
    this.deadline = setTimeout(
      () =>
        this.controller.abort(problem('BUDGET_EXCEEDED', '任务时间预算已用完')),
      this.state.budget.durationMs,
    );
  }
  private clearDeadline() {
    clearTimeout(this.deadline);
  }
  private checkActive() {
    this.controller.signal.throwIfAborted();
    if (!this.adapter.isBaseCurrent())
      throw problem('STALE_BASE', '正式工程已变化，保留用户新修改并停止草稿', {
        phase: 'execution',
      });
  }
  private reserveRequest(
    request: ChatRequest,
    record: TaskState['requests'][number],
  ) {
    this.checkActive();
    const inputUpper =
      new TextEncoder().encode(JSON.stringify(request)).length + 5000;
    const outputUpper = request.maxOutputTokens ?? 2000;
    const other = this.state.requests.filter(
      (r) => r !== record && r.status !== 'BLOCKED',
    );
    if (
      other.reduce((n, r) => n + (r.usage?.inputTokens ?? r.inputUpper), 0) +
        inputUpper >
        this.state.budget.inputTokens ||
      other.reduce((n, r) => n + (r.usage?.outputTokens ?? r.outputUpper), 0) +
        outputUpper >
        this.state.budget.outputTokens
    ) {
      record.status = 'BLOCKED';
      throw problem('BUDGET_EXCEEDED', '请求超过剩余Token预算，未发送', {
        phase: 'planning',
      });
    }
    record.inputUpper = inputUpper;
    record.outputUpper = outputUpper;
  }
  private async model<T>(
    kind: 'planning' | 'repair',
    actionId: string | null,
    operation: (guard: (request: ChatRequest) => void) => Promise<T>,
    usageOf: (
      value: T,
    ) => { inputTokens: number; outputTokens: number } | undefined,
  ): Promise<T> {
    for (;;) {
      this.checkActive();
      this.consumeRequest();
      const record: TaskState['requests'][number] = {
        kind,
        actionId,
        inputUpper: 0,
        outputUpper: 2000,
        status: 'PENDING',
      };
      this.state.requests.push(record);
      try {
        const signal = this.controller.signal;
        let onAbort: () => void = () => {};
        const aborted = new Promise<never>((_resolve, reject) => {
          onAbort = () => reject(signal.reason);
          signal.addEventListener('abort', onAbort, { once: true });
          if (signal.aborted) onAbort();
        });
        let value: T;
        try {
          value = await Promise.race([
            operation((r) => this.reserveRequest(r, record)),
            aborted,
          ]);
        } finally {
          signal.removeEventListener('abort', onAbort);
        }
        this.controller.signal.throwIfAborted();
        record.status = 'RECEIVED';
        const usage = usageOf(value);
        if (usage) {
          record.usage = {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          };
          this.state.usage.push(record.usage);
        }
        if (
          this.state.usage.reduce((n, u) => n + u.inputTokens, 0) >
            this.state.budget.inputTokens ||
          this.state.usage.reduce((n, u) => n + u.outputTokens, 0) >
            this.state.budget.outputTokens
        )
          throw problem('BUDGET_EXCEEDED', '实际模型用量已达到任务上限');
        return value;
      } catch (error) {
        if (record.status !== 'BLOCKED') record.status = 'FAILED';
        else this.state.modelRequests--;
        const diagnostic = normalizeError(error, actionId);
        if (diagnostic.usage && !record.usage) {
          record.usage = diagnostic.usage;
          this.state.usage.push(diagnostic.usage);
        }
        if (
          diagnostic.code !== 'PROVIDER_TRANSIENT_FAILURE' ||
          this.controller.signal.aborted ||
          this.state.providerRetries >= this.state.budget.providerRetries ||
          this.state.modelRequests >= this.state.budget.modelRequests
        )
          throw error;
        this.state.errors.push(diagnostic);
        const delay = diagnostic.retryAfterMs ?? 100;
        if (
          delay >=
          this.state.budget.durationMs - (Date.now() - this.startedAt)
        )
          throw problem('BUDGET_EXCEEDED', '限流等待超过剩余时间预算');
        this.state.providerRetries++;
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            reject(this.controller.signal.reason);
          };
          const timer = setTimeout(() => {
            this.controller.signal.removeEventListener('abort', abort);
            resolve();
          }, delay);
          this.controller.signal.addEventListener('abort', abort, {
            once: true,
          });
        });
      }
    }
  }
  private consumeRequest() {
    if (this.state.modelRequests >= this.state.budget.modelRequests)
      throw problem('BUDGET_EXCEEDED', '模型请求预算已用完', {
        phase: 'planning',
      });
    this.state.modelRequests++;
  }
  async planAndRun(
    goal: string,
    planner: AgentPlanner,
    sessionContext?: unknown,
  ) {
    if (this.state.phase !== 'IDLE')
      throw problem('REPLAY_FORBIDDEN', '本任务已启动');
    this.startDeadline();
    this.state.phase = 'PLANNING';
    this.state.goal = goal;
    try {
      const c = activeComposition(this.adapter.base);
      let rejectedPlan: CoreError | undefined;
      for (;;) {
        this.state.phase = rejectedPlan ? 'RECOVERING' : 'PLANNING';
        let intent: TaskIntent;
        try {
          const { rawIntent } = await this.model(
            'planning',
            null,
            (guard) =>
              planner.plan(
                goal,
                {
                  composition: {
                    id: c.id,
                    width: c.width,
                    height: c.height,
                    duration: c.duration,
                  },
                  selection: this.adapter.selection,
                  targets: c.layers
                    .filter((l) =>
                      this.adapter.scope.existingLayerIds.includes(l.id),
                    )
                    .map((l) => ({ id: l.id, type: l.type, name: l.name })),
                  scope: this.adapter.scope,
                  ...(sessionContext ? { session: sessionContext } : {}),
                },
                this.adapter.capabilities(),
                this.controller.signal,
                guard,
                rejectedPlan,
              ),
            (value) => value.response.usage,
          );
          intent = validateIntent(rawIntent, goal);
        } catch (error) {
          const diagnostic = normalizeError(error);
          const targeted =
            diagnostic.phase === 'planning' &&
            ((diagnostic.code === 'PROVIDER_RESPONSE' &&
              diagnostic.field === 'response') ||
              diagnostic.code === 'DEPENDENCY_ERROR' ||
              diagnostic.code === 'INVALID_ARGUMENTS' ||
              (diagnostic.code === 'VERIFICATION_FAILURE' &&
                diagnostic.field === 'actions.creation'));
          if (targeted && rejectedPlan) {
            this.state.errors.push(diagnostic);
            this.state.recoveries.push({
              actionId: null,
              method: 'PLAN_REGENERATE',
              code: diagnostic.code,
              outcome: 'REJECTED',
              draftVersion: this.state.sceneVersion,
            });
          }
          if (
            !targeted ||
            rejectedPlan ||
            this.state.recoveryAttempts >= this.state.budget.recoveries
          )
            throw error;
          this.state.errors.push(diagnostic);
          this.state.recoveryAttempts++;
          this.state.recoveries.push({
            actionId: null,
            method: 'PLAN_REGENERATE',
            code: diagnostic.code,
            outcome: 'REJECTED',
            draftVersion: this.state.sceneVersion,
          });
          rejectedPlan = diagnostic;
          continue;
        }
        if (rejectedPlan)
          this.state.recoveries.push({
            actionId: null,
            method: 'PLAN_REGENERATE',
            code: rejectedPlan.code,
            outcome: 'REPAIRED',
            draftVersion: this.state.sceneVersion,
          });
        // User goal remains authoritative even if the model rewrites intent.goal.
        await this.executeIntent({ ...intent, goal });
        break;
      }
    } catch (error) {
      this.fail(error);
    }
    this.clearDeadline();
    return this.getSnapshot();
  }
  async run(raw: unknown) {
    if (this.state.phase !== 'IDLE')
      throw problem('REPLAY_FORBIDDEN', '已完成的非幂等步骤不能重放');
    this.startDeadline();
    try {
      await this.executeIntent(
        validateIntent(raw, (raw as { goal?: string } | null)?.goal),
      );
    } catch (error) {
      this.fail(error);
    }
    this.clearDeadline();
    return this.getSnapshot();
  }
  private resolve(ref: LayerReference): string {
    const id =
      ref.kind === 'existing'
        ? ref.id
        : ref.kind === 'selection'
          ? this.adapter.selection.length === 1
            ? this.adapter.selection[0]
            : undefined
          : this.state.references[ref.actionId]?.layerId;
    if (!id)
      throw problem('INVALID_REFERENCE', '目标引用缺失或选择不唯一', {
        phase: 'resolving',
        target: ref,
        field: 'target',
        expected: 'one real layer in current draft',
      });
    this.adapter.assertTarget(id);
    if (!this.state.targets.includes(id)) this.state.targets.push(id);
    return id;
  }
  private async executeIntent(intent: TaskIntent) {
    this.controller.signal.throwIfAborted();
    if (intent.actions.length > this.state.budget.actions)
      throw problem('BUDGET_EXCEEDED', '计划超过动作预算');
    this.state.goal = intent.goal;
    this.state.steps = intent.actions.map((action) => ({
      action,
      status: 'PENDING',
      attempts: 0,
      recoveryAttempts: 0,
      draftVersion: this.state.sceneVersion,
    }));
    this.state.pendingActions = intent.actions.map((a) => a.id);
    await this.continueExecution();
  }
  /** Small deterministic batches: observe every action; never ask LLM for simple property writes. */
  private async continueExecution() {
    if (this.busy) throw problem('REPLAY_FORBIDDEN', '执行已在进行');
    this.busy = true;
    try {
      this.state.phase = 'EXECUTING';
      for (const step of this.state.steps) {
        this.controller.signal.throwIfAborted();
        if (step.status === 'SUCCEEDED') continue;
        if (
          !dependencies(step.action).every((id) =>
            this.state.completedActions.includes(id),
          )
        )
          throw problem('DEPENDENCY_ERROR', '依赖步骤未完成', {
            actionId: step.action.id,
          });
        step.status = 'READY';
        for (;;) {
          this.controller.signal.throwIfAborted();
          this.checkActive();
          step.status = 'RUNNING';
          step.attempts++;
          this.state.actionAttempts++;
          if (
            this.state.actionAttempts >
            this.state.budget.actions +
              this.state.budget.recoveries +
              this.state.budget.deterministicRecoveries
          )
            throw problem('BUDGET_EXCEEDED', '动作尝试预算已用完');
          const beforeAttempt = contentHash(this.adapter.snapshot()),
            beforeEvidence = JSON.stringify(this.adapter.evidence());
          try {
            const a = step.action,
              target = 'target' in a ? this.resolve(a.target) : undefined;
            let keyframeId: string | undefined;
            if (a.type === 'modifyKeyframe')
              keyframeId =
                a.keyframe.kind === 'existing'
                  ? a.keyframe.id
                  : this.state.references[a.keyframe.actionId]?.keyframeId;
            step.resolvedArguments = this.adapter.prepare(
              a,
              target,
              keyframeId,
            ).args;
            const result = await this.adapter.execute(
              a,
              target,
              keyframeId,
              this.controller.signal,
            );
            this.controller.signal.throwIfAborted();
            const outputs = (
              result as { outputs: Partial<Record<ObjectOutput, string>> }
            ).outputs;
            verifyAction(
              a,
              this.adapter.snapshot(),
              outputs,
              target,
              keyframeId,
              this.adapter.time,
            );
            this.state.references[a.id] = { ...outputs };
            step.result = { ...outputs };
            step.status = 'SUCCEEDED';
            for (const r of this.state.recoveries)
              if (r.actionId === a.id && r.outcome === 'REPAIRED')
                r.outcome = 'SUCCEEDED';
            this.state.completedActions.push(a.id);
            this.state.pendingActions = this.state.pendingActions.filter(
              (id) => id !== a.id,
            );
            this.state.sceneVersion = contentHash(this.adapter.snapshot());
            step.draftVersion = this.state.sceneVersion;
            break;
          } catch (error) {
            if (this.controller.signal.aborted) throw error;
            step.status = 'FAILED';
            const diagnostic = normalizeError(
              error,
              step.action.id,
              'target' in step.action ? step.action.target : null,
            );
            this.state.errors.push(diagnostic);
            step.failure = diagnostic;
            this.state.sceneVersion = contentHash(this.adapter.snapshot());
            if (
              !this.adapter.canContinue() ||
              this.state.sceneVersion !== beforeAttempt ||
              JSON.stringify(this.adapter.evidence()) !== beforeEvidence
            ) {
              this.state.draftDisposition = 'UNSAFE';
              throw problem(
                'REPLAY_FORBIDDEN',
                '失败动作已写入或关闭草稿，禁止盲目重放；正式工程未提交',
                {
                  actionId: step.action.id,
                  expected: 'unchanged open draft',
                  actual: 'draft or transaction changed',
                },
              );
            }
            const trusted =
              'target' in step.action &&
              step.action.target.kind === 'result' &&
              !!this.state.references[step.action.target.actionId]?.layerId;
            const method = deterministicRecovery(diagnostic, trusted);
            const fingerprint = JSON.stringify({
              action: step.action,
              code: diagnostic.code,
              field: diagnostic.field,
            });
            if (this.fingerprints.has(fingerprint)) throw error;
            this.fingerprints.add(fingerprint);
            step.status = 'RECOVERING';
            this.state.phase = 'RECOVERING';
            if (
              method &&
              this.state.deterministicRecoveries <
                this.state.budget.deterministicRecoveries
            ) {
              this.state.deterministicRecoveries++;
              step.recoveryAttempts++;
              this.state.recoveries.push({
                actionId: step.action.id,
                method,
                code: diagnostic.code,
                outcome: 'REPAIRED',
                draftVersion: beforeAttempt,
              });
            } else {
              if (!canRecover(diagnostic) || !this.repair) throw error;
              let feedback = diagnostic;
              const invalid = new Set<string>();
              for (;;) {
                if (this.state.recoveryAttempts >= this.state.budget.recoveries)
                  throw problem(
                    'BUDGET_EXCEEDED',
                    '失败动作模型修复预算已用完',
                    { actionId: step.action.id },
                  );
                this.state.recoveryAttempts++;
                step.recoveryAttempts++;
                const recovery: TaskState['recoveries'][number] = {
                  actionId: step.action.id,
                  method: 'MODEL_ARGUMENTS',
                  code: feedback.code,
                  outcome: 'REJECTED',
                  draftVersion: beforeAttempt,
                };
                this.state.recoveries.push(recovery);
                const candidate = await this.model(
                  'repair',
                  step.action.id,
                  (guard) =>
                    this.repair!(
                      structuredClone(step.action),
                      structuredClone(feedback),
                      this.controller.signal,
                      {
                        goal: this.state.goal,
                        draftVersion: beforeAttempt,
                        completedActions: [...this.state.completedActions],
                        target:
                          'target' in step.action
                            ? (() => {
                                const l = this.adapter.inspectLayer(
                                  this.resolve(step.action.target),
                                );
                                return { id: l.id, type: l.type, name: l.name };
                              })()
                            : null,
                        allowRepair: 'arguments-only',
                        beforeRequest: guard,
                      },
                    ),
                  (value) => value.usage,
                );
                this.checkActive();
                let repaired: SemanticAction | undefined;
                try {
                  repaired = validateRepair(step.action, candidate.action);
                  const target =
                    'target' in repaired
                      ? this.resolve(repaired.target)
                      : undefined;
                  const keyframe =
                    repaired.type === 'modifyKeyframe'
                      ? repaired.keyframe.kind === 'existing'
                        ? repaired.keyframe.id
                        : this.state.references[repaired.keyframe.actionId]
                            ?.keyframeId
                      : undefined;
                  this.adapter.prepare(repaired, target, keyframe);
                  step.action = repaired;
                  recovery.outcome = 'REPAIRED';
                  break;
                } catch (invalidRepair) {
                  feedback = normalizeError(
                    invalidRepair,
                    step.action.id,
                    'target' in step.action ? step.action.target : null,
                  );
                  this.state.errors.push(feedback);
                  const key = JSON.stringify(repaired ?? candidate.action);
                  if (
                    invalid.has(key) ||
                    key === JSON.stringify(step.action) ||
                    !canRecover(feedback)
                  )
                    throw invalidRepair;
                  invalid.add(key);
                }
              }
            }
            this.state.phase = 'EXECUTING';
          }
        }
      }
      this.checkActive();
      this.state.phase = 'VERIFYING';
      this.state.verification = this.adapter.verify();
      this.verifyCreatedObjects();
      this.state.preview = await this.adapter.render(
        this.adapter.time,
        this.controller.signal,
      );
      if (this.requireRender && !this.state.preview)
        throw problem('VERIFICATION_FAILURE', '本任务必须完成实际渲染验证', {
          phase: 'verification',
        });
      this.controller.signal.throwIfAborted();
      if (this.state.preview)
        this.state.verification.render = { status: 'PASSED', frames: 1 };
      this.state.proposedChanges = this.adapter.proposal();
      this.state.proposalId = crypto.randomUUID();
      this.state.phase = 'AWAITING_ACCEPTANCE';
    } finally {
      this.busy = false;
    }
  }
  private verifyCreatedObjects() {
    const expected = creationContract(this.state.goal);
    if (!expected) return;
    const original = new Set(
      activeComposition(this.adapter.base).layers.map((layer) => layer.id),
    );
    const created = activeComposition(this.adapter.snapshot()).layers.filter(
      (layer) => !original.has(layer.id),
    );
    const actual = { rectangle: 0, ellipse: 0, text: 0 };
    for (const layer of created) {
      if (layer.type === 'text') actual.text++;
      if (
        layer.type === 'shape' &&
        (layer.shapeKind === 'rectangle' || layer.shapeKind === 'ellipse')
      )
        actual[layer.shapeKind]++;
    }
    if (
      created.length !== Object.values(expected).reduce((a, b) => a + b, 0) ||
      Object.keys(expected).some(
        (key) =>
          expected[key as keyof typeof expected] !==
          actual[key as keyof typeof actual],
      )
    )
      throw problem(
        'VERIFICATION_FAILURE',
        '实际草稿创建对象不符合用户数量和类型约束',
        {
          phase: 'verification',
          field: 'scene.creation',
          expected,
          actual: {
            counts: actual,
            createdIds: created.map((layer) => layer.id),
          },
        },
      );
  }
  /** Host/user acceptance only. Provider/planner/repair receive no commit port. */
  accept(proposalId: string) {
    this.controller.signal.throwIfAborted();
    if (
      this.state.phase !== 'AWAITING_ACCEPTANCE' ||
      proposalId !== this.state.proposalId
    )
      throw problem('AUTHORIZATION_REQUIRED', '请确认当前草稿方案', {
        phase: 'commit',
      });
    if (!this.adapter.isBaseCurrent()) {
      const error = problem('STALE_BASE', '正式工程已变更，请重新创建任务', {
        phase: 'commit',
      });
      this.fail(error);
      throw error;
    }
    try {
      this.verifyCreatedObjects();
      this.state.changes = this.adapter.commit(
        'Agent Core V2：' + this.state.goal,
      );
      this.state.phase = 'COMPLETED';
      this.state.draftDisposition = 'COMMITTED';
      return this.getSnapshot();
    } catch (error) {
      this.fail(error);
      throw error;
    }
  }
  cancel() {
    if (
      ['COMPLETED', 'FAILED', 'CANCELLED', 'DISCARDED'].includes(
        this.state.phase,
      )
    )
      return;
    this.clearDeadline();
    this.controller.abort(problem('CANCELLED', '用户已停止任务'));
    this.state.draftDisposition = 'DISCARDED';
    this.adapter.discard();
    this.state.phase = 'CANCELLED';
    this.state.proposalId = null;
    this.state.proposedChanges = null;
    this.state.steps.forEach((s) => {
      if (s.status !== 'SUCCEEDED') s.status = 'CANCELLED';
    });
  }
  discard() {
    if (this.state.phase === 'COMPLETED') return;
    this.cancel();
    this.state.phase = 'DISCARDED';
  }
  private fail(error: unknown) {
    this.clearDeadline();
    const stopped =
      this.controller.signal.aborted &&
      this.controller.signal.reason instanceof CoreV2Error
        ? this.controller.signal.reason
        : error;
    if (this.state.draftDisposition === 'ACTIVE')
      this.state.draftDisposition = 'INSPECTABLE';
    this.state.sceneVersion = contentHash(this.adapter.snapshot());
    this.adapter.discard();
    this.state.proposalId = null;
    this.state.proposedChanges = null;
    if (
      normalizeError(stopped).code === 'CANCELLED' ||
      (this.controller.signal.aborted &&
        !(this.controller.signal.reason instanceof CoreV2Error))
    ) {
      this.state.draftDisposition = 'DISCARDED';
      this.state.errors.push(problem('CANCELLED', '用户已停止任务').diagnostic);
      this.state.phase = 'CANCELLED';
      this.state.steps.forEach((s) => {
        if (s.status !== 'SUCCEEDED') s.status = 'CANCELLED';
      });
      return;
    }
    const failedStep = this.state.steps.find((step) =>
      ['RUNNING', 'RECOVERING', 'FAILED'].includes(step.status),
    );
    if (failedStep) failedStep.status = 'FAILED';
    const diagnostic = normalizeError(
      stopped,
      failedStep?.action.id ?? null,
      failedStep && 'target' in failedStep.action
        ? failedStep.action.target
        : null,
    );
    if (
      !this.state.errors.some(
        (e) =>
          e.code === diagnostic.code &&
          e.actionId === diagnostic.actionId &&
          e.message === diagnostic.message,
      )
    )
      this.state.errors.push(diagnostic);
    this.state.phase = 'FAILED';
  }
}
