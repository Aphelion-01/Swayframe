import type { AgentPlan, AgentActivity } from './session';
import type { Project } from '../core/project-model';
import type {
  ExecutionEvidence,
  ExecutionVerification,
} from './execution-verification';
import { argumentFingerprint, diagnosticData } from './execution-error';
export interface AgentWorkingMemory {
  goal: string;
  compositionId: string;
  selectedObjects: readonly string[];
  createdObjectReferences: ExecutionEvidence['bindings'];
  completedTasks: readonly string[];
  pendingTasks: readonly string[];
  failedTasks: readonly string[];
  recoveryAttempts: number;
  activeConstraints: readonly string[];
  draftVersion: string;
}
export interface AgentExecutionTrace {
  sessionId: string;
  planId: string | null;
  skillIds: readonly { id: string; version: string; hash: string }[];
  modelCalls: readonly {
    stage: string;
    model: string;
    providerId?: string;
    usage?: unknown;
    durationMs: number;
  }[];
  selectedCapabilities: readonly string[];
  registeredTools?: readonly string[];
  availableCapabilities?: readonly string[];
  planning?: readonly {
    round: number;
    declaredTools: readonly string[];
    requestedTools: readonly string[];
    inspectionCalls: number;
    inspectionLimit: number;
    inspectionRounds: number;
    inspectionRoundLimit: number;
    remainingModelRequests: number;
    submitOnly: boolean;
    outcome: string;
    rejection?: { code: string; toolName?: string; allowed: boolean };
  }[];
  executedCommands: readonly { type: string; id: string }[];
  objectBindings: ExecutionEvidence['bindings'];
  validationResults: ExecutionVerification | null;
  finalResult: string;
  durationMs: number;
}
export function workingMemory(
  project: Project,
  plan: AgentPlan,
  selection: readonly string[],
  activities: readonly AgentActivity[],
  evidence: ExecutionEvidence,
  recoveries: number,
): AgentWorkingMemory {
  const completed = new Set(
    activities
      .filter((a) => a.status === 'completed' && a.stepId)
      .map((a) => a.stepId!),
  );
  const failed = new Set(
    activities
      .filter(
        (a) => a.status === 'failed' && a.stepId && !completed.has(a.stepId),
      )
      .map((a) => a.stepId!),
  );
  const tasks =
    plan.creation?.tasks ??
    plan.steps.map((s) => ({ id: s.id, stepIds: [s.id] }));
  return {
    goal: plan.goal,
    compositionId: project.activeCompositionId,
    selectedObjects: selection,
    createdObjectReferences: structuredClone(evidence.bindings),
    completedTasks: tasks
      .filter((t) => t.stepIds.every((id) => completed.has(id)))
      .map((t) => t.id),
    pendingTasks: tasks
      .filter((t) =>
        t.stepIds.some((id) => !completed.has(id) && !failed.has(id)),
      )
      .map((t) => t.id),
    failedTasks: tasks
      .filter((t) => t.stepIds.some((id) => failed.has(id)))
      .map((t) => t.id),
    recoveryAttempts: recoveries,
    activeConstraints: [
      'original-scope',
      'baseline-conflict-protection',
      'shared-transaction',
      'bounded-budget',
      'no-replay',
    ],
    draftVersion: argumentFingerprint(project),
  };
}
/** User-controlled report deliberately excludes prompt, scene content and pixels. */
export function exportAgentDiagnostic(session: {
  sessionId: string;
  status: string;
  trace?: AgentExecutionTrace;
  workingMemory?: AgentWorkingMemory;
  executionError?: unknown;
  recoveryTrace?: unknown;
}) {
  return JSON.stringify(
    diagnosticData(
      {
        version: 1,
        sessionId: session.sessionId,
        status: session.status,
        trace: session.trace,
        memory: session.workingMemory
          ? { ...session.workingMemory, goal: '[user content excluded]' }
          : undefined,
        executionError: safeError(session.executionError),
        recovery: Array.isArray(session.recoveryTrace)
          ? session.recoveryTrace.map((r) => ({
              stage: r.stage,
              strategy: r.strategy,
              outcome: r.outcome,
              attempt: r.attempt,
              fingerprint: r.fingerprint,
              error: safeError(r.error),
            }))
          : undefined,
      },
      1000000,
    ),
    null,
    2,
  );
}

function safeError(raw: unknown) {
  if (!raw || typeof raw !== 'object') return undefined;
  const error = raw as Record<string, unknown>;
  return {
    ...Object.fromEntries(
      [
        'code',
        'phase',
        'field',
        'recoverable',
        'toolName',
        'module',
        'capabilityId',
        'stepId',
        'taskId',
        'classification',
      ]
        .filter(
          (k) => typeof error[k] === 'boolean' || typeof error[k] === 'string',
        )
        .map((k) => [k, error[k]]),
    ),
    ...(error.expected !== undefined
      ? { expected: diagnosticData({ value: error.expected }, 2400) }
      : {}),
    ...(error.received !== undefined
      ? { received: diagnosticData({ value: error.received }, 1200) }
      : {}),
  };
}
