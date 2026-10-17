import type { AIProviderManager } from '../ai/provider-manager';
import { registerReadTools } from '../agent/read-tools';
import { registerCompositingTools } from '../agent/compositing-tools';
import { AgentToolRegistry } from '../agent/tool-registry';
import {
  registerAnimationTools,
  registerCoreWriteTools,
} from '../agent/write-tools';
import type { AgentTransactionHost } from '../agent/transaction';
import type { PreviewRenderer, MutationScope } from './editor-adapter';
import {
  createIsolatedCoreV2,
  createEditorCoreV2,
  AgentPlanner,
  ProviderBridge,
} from './index';
import { problem } from './errors';
import type { TaskState } from './runtime';

/** Bind the existing configured transport once; no credentials or implicit failover here. */
export function createProviderCoreV2(options: {
  isolatedProject: boolean;
  betaOptIn?: true;
  host: AgentTransactionHost;
  manager: AIProviderManager;
  mode: 'tools' | 'structured-plan';
  scope: MutationScope;
  renderer: PreviewRenderer;
  selection?: readonly string[];
  time?: number;
}) {
  const { provider, model } = options.manager.resolve('planning');
  const bridge = new ProviderBridge(
    {
      chat: async (request, signal) => {
        const current = options.manager.resolve('planning');
        if (current.provider.id !== provider.id || current.model !== model)
          throw problem('PROVIDER_RESPONSE', '服务配置已变化，请重新发送任务', {
            phase: 'planning',
          });
        // One actual attempt. Manager continues to own accounting and credential access.
        return options.manager.chat('planning', request, signal, undefined, {
          singleAttempt: true,
        });
      },
    },
    provider,
    model,
    options.mode,
  );
  const planner = new AgentPlanner(bridge);
  const registry = registerReadTools(
    registerCompositingTools(
      registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
    ),
  );
  const ports = {
    ...options,
    registry,
    repair: ((action, error, signal, context) =>
      planner.repair(
        action,
        error,
        signal,
        context,
      )) as import('./recovery').RepairPort,
    budget: { providerRetries: 1 },
    requireRender: true,
  };
  if (!options.isolatedProject && options.betaOptIn !== true)
    throw problem('AUTHORIZATION_REQUIRED', '请明确选择V2 Beta');
  const runtime = options.isolatedProject
    ? createIsolatedCoreV2({ ...ports, isolatedProject: true })
    : createEditorCoreV2({ ...ports, betaOptIn: true });
  return {
    runtime,
    planner,
    registry,
    provider: provider.name,
    model,
    mode: options.mode,
  };
}

/** Safe developer export: excludes goals, text content, Scene, model bodies and images. */
export function exportCoreV2Diagnostic(
  state: TaskState | null,
  provider?: { provider: string; model: string; mode: string },
) {
  return JSON.stringify(
    {
      version: 2,
      runtime: 'core-v2-6',
      provider: provider
        ? {
            provider: provider.provider,
            model: provider.model,
            mode: provider.mode,
          }
        : null,
      isolated: true,
      task: state
        ? {
            id: state.id,
            phase: state.phase,
            baseVersion: state.baseVersion,
            sceneVersion: state.sceneVersion,
            modelRequests: state.modelRequests,
            actionAttempts: state.actionAttempts,
            recoveryAttempts: state.recoveryAttempts,
            deterministicRecoveries: state.deterministicRecoveries,
            providerRetries: state.providerRetries,
            draftDisposition: state.draftDisposition,
            budget: state.budget,
            completedActions: state.completedActions,
            pendingActions: state.pendingActions,
            recoveries: state.recoveries,
            requests: state.requests,
            steps: state.steps.map((step) => ({
              id: step.action.id,
              type: step.action.type,
              status: step.status,
              result: step.result,
              attempts: step.attempts,
              recoveryAttempts: step.recoveryAttempts,
              draftVersion: step.draftVersion,
              argumentFields:
                step.resolvedArguments &&
                typeof step.resolvedArguments === 'object'
                  ? Object.keys(step.resolvedArguments)
                  : [],
              failure: step.failure
                ? {
                    code: step.failure.code,
                    phase: step.failure.phase,
                    field: step.failure.field,
                  }
                : null,
            })),
            references: state.references,
            usage: state.usage,
            errors: state.errors.map((error) => ({
              code: error.code,
              phase: error.phase,
              actionId: error.actionId,
              field: error.field,
              recoverable: error.recoverable,
              strategy: error.strategy,
            })),
            verified: state.verification?.scene.status === 'PASSED',
            render: state.preview
              ? {
                  width: state.preview.width,
                  height: state.preview.height,
                  foregroundPixels: state.preview.foregroundPixels,
                }
              : null,
            committed: !!state.changes,
          }
        : null,
    },
    null,
    2,
  );
}
