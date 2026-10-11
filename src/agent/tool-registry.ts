import { AgentExecutionError, executionError } from './execution-error';
import type { TransformInteractionSettings } from '../core/transform-context';
import type { TextMeasure } from '../core/text-geometry';
import { z } from 'zod';
import {
  CommandSystem,
  transaction,
  type Command,
} from '../core/command-system';
import {
  findProperty,
  layerProperties,
  type Project,
} from '../core/project-model';
import type { ToolDefinition } from '../ai/contracts';
import type { AgentPlan, ToolPermission } from './session';
export interface AgentToolContext {
  transform?: TransformInteractionSettings;
  measure?: TextMeasure;
  project: Project;
  time: number;
  selection: readonly string[];
}
interface RegisteredTool {
  name: string;
  description: string;
  schema: z.ZodType;
  permission: ToolPermission;
  read?: (
    context: AgentToolContext,
    args: unknown,
    signal: AbortSignal,
  ) => unknown | Promise<unknown>;
  workspace?: (
    context: AgentToolContext,
    args: unknown,
  ) => Partial<TransformInteractionSettings>;
  compile?: (context: AgentToolContext, args: unknown) => readonly Command[];
}
export class AgentToolError extends Error {
  constructor(
    readonly code:
      | 'unknown_tool'
      | 'invalid_arguments'
      | 'permission_denied'
      | 'tool_failed',
    message: string,
    readonly details?: {
      tool: string;
      arguments: unknown;
      expectedSchema: unknown;
      issues: readonly {
        field: string;
        expected: unknown;
        received: unknown;
        reason: string;
        recoverable: boolean;
      }[];
      context?: unknown;
    },
  ) {
    super(message);
  }
}
export class AgentToolRegistry {
  private tools = new Map<string, RegisteredTool>();
  register<T>(
    name: string,
    description: string,
    schema: z.ZodType<T>,
    permission: ToolPermission,
    handler: {
      read?: (
        context: AgentToolContext,
        args: T,
        signal: AbortSignal,
      ) => unknown | Promise<unknown>;
      workspace?: (
        context: AgentToolContext,
        args: T,
      ) => Partial<TransformInteractionSettings>;
      compile?: (context: AgentToolContext, args: T) => readonly Command[];
    },
  ) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) || this.tools.has(name))
      throw new Error('工具标识无效或重复');
    if (
      (permission === 'READ' && !handler.read) ||
      (permission !== 'READ' && !handler.compile)
    )
      throw new Error('工具实现缺失');
    this.tools.set(name, {
      name,
      description,
      schema,
      permission,
      ...(handler.workspace
        ? {
            workspace: (context: AgentToolContext, args: unknown) =>
              handler.workspace!(context, args as T),
          }
        : {}),
      ...(handler.read
        ? {
            read: (context, args, signal) =>
              handler.read!(context, args as T, signal),
          }
        : {}),
      ...(handler.compile
        ? { compile: (context, args) => handler.compile!(context, args as T) }
        : {}),
    });
    return this;
  }
  definitions(allowed?: readonly string[]): ToolDefinition[] {
    return [...this.tools.values()]
      .filter((t) => !allowed || allowed.includes(t.name))
      .map((t) => ({
        name: t.name,
        description: t.description,
        parameters: z.toJSONSchema(t.schema) as Record<string, unknown>,
      }));
  }
  readDefinitions(): ToolDefinition[] {
    return this.definitions(
      [...this.tools.values()]
        .filter((t) => t.permission === 'READ')
        .map((t) => t.name),
    );
  }
  catalog() {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      permission: t.permission,
      parameters: z.toJSONSchema(t.schema) as Record<string, unknown>,
    }));
  }
  private parsed(name: string, args: unknown, allowed?: readonly string[]) {
    const tool = this.tools.get(name);
    if (!tool) throw new AgentToolError('unknown_tool', '未注册工具：' + name);
    if (allowed && !allowed.includes(name))
      throw new AgentToolError('permission_denied', '当前 Skill 不允许此工具');
    const parsed = tool.schema.safeParse(args);
    if (!parsed.success) {
      const schema = z.toJSONSchema(tool.schema);
      const issues = parsed.error.issues.map((issue) => {
        let received: unknown = args;
        let expected: unknown = schema;
        for (const key of issue.path) {
          received =
            received && typeof received === 'object'
              ? (received as Record<string, unknown>)[String(key)]
              : undefined;
          expected =
            expected && typeof expected === 'object'
              ? ((expected as { properties?: Record<string, unknown> })
                  .properties?.[String(key)] ?? expected)
              : expected;
        }
        return {
          field: issue.path.join('.') || '$',
          expected,
          received: received ?? null,
          reason:
            issue.code === 'unrecognized_keys' &&
            issue.path[0] === 'radialParameters'
              ? '未知径向渐变参数：' + issue.keys.join(', ')
              : issue.message,
          recoverable: true,
        };
      });
      throw new AgentToolError(
        'invalid_arguments',
        name +
          ' 参数校验失败：' +
          issues.map((i) => i.field + ' ' + i.reason).join('；'),
        { tool: name, arguments: args, expectedSchema: schema, issues },
      );
    }
    return { tool, args: parsed.data };
  }
  permission(name: string, args: unknown, allowed?: readonly string[]) {
    return this.parsed(name, args, allowed).tool.permission;
  }
  validatePlan(
    plan: AgentPlan,
    allowed?: readonly string[],
    context?: AgentToolContext,
    validateMutation?: (base: Project, next: Project) => void,
  ) {
    try {
      return this.validateStages(plan, allowed, context, validateMutation);
    } catch (error) {
      const problem = executionError(error, { phase: 'preflight' });
      throw new AgentExecutionError({
        ...problem,
        message: problem.message,
        phase: 'preflight',
        cause: { validationStatus: 'REJECTED', originalCause: problem.cause },
      });
    }
  }
  private validateStages(
    plan: AgentPlan,
    allowed?: readonly string[],
    context?: AgentToolContext,
    validateMutation?: (base: Project, next: Project) => void,
  ) {
    if (new Set(plan.steps.map((s) => s.id)).size !== plan.steps.length)
      throw new AgentToolError('invalid_arguments', '计划步骤标识重复');
    for (const step of plan.steps)
      this.parsed(step.tool, step.arguments, allowed);
    const steps: {
      stepId: string;
      status: 'VERIFIED' | 'DEFERRED';
      reason?: string;
    }[] = [];
    // Validate dependency topology independently of optional creation capability resolution.
    if (plan.creation) {
      const assigned = new Set<string>();
      const done = new Set<string>();
      for (const task of plan.creation.tasks) {
        if (
          done.has(task.id) ||
          task.dependencies.some((id) => !done.has(id)) ||
          task.stepIds.some(
            (id) =>
              assigned.has(id) || !plan.steps.some((step) => step.id === id),
          )
        )
          throw new AgentExecutionError({
            code: 'SCHEMA_INVALID',
            phase: 'preflight',
            field: 'creation.tasks',
            recoverable: true,
            message: '创作任务依赖或步骤分配无效',
          });
        for (const dep of task.dependencies) {
          const previous = plan.creation.tasks.find((t) => t.id === dep)!;
          if (
            Math.max(
              ...previous.stepIds.map((id) =>
                plan.steps.findIndex((s) => s.id === id),
              ),
            ) >=
            Math.min(
              ...task.stepIds.map((id) =>
                plan.steps.findIndex((s) => s.id === id),
              ),
            )
          )
            throw new AgentExecutionError({
              code: 'SCHEMA_INVALID',
              phase: 'preflight',
              field: 'creation.tasks.dependencies',
              recoverable: true,
              message: '任务依赖与执行顺序不符',
            });
        }
        task.stepIds.forEach((id) => assigned.add(id));
        done.add(task.id);
      }
      if (assigned.size !== plan.steps.length)
        throw new AgentExecutionError({
          code: 'SCHEMA_INVALID',
          phase: 'preflight',
          field: 'creation.tasks.stepIds',
          recoverable: true,
          message: '任务必须覆盖所有步骤',
        });
    }
    if (!context)
      return {
        steps: plan.steps.map((s) => ({
          stepId: s.id,
          status: 'DEFERRED' as const,
          reason: 'Requires live draft context',
        })),
      };
    const draft = new CommandSystem(context.project);
    let transform = context.transform;
    const deferred = new Set<string>();
    const uncertainLayers = new Set<string>();
    let uncertainComposition = false;
    for (const step of plan.steps) {
      const parsed = this.parsed(step.tool, step.arguments, allowed);
      const ctx = { ...context, project: draft.getSnapshot(), transform };
      const task = plan.creation?.tasks.find((t) =>
        t.stepIds.includes(step.id),
      );
      const dependsOnDeferred =
        task?.dependencies.some((id) =>
          plan
            .creation!.tasks.find((t) => t.id === id)
            ?.stepIds.some((id) => deferred.has(id)),
        ) || task?.stepIds.some((id) => deferred.has(id));
      const layerId = step.arguments.layerId;
      // Read tools may have real asynchronous side effects (Forge drafts or paid analysis).
      // Never run them in a preflight; structural checks above still apply to every step.
      if (parsed.tool.permission === 'READ') {
        steps.push({
          stepId: step.id,
          status: 'DEFERRED',
          reason: 'Read resolves against the live draft at execution',
        });
        if (
          step.tool.startsWith('effect_') &&
          !['effect_list', 'effect_search', 'effect_inspect'].includes(
            step.tool,
          )
        )
          deferred.add(step.id);
        continue;
      }
      if (
        step.tool.startsWith('effect_') ||
        dependsOnDeferred ||
        uncertainComposition ||
        (typeof layerId === 'string' && uncertainLayers.has(layerId))
      ) {
        deferred.add(step.id);
        if (typeof layerId === 'string') uncertainLayers.add(layerId);
        else uncertainComposition = true;
        steps.push({
          stepId: step.id,
          status: 'DEFERRED',
          reason:
            'Requires an actual earlier Forge/deferred result; no fabricated entities',
        });
        continue;
      }
      const commands = this.compile(
        step.tool,
        step.arguments,
        ctx,
        true,
        allowed,
      );
      if (commands.length) {
        const before = draft.getSnapshot();
        const result = draft.executeTransaction(
          transaction('校验 ' + step.label, 'agent', commands),
        );
        if (!result.ok)
          throw new AgentExecutionError({
            code: 'COMMAND_FAILED',
            phase: 'preflight',
            toolName: step.tool,
            recoverable: false,
            message: step.label + ': ' + result.error,
          });
        this.verifyResults(commands, draft.getSnapshot(), before);
      }
      validateMutation?.(context.project, draft.getSnapshot());
      const patch = this.workspacePatch(
        step.tool,
        step.arguments,
        ctx,
        allowed,
      );
      if (patch)
        transform = { ...transform, ...patch } as TransformInteractionSettings;
      steps.push({ stepId: step.id, status: 'VERIFIED' });
    }
    return { steps };
  }

  async read(
    name: string,
    args: unknown,
    context: AgentToolContext,
    signal: AbortSignal,
    allowed?: readonly string[],
  ) {
    signal.throwIfAborted();
    const parsed = this.parsed(name, args, allowed);
    if (parsed.tool.permission !== 'READ' || !parsed.tool.read)
      throw new AgentToolError('permission_denied', '规划阶段只能读取工程');
    try {
      const result = await parsed.tool.read(context, parsed.args, signal);
      signal.throwIfAborted();
      return result;
    } catch (error) {
      if (signal.aborted) throw error;
      if (
        error instanceof AgentToolError ||
        error instanceof AgentExecutionError
      )
        throw error;
      throw executionError(error, {
        code: 'CONTEXT_INVALID',
        phase: 'read',
        toolName: name,
        recoverable: false,
      });
    }
  }
  verifyResults(
    commands: readonly Command[],
    project: Project,
    base?: Project,
  ) {
    const failure = (message: string): never => {
      throw new AgentExecutionError({
        code: 'VERIFICATION_FAILED',
        phase: 'verify',
        recoverable: false,
        message: '结果校验失败：' + message,
      });
    };
    const layers = new Map<
      string,
      Extract<Command, { type: 'layer.create' | 'layer.replace' }> | undefined
    >();
    const removedProperties = new Set<string>();
    const bases = new Map<string, unknown>();
    const graphs = new Map<
      string,
      Extract<Command, { type: 'graph.replace' }>
    >();
    const frames = new Map<
      string,
      {
        propertyId: string;
        expected?: Record<string, unknown>;
        patch?: Record<string, unknown>;
        removed?: boolean;
      }
    >();
    for (const op of commands) {
      if (op.type === 'layer.create' || op.type === 'layer.replace')
        layers.set(op.layer.id, structuredClone(op));
      if (op.type === 'layer.delete') {
        const previous = layers.get(op.layerId);
        if (previous)
          for (const { property } of layerProperties(previous.layer))
            removedProperties.add(property.id);
        layers.set(op.layerId, undefined);
        graphs.delete(op.layerId);
      }
      if (op.type === 'layer.patch') {
        const previous = layers.get(op.layerId);
        if (previous)
          layers.set(op.layerId, {
            ...previous,
            layer: { ...previous.layer, ...op.patch } as typeof previous.layer,
          });
      }
      if (op.type === 'property.setBase') bases.set(op.propertyId, op.value);
      if (op.type === 'graph.replace') graphs.set(op.layerId, op);
      if (op.type === 'keyframe.add')
        frames.set(op.keyframe.id, {
          propertyId: op.propertyId,
          expected: structuredClone(op.keyframe) as unknown as Record<
            string,
            unknown
          >,
        });
      if (op.type === 'keyframe.update') {
        const previous = frames.get(op.keyframeId);
        frames.set(op.keyframeId, {
          propertyId: op.propertyId,
          ...(previous?.expected
            ? { expected: { ...previous.expected, ...op.patch } }
            : { patch: { ...previous?.patch, ...op.patch } }),
        });
      }
      if (op.type === 'keyframe.delete')
        frames.set(op.keyframeId, { propertyId: op.propertyId, removed: true });
    }
    if (base) {
      const replay = new CommandSystem(base);
      const result = replay.executeTransaction(
        transaction('Agent最终态验证', 'agent', commands),
      );
      if (!result.ok) failure(result.error);
      if (JSON.stringify(replay.getSnapshot()) !== JSON.stringify(project))
        failure('Scene 与按命令顺序归约的最终状态不符');
    } else {
      // Compatibility for diagnostic callers without a base: verify ordered touched entities.
      for (const [id, op] of layers) {
        const actual = project.compositions
          .flatMap((c) => c.layers)
          .find((l) => l.id === id);
        if (!op) {
          if (actual) failure('图层删除未生效 ' + id);
          continue;
        }
        if (!actual || actual.type !== op.layer.type)
          failure('图层不存在或类型不符 ' + id);
        if (
          actual!.type === 'text' &&
          op.layer.type === 'text' &&
          (actual!.text !== op.layer.text ||
            actual!.fontFamily !== op.layer.fontFamily ||
            actual!.fontSize !== op.layer.fontSize)
        )
          failure('文字内容或字体不符 ' + id);
        if (
          actual!.width !== op.layer.width ||
          actual!.height !== op.layer.height ||
          actual!.editor?.textAlign !== op.layer.editor?.textAlign ||
          actual!.editor?.gradient !== op.layer.editor?.gradient
        )
          failure('图层几何、位置或外观模式不符 ' + id);
        for (const [key, property] of Object.entries(op.layer.transform)) {
          if (
            bases.has(property.id) ||
            [...frames.values()].some((f) => f.propertyId === property.id)
          )
            continue;
          if (
            JSON.stringify(
              actual!.transform[key as keyof typeof op.layer.transform],
            ) !== JSON.stringify(property)
          )
            failure('图层位置或变换不符 ' + id);
        }
      }
      for (const [id, value] of bases) {
        // A removed layer/property is no longer an expected surviving entity.
        let actual;
        try {
          actual = findProperty(project, id).property;
        } catch {
          if (removedProperties.has(id)) continue;
          failure('属性不存在 ' + id);
        }
        if (JSON.stringify(actual!.baseValue) !== JSON.stringify(value))
          failure('属性值不符 ' + id);
      }
      for (const [id, op] of graphs) {
        const actual =
          project.compositions.flatMap((c) => c.layers).find((l) => l.id === id)
            ?.editor?.graph ?? null;
        if (JSON.stringify(actual) !== JSON.stringify(op.graph))
          failure('节点、连接或参数不符 ' + id);
      }
      for (const [id, op] of frames) {
        let actual;
        try {
          actual = findProperty(project, op.propertyId).property.keyframes.find(
            (k) => k.id === id,
          );
        } catch {
          if (removedProperties.has(op.propertyId)) continue;
          failure('关键帧属性不存在 ' + id);
        }
        if (
          op.removed
            ? !!actual
            : op.expected
              ? JSON.stringify(actual) !== JSON.stringify(op.expected)
              : !actual ||
                Object.entries(op.patch ?? {}).some(
                  ([key, value]) =>
                    JSON.stringify(
                      (actual as unknown as Record<string, unknown>)[key] ??
                        null,
                    ) !== JSON.stringify(value ?? null),
                )
        )
          failure('关键帧不符 ' + id);
      }
    }
    return {
      verifiedLayerIds: [...layers.keys()],
      verifiedPropertyIds: [...bases.keys()],
      verifiedGraphLayerIds: [...graphs.keys()],
      verifiedKeyframeIds: [...frames.keys()],
    };
  }
  workspacePatch(
    name: string,
    args: unknown,
    context: AgentToolContext,
    allowed?: readonly string[],
  ) {
    const parsed = this.parsed(name, args, allowed);
    return parsed.tool.workspace?.(context, parsed.args);
  }
  compile(
    name: string,
    args: unknown,
    context: AgentToolContext,
    confirmedDestructive = false,
    allowed?: readonly string[],
  ): readonly Command[] {
    const parsed = this.parsed(name, args, allowed);
    if (parsed.tool.permission === 'READ' || !parsed.tool.compile)
      throw new AgentToolError('permission_denied', '该工具不是写入操作');
    if (parsed.tool.permission === 'DESTRUCTIVE' && !confirmedDestructive)
      throw new AgentToolError('permission_denied', '危险操作尚未确认');
    try {
      return parsed.tool.compile(context, parsed.args);
    } catch (error) {
      if (
        error instanceof AgentToolError ||
        error instanceof AgentExecutionError
      )
        throw error;
      throw executionError(error, {
        code: 'SEMANTIC_INVALID',
        phase: 'compile',
        toolName: name,
        recoverable: false,
      });
    }
  }
}
