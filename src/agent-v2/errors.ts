import { AgentToolError } from '../agent/tool-registry';
import { AgentExecutionError } from '../agent/execution-error';
import type { LayerReference } from './actions';
export type ErrorCode =
  | 'INVALID_ARGUMENTS'
  | 'INVALID_REFERENCE'
  | 'MISSING_CAPABILITY'
  | 'DEPENDENCY_ERROR'
  | 'COMMAND_REJECTION'
  | 'VERIFICATION_FAILURE'
  | 'BUDGET_EXCEEDED'
  | 'CANCELLED'
  | 'STALE_BASE'
  | 'AUTHORIZATION_REQUIRED'
  | 'PROVIDER_RESPONSE'
  | 'PROVIDER_TRANSIENT_FAILURE'
  | 'CONTEXT_STALE'
  | 'PERMISSION_DENIED'
  | 'PROVIDER_UNSUPPORTED'
  | 'REPLAY_FORBIDDEN';
export interface CoreError {
  code: ErrorCode;
  phase: 'planning' | 'resolving' | 'execution' | 'verification' | 'commit';
  actionId: string | null;
  target: LayerReference | null;
  field: string | null;
  expected: unknown;
  actual: unknown;
  recoverable: boolean;
  strategy:
    | 'NONE'
    | 'FAILED_ACTION_ONLY'
    | 'REFRESH_DRAFT'
    | 'RETRY_ACTION'
    | 'RETRY_PROVIDER';
  retryAfterMs?: number;
  usage?: { inputTokens: number; outputTokens: number };
  message: string;
}
export class CoreV2Error extends Error {
  constructor(readonly diagnostic: CoreError) {
    super(diagnostic.message);
  }
}
export function problem(
  code: ErrorCode,
  message: string,
  patch: Partial<Omit<CoreError, 'code' | 'message'>> = {},
) {
  return new CoreV2Error({
    code,
    message,
    phase: 'execution',
    actionId: null,
    target: null,
    field: null,
    expected: null,
    actual: null,
    recoverable: false,
    strategy: 'NONE',
    ...patch,
  });
}
export function normalizeError(
  error: unknown,
  actionId: string | null = null,
  target: LayerReference | null = null,
): CoreError {
  if (error instanceof CoreV2Error)
    return {
      ...error.diagnostic,
      actionId: error.diagnostic.actionId ?? actionId,
      target: error.diagnostic.target ?? target,
    };
  if (error instanceof AgentToolError) {
    const invalid = error.code === 'invalid_arguments';
    return problem(
      invalid
        ? 'INVALID_ARGUMENTS'
        : error.code === 'unknown_tool'
          ? 'MISSING_CAPABILITY'
          : error.code === 'permission_denied'
            ? 'PERMISSION_DENIED'
            : 'COMMAND_REJECTION',
      invalid ? '操作参数不符合工具契约' : '编辑器拒绝此操作',
      {
        actionId,
        target,
        field: error.details?.issues[0]?.field ?? null,
        expected: error.details?.issues[0]?.expected ?? null,
        actual: error.details?.issues[0]?.received ?? null,
        recoverable: invalid,
        strategy: invalid ? 'FAILED_ACTION_ONLY' : 'NONE',
      },
    ).diagnostic;
  }
  if (error instanceof AgentExecutionError) {
    const referenceCodes = [
      'INVALID_OBJECT_ID',
      'TARGET_NOT_FOUND',
      'OBJECT_REFERENCE_INVALID',
      'STEP_RESULT_UNRESOLVED',
    ];
    const code: ErrorCode = [
      'PERMISSION_DENIED',
      'TOOL_NOT_ALLOWED',
      'UNSAFE_OPERATION',
    ].includes(error.code)
      ? 'PERMISSION_DENIED'
      : error.code === 'CONTEXT_STALE'
        ? 'CONTEXT_STALE'
        : [
              'TOOL_ARGUMENT_INVALID',
              'SCHEMA_INVALID',
              'SEMANTIC_INVALID',
            ].includes(error.code)
          ? 'INVALID_ARGUMENTS'
          : referenceCodes.includes(error.code)
            ? 'INVALID_REFERENCE'
            : error.code.includes('VERIFICATION')
              ? 'VERIFICATION_FAILURE'
              : error.code === 'CAPABILITY_MISSING' ||
                  error.code === 'CAPABILITY_UNAVAILABLE'
                ? 'MISSING_CAPABILITY'
                : 'COMMAND_REJECTION';
    return problem(code, '编辑器操作或结果校验失败', {
      phase:
        error.phase === 'resolve'
          ? 'resolving'
          : error.phase === 'verify'
            ? 'verification'
            : 'execution',
      actionId,
      target,
      field: error.field ?? null,
      expected: error.expected ?? null,
      actual: error.received ?? null,
      recoverable:
        error.recoverable &&
        [
          'COMMAND_REJECTION',
          'INVALID_REFERENCE',
          'CONTEXT_STALE',
          'INVALID_ARGUMENTS',
        ].includes(code),
      strategy:
        error.recoverable && code === 'CONTEXT_STALE'
          ? 'REFRESH_DRAFT'
          : error.recoverable && code === 'COMMAND_REJECTION'
            ? 'RETRY_ACTION'
            : error.recoverable && code === 'INVALID_ARGUMENTS'
              ? 'FAILED_ACTION_ONLY'
              : 'NONE',
    }).diagnostic;
  }
  return problem('COMMAND_REJECTION', '操作未完成，正式工程未修改', {
    actionId,
    target,
  }).diagnostic;
}
/** Valid JSON with bounded fields, never a sliced JSON document or raw provider body. */
export function recoveryFeedback(error: CoreError) {
  const bounded = (v: unknown) => {
    if (v === null || typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.slice(0, 240);
    return {
      omitted: true,
      reason: 'inspect registered contract for structured values',
    };
  };
  return JSON.stringify({
    ...error,
    message: error.message.slice(0, 240),
    expected: bounded(error.expected),
    actual: bounded(error.actual),
  });
}
