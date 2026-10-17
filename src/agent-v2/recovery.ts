import type { SemanticAction } from './actions';
import { actionSchema } from './actions';
import { problem, type CoreError } from './errors';
/** Stateless policy: counters and completed states belong exclusively to TaskRuntime. */
export function canRecover(error: CoreError) {
  return (
    error.recoverable &&
    error.strategy === 'FAILED_ACTION_ONLY' &&
    [
      'INVALID_ARGUMENTS',
      'INVALID_REFERENCE',
      'COMMAND_REJECTION',
      'VERIFICATION_FAILURE',
    ].includes(error.code)
  );
}
/** A retry is only permitted by an explicit typed error and an unchanged, open draft. */
export function deterministicRecovery(
  error: CoreError,
  hasTrustedResult: boolean,
) {
  if (!error.recoverable) return null;
  if (error.code === 'CONTEXT_STALE' && error.strategy === 'REFRESH_DRAFT')
    return 'REFRESH_DRAFT' as const;
  if (error.code === 'INVALID_REFERENCE' && hasTrustedResult)
    return 'RESOLVE_RESULT' as const;
  if (error.code === 'COMMAND_REJECTION' && error.strategy === 'RETRY_ACTION')
    return 'RETRY_ACTION' as const;
  return null;
}
export function validateRepair(previous: SemanticAction, raw: unknown) {
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success)
    throw problem('INVALID_ARGUMENTS', '修复后的动作仍不符合契约', {
      recoverable: true,
      strategy: 'FAILED_ACTION_ONLY',
      field: parsed.error.issues[0]?.path.join('.') ?? '$',
      expected: 'failed action schema',
      actual: parsed.error.issues[0]?.code,
    });
  const next = parsed.data;
  // Native adapters still run their original Registry schema and semantic verification.
  // Only value-like fields may change; resource IDs, paths, order, text and types stay immutable.
  const repairable = new Set([
    'value',
    'x',
    'y',
    'z',
    'width',
    'height',
    'opacity',
    'color',
    'radius',
    'feather',
    'expansion',
    'enabled',
    'rotation',
    'scale',
    'position',
  ]);
  const nativeArgsSafe =
    'args' in previous &&
    'args' in next &&
    Object.keys(previous.args).length === Object.keys(next.args).length &&
    Object.keys(previous.args).every(
      (key) =>
        Object.hasOwn(next.args, key) &&
        (repairable.has(key) ||
          JSON.stringify(previous.args[key]) ===
            JSON.stringify(next.args[key])),
    );

  if (
    ('tool' in previous &&
      (!('tool' in next) || previous.tool !== next.tool)) ||
    ('args' in previous &&
      (!('args' in next) ||
        (!nativeArgsSafe &&
          JSON.stringify(previous.args) !== JSON.stringify(next.args)))) ||
    next.id !== previous.id ||
    next.type !== previous.type ||
    JSON.stringify(next.dependsOn) !== JSON.stringify(previous.dependsOn) ||
    ('target' in previous &&
      (!('target' in next) ||
        JSON.stringify(next.target) !== JSON.stringify(previous.target))) ||
    (previous.type === 'modifyKeyframe' &&
      (next.type !== 'modifyKeyframe' ||
        JSON.stringify(next.keyframe) !== JSON.stringify(previous.keyframe))) ||
    (previous.type === 'deleteKeyframe' &&
      (next.type !== 'deleteKeyframe' ||
        next.keyframeId !== previous.keyframeId)) ||
    (previous.type === 'setFont' &&
      (next.type !== 'setFont' || next.fontFamily !== previous.fontFamily))
  )
    throw problem('COMMAND_REJECTION', '恢复不得更换动作、依赖或目标');
  if (
    ('property' in previous &&
      (!('property' in next) || next.property !== previous.property)) ||
    (previous.type === 'createShape' &&
      (next.type !== 'createShape' || next.shape !== previous.shape)) ||
    (previous.type === 'createText' &&
      (next.type !== 'createText' || next.content !== previous.content))
  )
    throw problem(
      'COMMAND_REJECTION',
      '恢复不得更换对象类型、属性路径或文本目标',
    );
  return next;
}
export type RepairPort = (
  failed: SemanticAction,
  error: CoreError,
  signal: AbortSignal,
  context?: RepairContext,
) => Promise<{
  action: unknown;
  usage?: { inputTokens: number; outputTokens: number };
}>;
export interface RepairContext {
  goal: string;
  draftVersion: string;
  completedActions: readonly string[];
  target: { id: string; type: string; name: string } | null;
  allowRepair: 'arguments-only';
  beforeRequest?: (request: import('../ai/contracts').ChatRequest) => void;
}
