import type { AgentTransactionHost } from '../agent/transaction';
import type { AgentToolRegistry } from '../agent/tool-registry';
import {
  EditorAdapter,
  type MutationScope,
  type PreviewRenderer,
} from './editor-adapter';
import { TaskRuntime, type ExecutionBudget } from './runtime';
import type { RepairPort } from './recovery';
import { problem } from './errors';
export const defaultAgentRuntime = 'legacy-v1' as const;
export type AgentRuntimeSelection = 'legacy-v1' | 'core-v2';
/** One active V2 runtime per host; the editor separately gates explicit V1/V2 selection. */
const active = new WeakMap<AgentTransactionHost, TaskRuntime>();
export function createIsolatedCoreV2(options: {
  isolatedProject: true;
  host: AgentTransactionHost;
  registry: AgentToolRegistry;
  scope: MutationScope;
  selection?: readonly string[];
  renderer?: PreviewRenderer;
  repair?: RepairPort;
  budget?: Partial<ExecutionBudget>;
  requireRender?: boolean;
  time?: number;
}) {
  if (options.isolatedProject !== true)
    throw problem(
      'AUTHORIZATION_REQUIRED',
      'V2 尚未通过正式迁移门禁，仅允许独立测试工程',
    );
  return createEditorCoreV2({ ...options, betaOptIn: true });
}
/** Same factory/runtime and transaction gate, now usable by the explicit editor Beta entry. */
export function createEditorCoreV2(options: {
  betaOptIn: true;
  host: AgentTransactionHost;
  registry: AgentToolRegistry;
  scope: MutationScope;
  selection?: readonly string[];
  renderer?: PreviewRenderer;
  repair?: RepairPort;
  budget?: Partial<ExecutionBudget>;
  requireRender?: boolean;
  time?: number;
}) {
  if (options.betaOptIn !== true)
    throw problem('AUTHORIZATION_REQUIRED', '请明确选择V2 Beta');
  const previous = active.get(options.host);
  if (
    previous &&
    !['COMPLETED', 'FAILED', 'CANCELLED', 'DISCARDED'].includes(
      previous.getSnapshot().phase,
    )
  )
    throw problem('COMMAND_REJECTION', '当前工程已有活动执行器');
  const runtime = new TaskRuntime(
    new EditorAdapter(
      options.host,
      options.registry,
      options.scope,
      options.selection ?? [],
      options.renderer,
      options.time,
    ),
    options.repair,
    options.budget,
    options.requireRender,
  );
  active.set(options.host, runtime);
  return runtime;
}
export { AgentPlanner, validateIntent } from './planner';
export { ProviderBridge } from './provider';
export { actionSchema, intentSchema } from './actions';
export { CoreV2Error } from './errors';
