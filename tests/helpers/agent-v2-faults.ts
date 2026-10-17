/** Test-only interception. Not imported by any product module. Real Registry/Commands still validate writes. */
import type { EditorAdapter } from '../../src/agent-v2/editor-adapter';
import type { AgentToolRegistry } from '../../src/agent/tool-registry';
import { AgentExecutionError } from '../../src/agent/execution-error';
import { problem } from '../../src/agent-v2/errors';
import { contentHash } from '../../src/core/content-hash';
export interface FaultSpec {
  actionId: string;
  mode: 'arguments' | 'missing-target' | 'stale' | 'reject' | 'after-write';
  times: number;
  field?: string;
  actual?: unknown;
}
export function installFaults(
  adapter: EditorAdapter,
  registry: AgentToolRegistry,
  specs: readonly FaultSpec[],
) {
  const remaining = specs.map((s) => ({ ...s, remaining: s.times }));
  const events: {
    actionId: string;
    mode: FaultSpec['mode'];
    beforeVersion: string;
    afterVersion: string;
    triggered: boolean;
  }[] = [];
  const executed: string[] = [];
  const execute = adapter.execute.bind(adapter),
    resolve = registry.resolve.bind(registry);
  let active: string | null = null;
  registry.resolve = (name, args, context, allowed) => {
    const fault = remaining.find(
      (s) => s.actionId === active && s.mode === 'arguments' && s.remaining > 0,
    );
    if (fault) {
      fault.remaining--;
      events.push({
        actionId: fault.actionId,
        mode: fault.mode,
        beforeVersion: contentHash(adapter.snapshot()),
        afterVersion: contentHash(adapter.snapshot()),
        triggered: true,
      });
      return resolve(
        name,
        { ...(args as Record<string, unknown>), [fault.field!]: fault.actual },
        context,
        allowed,
      );
    }
    return resolve(name, args, context, allowed);
  };
  adapter.execute = async (a, t, k, signal) => {
    executed.push(a.id);
    active = a.id;
    const fault = remaining.find(
      (s) => s.actionId === a.id && s.mode !== 'arguments' && s.remaining > 0,
    );
    try {
      if (fault) {
        fault.remaining--;
        const event = {
          actionId: a.id,
          mode: fault.mode,
          beforeVersion: contentHash(adapter.snapshot()),
          afterVersion: contentHash(adapter.snapshot()),
          triggered: true,
        };
        events.push(event);
        if (fault.mode === 'after-write') {
          const result = await execute(a, t, k, signal);
          event.afterVersion = contentHash(adapter.snapshot());
          void result;
          throw problem(
            'INVALID_ARGUMENTS',
            'Injected response rejection AFTER real write',
            {
              recoverable: true,
              strategy: 'FAILED_ACTION_ONLY',
              field: 'response',
            },
          );
        }
        if (fault.mode === 'missing-target')
          throw problem(
            'INVALID_REFERENCE',
            'Injected stale target resolution',
            {
              phase: 'resolving',
              recoverable: true,
              field: 'target',
              actual: crypto.randomUUID(),
            },
          );
        if (fault.mode === 'stale')
          throw problem('CONTEXT_STALE', 'Injected stale context', {
            recoverable: true,
            strategy: 'REFRESH_DRAFT',
          });
        throw new AgentExecutionError({
          code: 'COMMAND_FAILED',
          phase: 'execute',
          recoverable: true,
          message: 'Injected rejection BEFORE write',
        });
      }
      return await execute(a, t, k, signal);
    } finally {
      active = null;
    }
  };
  return {
    events,
    executed,
    remaining,
    add: (spec: FaultSpec) => {
      if (!Number.isInteger(spec.times) || spec.times < 1 || spec.times > 2)
        throw Error('Invalid test-only fault count');
      remaining.push({ ...spec, remaining: spec.times });
    },
  };
}
