import { AgentExecutionError } from './execution-error';
import { stepReferences, isOutputField } from './object-reference';
import type { AgentPlan, ToolPermission } from './session';
type Edge = { producer: string; consumer: string; field: string };
function invalid(
  message: string,
  field: string,
  taskId?: string,
  cause?: unknown,
  cycle = false,
): never {
  throw new AgentExecutionError({
    code: cycle ? 'PLAN_CYCLE_DETECTED' : 'PLAN_DEPENDENCY_INVALID',
    phase: 'preflight',
    field,
    taskId,
    recoverable: true,
    message,
    cause,
  });
}
/** Stable Kahn sort: original order breaks ties. Never deletes nodes or dependencies. */
export function stableTopologicalSort(
  ids: readonly string[],
  edges: readonly Edge[],
) {
  const pending = new Set(ids),
    ordered: string[] = [];
  while (pending.size) {
    const next = ids.find(
      (id) =>
        pending.has(id) &&
        !edges.some((e) => e.consumer === id && pending.has(e.producer)),
    );
    if (next === undefined)
      invalid(
        '计划包含循环依赖',
        'creation.tasks.dependencies',
        undefined,
        { cycle: [...pending] },
        true,
      );
    ordered.push(next);
    pending.delete(next);
  }
  return ordered;
}
export function dependencyGraph(
  plan: AgentPlan,
  externalSteps: ReadonlySet<string> = new Set(),
) {
  const ids = plan.steps.map((s) => s.id),
    tasks = plan.creation?.tasks ?? [];
  if (new Set(ids).size !== ids.length) invalid('计划步骤 ID 重复', 'steps.id');
  if (new Set(tasks.map((t) => t.id)).size !== tasks.length)
    invalid('创作任务 ID 重复', 'creation.tasks.id');
  const taskEdges: Edge[] = [],
    stepEdges: Edge[] = [],
    owner = new Map<string, string>();
  for (const t of tasks) {
    if (new Set(t.dependencies).size !== t.dependencies.length)
      invalid('任务存在重复依赖', 'creation.tasks.dependencies', t.id);
    for (const id of t.stepIds) {
      if (!ids.includes(id) || owner.has(id))
        invalid('任务步骤不存在或被重复分配', 'creation.tasks.stepIds', t.id, {
          stepId: id,
        });
      owner.set(id, t.id);
    }
    for (const dep of t.dependencies) {
      if (dep === t.id)
        invalid(
          '任务不能依赖自身',
          'creation.tasks.dependencies',
          t.id,
          { producer: dep, consumer: t.id },
          true,
        );
      const producer = tasks.find((p) => p.id === dep);
      if (!producer)
        invalid('依赖任务不存在', 'creation.tasks.dependencies', t.id, {
          producer: dep,
          consumer: t.id,
        });
      taskEdges.push({
        producer: dep,
        consumer: t.id,
        field: 'creation.tasks.dependencies',
      });
      for (const a of producer.stepIds)
        for (const b of t.stepIds)
          stepEdges.push({
            producer: a,
            consumer: b,
            field: 'creation.tasks.dependencies',
          });
    }
  }
  if (tasks.length && owner.size !== ids.length)
    invalid('任务必须恰好覆盖全部步骤', 'creation.tasks.stepIds', undefined, {
      missing: ids.filter((id) => !owner.has(id)),
    });
  for (const step of plan.steps)
    for (const ref of stepReferences(step.arguments)) {
      if (ref.kind !== 'stepResult' || externalSteps.has(ref.stepId)) continue;
      const producer = plan.steps.find((s) => s.id === ref.stepId);
      if (!producer)
        invalid(
          'Step Result 的生产步骤不存在',
          'steps.arguments.stepResult',
          owner.get(step.id),
          { producer: ref.stepId, consumer: step.id },
        );
      if (producer.id === step.id)
        invalid(
          '步骤不能引用自身结果',
          'steps.arguments.stepResult',
          owner.get(step.id),
          { producer: step.id, consumer: step.id },
          true,
        );
      if (
        !isOutputField(producer.tool, ref.output) &&
        !(producer.tool === 'addEffect' && ref.output === 'nodeId')
      )
        invalid(
          'Step Result 的生产工具不生成所需对象',
          'steps.arguments.stepResult',
          owner.get(step.id),
          {
            producer: producer.id,
            consumer: step.id,
            output: ref.output,
            tool: producer.tool,
          },
        );
      stepEdges.push({
        producer: ref.stepId,
        consumer: step.id,
        field: 'steps.arguments.stepResult',
      });
      const a = owner.get(producer.id),
        b = owner.get(step.id);
      if (
        a &&
        b &&
        a !== b &&
        !taskEdges.some((e) => e.producer === a && e.consumer === b)
      )
        taskEdges.push({
          producer: a,
          consumer: b,
          field: 'steps.arguments.stepResult',
        });
    }
  stableTopologicalSort(
    tasks.map((t) => t.id),
    taskEdges,
  );
  stableTopologicalSort(ids, stepEdges);
  return { taskEdges, stepEdges, owner };
}
export function validatePlanDependencies(
  plan: AgentPlan,
  externalSteps?: ReadonlySet<string>,
) {
  const graph = dependencyGraph(plan, externalSteps);
  for (const [ids, edges] of [
    [plan.creation?.tasks.map((t) => t.id) ?? [], graph.taskEdges],
    [plan.steps.map((s) => s.id), graph.stepEdges],
  ] as const)
    for (const e of edges)
      if (ids.indexOf(e.producer) >= ids.indexOf(e.consumer))
        invalid(
          '任务依赖与执行顺序不符',
          e.field,
          graph.owner.get(e.consumer) ?? e.consumer,
          {
            producer: e.producer,
            consumer: e.consumer,
            reason: 'producer scheduled after consumer',
          },
        );
  return graph;
}
export function repairDependencyOrder(
  plan: AgentPlan,
  permission: (tool: string, args: unknown) => ToolPermission,
): AgentPlan {
  const graph = dependencyGraph(plan),
    taskIds = plan.creation?.tasks.map((t) => t.id) ?? [];
  const edges = [...graph.stepEdges];
  // Preserve all mutating/opaque operations and every read's original Scene snapshot.
  // Only independent, pure inspections within the same snapshot may exchange order.
  const pure = (s: AgentPlan['steps'][number]) =>
    permission(s.tool, s.arguments) === 'READ' &&
    /^(inspect|get|find|query|discoverCapabilities|analyze(Layout|Color|Typography|Motion|Reference)$|effect_(search|inspect)$)/.test(
      s.tool,
    );
  const opaque = plan.steps.filter((s) => !pure(s));
  for (let i = 1; i < opaque.length; i++)
    edges.push({
      producer: opaque[i - 1]!.id,
      consumer: opaque[i]!.id,
      field: 'operation-order',
    });
  for (const s of plan.steps.filter(pure)) {
    const index = plan.steps.indexOf(s);
    for (const o of opaque)
      edges.push(
        plan.steps.indexOf(o) < index
          ? { producer: o.id, consumer: s.id, field: 'snapshot-order' }
          : { producer: s.id, consumer: o.id, field: 'snapshot-order' },
      );
  }
  let stepIds: string[];
  try {
    stepIds = stableTopologicalSort(
      plan.steps.map((s) => s.id),
      edges,
    );
  } catch {
    invalid(
      '依赖重排会改变不可交换操作或读取的场景，需局部重新规划',
      'creation.tasks.dependencies',
      undefined,
      { reason: 'operation/snapshot order constraint', edges: graph.stepEdges },
    );
  }
  const order = stableTopologicalSort(taskIds, graph.taskEdges);
  const repaired = {
    ...plan,
    steps: stepIds.map((id) => plan.steps.find((s) => s.id === id)!),
    ...(plan.creation
      ? {
          creation: {
            ...plan.creation,
            tasks: order.map((id) =>
              plan.creation!.tasks.find((t) => t.id === id)!,
            ),
          },
        }
      : {}),
  };
  validatePlanDependencies(repaired);
  return repaired;
}
