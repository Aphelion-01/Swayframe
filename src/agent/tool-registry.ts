import type { TransformInteractionSettings } from '../core/transform-context';
import type { TextMeasure } from '../core/text-geometry';
import { z } from 'zod';
import type { Command } from '../core/command-system';
import type { Project } from '../core/project-model';
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
  private parsed(name: string, args: unknown, allowed?: readonly string[]) {
    const tool = this.tools.get(name);
    if (!tool) throw new AgentToolError('unknown_tool', '未注册工具：' + name);
    if (allowed && !allowed.includes(name))
      throw new AgentToolError('permission_denied', '当前 Skill 不允许此工具');
    const parsed = tool.schema.safeParse(args);
    if (!parsed.success)
      throw new AgentToolError('invalid_arguments', name + ' 参数无效');
    return { tool, args: parsed.data };
  }
  permission(name: string, args: unknown, allowed?: readonly string[]) {
    return this.parsed(name, args, allowed).tool.permission;
  }
  validatePlan(plan: AgentPlan, allowed?: readonly string[]) {
    if (new Set(plan.steps.map((s) => s.id)).size !== plan.steps.length)
      throw new AgentToolError('invalid_arguments', '计划步骤标识重复');
    for (const step of plan.steps)
      this.parsed(step.tool, step.arguments, allowed);
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
    return parsed.tool.compile(context, parsed.args);
  }
}
