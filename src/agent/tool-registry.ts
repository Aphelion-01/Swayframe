import type { TransformInteractionSettings } from '../core/transform-context';
import type { TextMeasure } from '../core/text-geometry';
import { z } from 'zod';
import {
  CommandSystem,
  transaction,
  type Command,
} from '../core/command-system';
import { findProperty, type Project } from '../core/project-model';
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
          reason: issue.message,
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
    if (new Set(plan.steps.map((s) => s.id)).size !== plan.steps.length)
      throw new AgentToolError('invalid_arguments', '计划步骤标识重复');
    for (const step of plan.steps)
      this.parsed(step.tool, step.arguments, allowed);
    // Native writes are compiled and checked on a detached scene, never on the editor.
    // Forge/read stages require their real staged runtime; do not fabricate their outputs here.
    if (context) {
      const draft = new CommandSystem(context.project);
      let transform = context.transform;
      for (const step of plan.steps) {
        const parsed = this.parsed(step.tool, step.arguments, allowed);
        if (
          parsed.tool.permission === 'READ' ||
          step.tool.startsWith('effect_')
        )
          break;
        const ctx = { ...context, project: draft.getSnapshot(), transform };
        const commands = this.compile(
          step.tool,
          step.arguments,
          ctx,
          true,
          allowed,
        );
        if (commands.length) {
          const result = draft.executeTransaction(
            transaction('校验 ' + step.label, 'agent', commands),
          );
          if (!result.ok)
            throw new AgentToolError(
              'invalid_arguments',
              step.label + ': ' + result.error,
            );
        }
        validateMutation?.(context.project, draft.getSnapshot());
        const patch = this.workspacePatch(
          step.tool,
          step.arguments,
          ctx,
          allowed,
        );
        if (patch)
          transform = {
            ...transform,
            ...patch,
          } as TransformInteractionSettings;
      }
    }
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
      if (error instanceof AgentToolError) throw error;
      throw new AgentToolError(
        'tool_failed',
        error instanceof Error ? error.message : '读取工具失败',
      );
    }
  }
  verifyResults(commands: readonly Command[], project: Project) {
    const lastLayers = new Map<
      string,
      Extract<Command, { type: 'layer.create' | 'layer.replace' }>
    >();
    for (const op of commands)
      if (op.type === 'layer.create' || op.type === 'layer.replace')
        lastLayers.set(op.layer.id, op);
    const verified: string[] = [];
    for (const [id, op] of lastLayers) {
      const actual = project.compositions
        .find((c) => c.id === op.compositionId)
        ?.layers.find((l) => l.id === id);
      if (!actual || actual.type !== op.layer.type)
        throw new AgentToolError(
          'tool_failed',
          '结果校验失败：图层不存在或类型不符 ' + id,
        );
      if (
        actual.type === 'text' &&
        op.layer.type === 'text' &&
        (actual.text !== op.layer.text ||
          actual.fontFamily !== op.layer.fontFamily ||
          actual.fontSize !== op.layer.fontSize)
      )
        throw new AgentToolError(
          'tool_failed',
          '结果校验失败：文字内容或字体不符 ' + id,
        );
      if (
        actual.width !== op.layer.width ||
        actual.height !== op.layer.height ||
        JSON.stringify(actual.transform.position) !==
          JSON.stringify(op.layer.transform.position) ||
        actual.editor?.textAlign !== op.layer.editor?.textAlign ||
        actual.editor?.gradient !== op.layer.editor?.gradient
      )
        throw new AgentToolError(
          'tool_failed',
          '结果校验失败：图层几何、位置或外观模式不符 ' + id,
        );
      verified.push(id);
    }
    const bases = new Map<string, unknown>();
    for (const op of commands)
      if (op.type === 'property.setBase') bases.set(op.propertyId, op.value);
    for (const [id, value] of bases)
      if (
        JSON.stringify(findProperty(project, id).property.baseValue) !==
        JSON.stringify(value)
      )
        throw new AgentToolError(
          'tool_failed',
          '结果校验失败：属性值不符 ' + id,
        );
    const updates = new Map<
      string,
      { propertyId: string; patch: Record<string, unknown> }
    >();
    for (const op of commands)
      if (op.type === 'keyframe.update') {
        const previous = updates.get(op.keyframeId);
        updates.set(op.keyframeId, {
          propertyId: op.propertyId,
          patch: { ...previous?.patch, ...op.patch },
        });
      }
    for (const [id, op] of updates) {
      if (
        commands.some(
          (c) => c.type === 'keyframe.delete' && c.keyframeId === id,
        )
      )
        continue;
      const actual = findProperty(
        project,
        op.propertyId,
      ).property.keyframes.find((k) => k.id === id);
      if (
        !actual ||
        Object.entries(op.patch).some(
          ([key, value]) =>
            JSON.stringify(
              (actual as unknown as Record<string, unknown>)[key] ?? null,
            ) !== JSON.stringify(value ?? null),
        )
      )
        throw new AgentToolError(
          'tool_failed',
          '结果校验失败：关键帧修改不符 ' + id,
        );
    }
    const graphs = new Map<
      string,
      Extract<Command, { type: 'graph.replace' }>
    >();
    const frames = new Map<string, { propertyId: string; expected: unknown }>();
    for (const op of commands) {
      if (op.type === 'graph.replace') graphs.set(op.layerId, op);
      if (op.type === 'keyframe.add')
        frames.set(op.keyframe.id, {
          propertyId: op.propertyId,
          expected: op.keyframe,
        });
      if (op.type === 'keyframe.delete')
        frames.set(op.keyframeId, {
          propertyId: op.propertyId,
          expected: undefined,
        });
    }
    for (const [id, op] of graphs) {
      const actual =
        project.compositions
          .find((c) => c.id === op.compositionId)
          ?.layers.find((l) => l.id === id)?.editor?.graph ?? null;
      if (JSON.stringify(actual) !== JSON.stringify(op.graph))
        throw new AgentToolError(
          'tool_failed',
          '结果校验失败：节点、连接或参数不符 ' + id,
        );
    }
    for (const [id, frame] of frames) {
      const actual = findProperty(
        project,
        frame.propertyId,
      ).property.keyframes.find((k) => k.id === id);
      if (JSON.stringify(actual) !== JSON.stringify(frame.expected))
        throw new AgentToolError(
          'tool_failed',
          '结果校验失败：关键帧不符 ' + id,
        );
    }
    return {
      verifiedLayerIds: verified,
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
      if (error instanceof AgentToolError) throw error;
      throw new AgentToolError(
        'tool_failed',
        name + ': ' + (error instanceof Error ? error.message : '命令编译失败'),
      );
    }
  }
}
