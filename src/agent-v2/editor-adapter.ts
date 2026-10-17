import {
  AgentTransaction,
  type AgentTransactionHost,
} from '../agent/transaction';
import type { AgentToolRegistry } from '../agent/tool-registry';
import { creationDiff, validateCreationScope } from '../agent/creation-scope';
import {
  verifyExecutionState,
  type ExecutionVerification,
} from '../agent/execution-verification';
import {
  activeComposition,
  layerProperties,
  type Layer,
  type Project,
} from '../core/project-model';
import {
  executionTool,
  nativeCreateTools,
  nativeEditTools,
  type SemanticAction,
} from './actions';
import { CoreV2Error, problem } from './errors';

export interface MutationScope {
  compositionId: string;
  existingLayerIds: readonly string[];
  allowCreate: boolean;
}
export interface RenderEvidence {
  image: string;
  width: number;
  height: number;
  foregroundPixels: number;
}
export type PreviewRenderer = (
  project: Project,
  time: number,
  signal: AbortSignal,
) => Promise<RenderEvidence>;
export const coreExecutionTools = [
  ...nativeCreateTools,
  ...nativeEditTools,
  'setScale',
  'setRotation',
  'createRectangle',
  'createEllipse',
  'createText',
  'setPosition',
  'setOpacity',
  'setFill',
  'addEffect',
  'addKeyframe',
  'setInterpolation',
  'setFontSize',
  'setFont',
  'setLayerDimensions',
  'deleteKeyframe',
] as const;
/** No execution state: holds the existing isolated transaction and canonical editor ports. */
export class EditorAdapter {
  readonly base: Project;
  readonly selection: readonly string[];
  readonly scope: MutationScope;
  private readonly draft: AgentTransaction;
  constructor(
    private readonly host: AgentTransactionHost,
    private readonly registry: AgentToolRegistry,
    scope: MutationScope,
    selection: readonly string[],
    private readonly renderer?: PreviewRenderer,
    readonly time = 0,
  ) {
    this.base = host.getSnapshot();
    this.scope = structuredClone(scope);
    this.selection = [...selection];
    if (
      !Number.isFinite(time) ||
      time < 0 ||
      time > activeComposition(this.base).duration
    )
      throw problem('INVALID_ARGUMENTS', '任务时间不在当前合成范围内');
    if (
      activeComposition(this.base).id !== scope.compositionId ||
      scope.existingLayerIds.some(
        (id) => !activeComposition(this.base).layers.some((l) => l.id === id),
      )
    )
      throw problem('INVALID_REFERENCE', '授权目标不属于当前合成', {
        phase: 'resolving',
      });
    this.draft = new AgentTransaction(
      host,
      registry,
      this.base,
      { selection: this.selection, time: this.time },
      // Only removeEffect is permitted as a destructive draft operation by this allowlist.
      // No formal mutation occurs until TaskRuntime.accept; the editor always requires review for it.
      true,
      coreExecutionTools,
      (base, next) => this.validateScope(base, next),
    );
  }
  private validateScope(base: Project, next: Project) {
    validateCreationScope(base, next, {
      kind: 'FULL_COMPOSITION',
      compositionId: this.scope.compositionId,
    });
    const before = activeComposition(base),
      after = activeComposition(next);
    if (
      JSON.stringify({ ...before, layers: [] }) !==
      JSON.stringify({ ...after, layers: [] })
    )
      throw problem('COMMAND_REJECTION', '未授权修改合成设置');
    const protectedLayers = before.layers.filter(
      (l) => !this.scope.existingLayerIds.includes(l.id),
    );
    if (
      protectedLayers.some(
        (l) =>
          JSON.stringify(l) !==
          JSON.stringify(after.layers.find((n) => n.id === l.id)),
      )
    )
      throw problem('COMMAND_REJECTION', '操作超出授权图层范围');
    if (
      !this.scope.allowCreate &&
      after.layers.some((l) => !before.layers.some((n) => n.id === l.id))
    )
      throw problem('COMMAND_REJECTION', '当前任务未授权创建图层');
  }
  snapshot() {
    return this.draft.getSnapshot();
  }
  inspectLayer(id: string): Layer {
    const layer = activeComposition(this.snapshot()).layers.find(
      (l) => l.id === id,
    );
    if (!layer)
      throw problem('INVALID_REFERENCE', '目标图层已不存在', {
        phase: 'resolving',
        field: 'target',
        actual: id,
      });
    return layer;
  }
  assertTarget(id: string) {
    const layer = this.inspectLayer(id);
    const existing = activeComposition(this.base).layers.some(
      (l) => l.id === id,
    );
    if ((existing && !this.scope.existingLayerIds.includes(id)) || layer.locked)
      throw problem('COMMAND_REJECTION', '目标图层未授权或已锁定', {
        phase: 'resolving',
        field: 'target',
        actual: id,
      });
    return layer;
  }
  capabilities() {
    return [...new Set(coreExecutionTools)].map((name) => {
      try {
        return { ...this.registry.contract(name), available: true };
      } catch {
        return { name, available: false };
      }
    });
  }
  prepare(
    action: SemanticAction,
    targetId: string | undefined,
    keyframeId: string | undefined,
  ) {
    const name = executionTool(action);
    if (
      !this.registry
        .catalog()
        .some(
          (t) =>
            t.name === name &&
            (t.permission === 'WRITE' ||
              (name === 'removeEffect' && t.permission === 'DESTRUCTIVE')),
        )
    )
      throw problem('MISSING_CAPABILITY', '实际注册表未提供此操作', {
        actionId: action.id,
        expected: name,
      });
    if ('args' in action && JSON.stringify(action.args).length > 64000)
      throw problem('BUDGET_EXCEEDED', '原生工具参数超过64KB限制');
    let args: unknown;
    const { id, dependsOn, type, ...values } = action;
    void dependsOn;
    void type;
    switch (action.type) {
      case 'createNative':
        if (!this.scope.allowCreate)
          throw problem('COMMAND_REJECTION', '当前范围不允许创建对象');
        if ('layerId' in action.args)
          throw problem('INVALID_ARGUMENTS', '创建身份由编辑器分配');
        // Native text/rectangle/ellipse use their semantic actions, retaining count/content postconditions.
        if (
          action.tool === 'createLayer' &&
          ['rectangle', 'ellipse', 'text'].includes(String(action.args.kind))
        )
          throw problem(
            'INVALID_ARGUMENTS',
            '矩形、椭圆与文字必须使用对应语义创建动作',
          );
        args = action.args;
        break;
      case 'editNative':
        if ('layerId' in action.args)
          throw problem(
            'INVALID_ARGUMENTS',
            '请使用明确 target，不得覆盖图层身份',
          );
        args = { ...action.args, layerId: targetId };
        // Property-addressed native tools do not accept a redundant layerId.
        if (
          [
            'moveKeyframe',
            'setKeyframeValue',
            'setInterpolation',
            'deleteKeyframe',
          ].includes(action.tool)
        ) {
          args = action.args;
        }
        break;
      case 'setFont':
        args = { layerId: targetId, fontFamily: action.fontFamily };
        break;
      case 'setDimensions':
        args = {
          layerId: targetId,
          width: action.width,
          height: action.height,
        };
        break;
      case 'deleteKeyframe': {
        const layer = this.assertTarget(targetId!),
          property = layer.transform[action.property];
        if (!property.keyframes.some((k) => k.id === action.keyframeId))
          throw problem('INVALID_REFERENCE', '关键帧已不存在或不属于目标属性');
        args = { propertyId: property.id, keyframeId: action.keyframeId };
        break;
      }
      case 'createShape': {
        if (!this.scope.allowCreate)
          throw problem('COMMAND_REJECTION', '当前范围不允许创建对象');
        const { shape, ...creation } = values as Omit<
          Extract<SemanticAction, { type: 'createShape' }>,
          'id' | 'dependsOn' | 'type'
        >;
        void shape;
        args = creation;
        break;
      }
      case 'createText':
        if (!this.scope.allowCreate)
          throw problem('COMMAND_REJECTION', '当前范围不允许创建对象');
        args = values;
        break;
      case 'setProperty':
        args = {
          layerId: targetId,
          value: action.value,
          ...(action.time === undefined ? {} : { time: action.time }),
        };
        break;
      case 'setFill': {
        const { target, ...fill } = values as Omit<
          Extract<SemanticAction, { type: 'setFill' }>,
          'id' | 'dependsOn' | 'type'
        >;
        void target;
        args = { layerId: targetId, ...fill };
        break;
      }
      case 'addEffect':
        args = { layerId: targetId, kind: action.effect };
        break;
      case 'addKeyframe':
        args = {
          layerId: targetId,
          property: action.property,
          time: action.time,
          value: action.value,
          ...(action.interpolation
            ? { interpolation: action.interpolation }
            : {}),
        };
        break;
      case 'modifyKeyframe': {
        const layer = this.assertTarget(targetId!);
        const property = layer.transform[action.property];
        if (!property.keyframes.some((k) => k.id === keyframeId))
          throw problem('INVALID_REFERENCE', '关键帧不属于指定图层属性', {
            field: 'keyframe',
            actual: keyframeId,
          });
        args = {
          propertyId: property.id,
          keyframeId,
          interpolation: action.interpolation,
        };
        break;
      }
    }
    if (targetId) this.assertTarget(targetId);
    // Actual tool schema/defaults, reference checks, compiler and CommandSystem remain authoritative.
    const resolved = this.draft.resolveArguments(name, args);
    if (action.type === 'editNative') {
      const layer = this.assertTarget(targetId!);
      const data = resolved as Record<string, unknown>;
      if (
        data.propertyId &&
        !layerProperties(layer).some((p) => p.property.id === data.propertyId)
      )
        throw problem('INVALID_REFERENCE', '属性不属于指定目标图层');
      if (action.tool === 'createMask' && 'maskId' in action.args)
        throw problem('INVALID_ARGUMENTS', '遮罩身份由编辑器分配');
    }
    return { name, args: resolved, id };
  }
  async execute(
    action: SemanticAction,
    targetId: string | undefined,
    keyframeId: string | undefined,
    signal: AbortSignal,
  ) {
    const { name, args, id } = this.prepare(action, targetId, keyframeId);
    return this.draft.execute(name, args, signal, id);
  }
  canContinue() {
    return !this.draft.isClosed;
  }
  verify(): ExecutionVerification {
    this.validateScope(this.base, this.snapshot());
    return verifyExecutionState(
      this.registry,
      this.base,
      this.snapshot(),
      this.draft.evidence(),
    );
  }
  async render(time: number, signal: AbortSignal) {
    if (!this.renderer) return null;
    let evidence: RenderEvidence;
    try {
      evidence = await this.renderer(this.snapshot(), time, signal);
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof CoreV2Error) throw error;
      throw problem('VERIFICATION_FAILURE', '预览渲染失败，草稿未提交', {
        phase: 'verification',
        field: 'renderer',
        expected: 'real PNG frame',
        actual: error instanceof Error ? error.name : 'unknown exception',
      });
    }
    signal.throwIfAborted();
    if (
      !evidence.image.startsWith('data:image/png;base64,') ||
      evidence.width <= 0 ||
      evidence.height <= 0 ||
      !Number.isFinite(evidence.foregroundPixels)
    )
      throw problem('VERIFICATION_FAILURE', '实际预览渲染未返回有效图像', {
        phase: 'verification',
      });
    return evidence;
  }
  proposal() {
    return {
      authorization: structuredClone(this.scope),
      diff: creationDiff(this.base, this.snapshot(), {
        kind: 'FULL_COMPOSITION',
        compositionId: this.scope.compositionId,
      }),
    };
  }
  commit(label: string) {
    this.verify();
    return this.draft.commit(label);
  }
  discard() {
    this.draft.discard();
  }
  isBaseCurrent() {
    return this.host.getSnapshot() === this.base;
  }
  evidence() {
    return this.draft.evidence();
  }
}
