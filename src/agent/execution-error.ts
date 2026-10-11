/** Machine-readable errors; legacy tool codes remain compatible at the registry boundary. */
export type AgentExecutionCode =
  | 'SCHEMA_INVALID'
  | 'SEMANTIC_INVALID'
  | 'CONTEXT_INVALID'
  | 'CAPABILITY_MISSING'
  | 'COMMAND_FAILED'
  | 'VERIFICATION_FAILED'
  | 'PROVIDER_FAILED'
  | 'RENDER_FAILED';
export type AgentExecutionPhase =
  | 'schema'
  | 'preflight'
  | 'compile'
  | 'read'
  | 'execute'
  | 'verify'
  | 'provider'
  | 'render'
  | 'commit';
export interface AgentExecutionDetails {
  code: AgentExecutionCode;
  phase: AgentExecutionPhase;
  toolName?: string;
  field?: string;
  expected?: unknown;
  received?: unknown;
  targetId?: string;
  recoverable: boolean;
  message: string;
  cause?: unknown;
}
export class AgentExecutionError
  extends Error
  implements AgentExecutionDetails
{
  readonly code: AgentExecutionCode;
  readonly phase: AgentExecutionPhase;
  readonly toolName?: string;
  readonly field?: string;
  readonly expected?: unknown;
  readonly received?: unknown;
  readonly targetId?: string;
  readonly recoverable: boolean;
  readonly cause?: unknown;
  constructor(details: AgentExecutionDetails) {
    super(details.message);
    this.name = 'AgentExecutionError';
    this.code = details.code;
    this.phase = details.phase;
    this.toolName = details.toolName;
    this.field = details.field;
    this.expected = details.expected;
    this.received = details.received;
    this.targetId = details.targetId;
    this.recoverable = details.recoverable;
    this.cause = details.cause;
  }
}
/** Preserve structured causes, never infer recoverability from human-readable messages. */
export function executionError(
  error: unknown,
  defaults: Partial<AgentExecutionDetails> = {},
): AgentExecutionError {
  if (error instanceof AgentExecutionError)
    return new AgentExecutionError({
      ...defaults,
      ...error,
      message: error.message,
      toolName: error.toolName ?? defaults.toolName,
      targetId: error.targetId ?? defaults.targetId,
    });
  const source = error as
    | {
        code?: string;
        details?: {
          tool?: string;
          issues?: { field: string; expected: unknown; received: unknown }[];
        };
        issues?: unknown[];
        message?: string;
      }
    | undefined;
  const legacy = source?.code;
  const schema =
    legacy === 'invalid_arguments' ||
    (error instanceof Error && error.name === 'ZodError');
  const issue = source?.details?.issues?.[0];
  const provider =
    !!legacy &&
    ![
      'invalid_arguments',
      'permission_denied',
      'unknown_tool',
      'tool_failed',
    ].includes(legacy);
  return new AgentExecutionError({
    code: provider
      ? 'PROVIDER_FAILED'
      : schema
        ? 'SCHEMA_INVALID'
        : legacy === 'unknown_tool'
          ? 'CAPABILITY_MISSING'
          : legacy === 'permission_denied'
            ? 'CONTEXT_INVALID'
            : (defaults.code ?? 'COMMAND_FAILED'),
    phase: provider
      ? 'provider'
      : schema
        ? 'schema'
        : (defaults.phase ?? 'execute'),
    toolName: source?.details?.tool ?? defaults.toolName,
    field: issue?.field ?? defaults.field,
    expected: issue?.expected ?? defaults.expected,
    received: issue?.received ?? defaults.received,
    targetId: defaults.targetId,
    recoverable:
      legacy === 'permission_denied' || legacy === 'unknown_tool'
        ? false
        : schema
          ? true
          : (defaults.recoverable ?? false),
    message: source?.message ?? defaults.message ?? 'Agent 执行失败',
    cause: {
      code: legacy,
      name: error instanceof Error ? error.name : undefined,
      message: source?.message,
      issues: source?.details?.issues ?? source?.issues,
    },
  });
}
function safeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[omitted]';
  if (typeof value === 'string')
    return value
      .replace(/Bearer\s+\S+|sk-[A-Za-z0-9_-]{12,}/g, '[redacted]')
      .slice(0, 500);
  if (value === null || typeof value === 'number' || typeof value === 'boolean')
    return value;
  if (Array.isArray(value))
    return value.slice(0, 20).map((v) => safeValue(v, depth + 1));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 20)
        .map(([k, v]) => [
          k,
          /authorization|api.?key|password|secret|token|credential|images|dataurl/i.test(
            k,
          )
            ? '[redacted]'
            : safeValue(v, depth + 1),
        ]),
    );
  return undefined;
}
/** Bound data before serialization; never slice serialized JSON. */
export function errorFeedback(
  error: unknown,
  defaults: Partial<AgentExecutionDetails> = {},
  limit = 2400,
): string {
  const e = executionError(error, defaults);
  const data = safeValue({
    code: e.code,
    phase: e.phase,
    toolName: e.toolName,
    field: e.field,
    targetId: e.targetId,
    recoverable: e.recoverable,
    message: e.message,
    expected: e.expected,
    received: e.received,
    cause: e.cause,
  }) as Record<string, unknown>;
  for (const key of ['cause', 'expected', 'received']) {
    if (JSON.stringify(data).length <= limit) break;
    data[key] = '[omitted: feedback budget]';
  }
  if (JSON.stringify(data).length > limit)
    data.message = String(data.message).slice(0, 120);
  if (JSON.stringify(data).length > limit) {
    delete data.cause;
    delete data.expected;
    delete data.received;
    for (const key of ['message', 'field', 'targetId', 'toolName'])
      if (typeof data[key] === 'string')
        data[key] = String(data[key]).slice(0, 100);
  }
  return JSON.stringify(data);
}

export function boundedFeedback(value: unknown, limit = 16000): string {
  const safe = safeValue(value);
  const encoded = JSON.stringify(safe ?? null);
  return encoded.length <= limit
    ? encoded
    : JSON.stringify({
        omitted: true,
        reason: 'structured feedback budget',
        type: Array.isArray(safe) ? 'array' : typeof safe,
      });
}

/** Object key order cannot disguise a repeated rejected argument set. */
export function argumentFingerprint(value: unknown): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, child]) => [k, stable(child)]),
          )
        : v;
  return JSON.stringify(stable(value));
}
