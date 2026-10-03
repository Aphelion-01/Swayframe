import {
  compositingToolSchemas,
  isCompositingTool,
  runCompositingTool,
  compileCompositingTool,
} from './compositing-tools';
import { z } from 'zod';
import { command, CommandSystem, transaction } from './command-system';
import type { Command, Transaction, TransactionResult } from './command-system';
import { newId } from './core-types';
import type { ID, Seconds } from './core-types';
import { activeComposition, createLayer } from './project-model';
import type { Project } from './project-model';
import { idSchema, vec2Schema } from './project-schema';
import { interpolationSchema } from './animation-engine';
import { createRenderSnapshot } from './renderer-core';

const property = z.enum(['position', 'scale', 'rotation', 'opacity']);
const value = z.union([z.number().finite(), vec2Schema]);
export const toolCallSchema = z.discriminatedUnion('name', [
  ...compositingToolSchemas,
  z.object({ name: z.literal('inspect_scene') }).strict(),
  z
    .object({
      name: z.literal('create_layer'),
      kind: z.enum(['rectangle', 'ellipse', 'text', 'image']),
      layerId: idSchema.optional(),
      layerName: z.string().min(1).max(200).optional(),
      position: vec2Schema.optional(),
      assetId: idSchema.optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('set_property'),
      layerId: idSchema,
      property,
      value,
    })
    .strict(),
  z
    .object({
      name: z.literal('add_keyframe'),
      layerId: idSchema,
      property,
      keyframeId: idSchema.optional(),
      time: z.number().nonnegative(),
      value,
      interpolation: interpolationSchema.optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('set_interpolation'),
      layerId: idSchema,
      property,
      keyframeId: idSchema,
      interpolation: interpolationSchema,
    })
    .strict(),
  z
    .object({
      name: z.literal('preview_frame'),
      time: z.number().nonnegative().optional(),
    })
    .strict(),
  z.object({ name: z.literal('undo_last_transaction') }).strict(),
]);
export type ToolCall = z.infer<typeof toolCallSchema>;
export interface AgentToolContext {
  getProjectSnapshot(): Project;
  executeTransaction(tx: Transaction): TransactionResult;
  getCurrentTime(): Seconds;
  getSelection(): readonly ID[];
  undoLastTransaction(): TransactionResult;
}
export type ToolResult =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly error: string };
export const DEMO_PROMPT =
  '创建蓝色方块，从左侧进入，1 秒到中心，轻微过冲并淡入';
const failure = (error: unknown): { ok: false; error: string } => ({
  ok: false,
  error: error instanceof Error ? error.message : '工具调用失败',
});
function compileTool(
  call: ToolCall,
  project: Project,
  time = 0,
): readonly Command[] {
  if (isCompositingTool(call))
    return compileCompositingTool(call, project, time);
  const c = activeComposition(project);
  if (call.name === 'create_layer') {
    const factory = createLayer(call.kind, {
      name: call.layerName,
      position: call.position ?? { x: c.width / 2, y: c.height / 2 },
      assetId: call.assetId,
    });
    const layer = call.layerId
      ? {
          ...factory,
          id: call.layerId,
          editor: factory.editor
            ? {
                ...factory.editor,
                graph: factory.editor.graph
                  ? {
                      ...factory.editor.graph,
                      owner: { type: 'layer' as const, id: call.layerId },
                    }
                  : undefined,
              }
            : undefined,
        }
      : factory;
    return [command({ type: 'layer.create', compositionId: c.id, layer })];
  }
  if (
    call.name === 'set_property' ||
    call.name === 'add_keyframe' ||
    call.name === 'set_interpolation'
  ) {
    const layer = c.layers.find((item) => item.id === call.layerId);
    if (!layer) throw new Error('工具目标 图层不存在');
    const propertyId = layer.transform[call.property].id;
    if (call.name === 'set_property')
      return [
        command({ type: 'property.setBase', propertyId, value: call.value }),
      ];
    if (call.name === 'add_keyframe')
      return [
        command({
          type: 'keyframe.add',
          propertyId,
          keyframe: {
            id: call.keyframeId ?? newId(),
            time: call.time,
            value: call.value,
            interpolation: call.interpolation ?? { type: 'linear' },
          },
        }),
      ];
    return [
      command({
        type: 'keyframe.update',
        propertyId,
        keyframeId: call.keyframeId,
        patch: { interpolation: call.interpolation },
      }),
    ];
  }
  throw new Error('该工具不是写入操作');
}
export class AgentBridge {
  constructor(private readonly context: AgentToolContext) {}
  executeTool(raw: unknown): ToolResult {
    try {
      const call = toolCallSchema.parse(raw);
      const project = this.context.getProjectSnapshot();
      if (isCompositingTool(call))
        return {
          ok: true,
          data: runCompositingTool(
            {
              getSnapshot: () => this.context.getProjectSnapshot(),
              executeTransaction: (tx) => this.context.executeTransaction(tx),
            },
            call,
            this.context.getCurrentTime(),
          ),
        };
      if (call.name === 'inspect_scene')
        return {
          ok: true,
          data: {
            project,
            selection: this.context.getSelection(),
            time: this.context.getCurrentTime(),
          },
        };
      if (call.name === 'preview_frame') {
        const c = activeComposition(project);
        const time = call.time ?? this.context.getCurrentTime();
        if (time > c.duration) throw new Error('预览时间超出合成时长');
        return {
          ok: true,
          data: createRenderSnapshot(c, time, this.context.getSelection()),
        };
      }
      if (call.name === 'undo_last_transaction') {
        const result = this.context.undoLastTransaction();
        return result.ok ? { ok: true, data: result } : result;
      }
      const commands = compileTool(call, project);
      const result = this.context.executeTransaction(
        transaction(`Agent：${call.name}`, 'agent', commands),
      );
      return result.ok
        ? { ok: true, data: { transactionId: result.transactionId, commands } }
        : result;
    } catch (error) {
      return failure(error);
    }
  }
  executeBatch(label: string, rawCalls: readonly unknown[]): TransactionResult {
    try {
      if (rawCalls.length === 0 || rawCalls.length > 500)
        throw new Error('工具调用数量必须为 1～500');
      const calls = rawCalls.map((raw) => toolCallSchema.parse(raw));
      // Validate dependent calls on an isolated CommandSystem; real Scene is committed once.
      const planner = new CommandSystem(this.context.getProjectSnapshot());
      const commands: Command[] = [];
      for (const call of calls) {
        const next = compileTool(
          call,
          planner.getSnapshot(),
          this.context.getCurrentTime(),
        );
        const result = planner.executeTransaction(
          transaction('Validate tool', 'agent', next),
        );
        if (!result.ok) throw new Error(result.error);
        commands.push(...next);
      }
      return this.context.executeTransaction(
        transaction(label, 'agent', commands),
      );
    } catch (error) {
      return failure(error);
    }
  }
  runDemo(prompt: string): TransactionResult & { readonly layerId?: ID } {
    if (prompt.trim().replace(/[。！!]$/, '') !== DEMO_PROMPT)
      return {
        ok: false,
        error: 'V0.1 使用固定 Mock Agent，请使用上方演示提示词',
      };
    const c = activeComposition(this.context.getProjectSnapshot());
    if (c.duration < 1) return { ok: false, error: '演示需要至少 1 秒的合成' };
    const layerId = newId();
    const start = { x: -120, y: c.height / 2 };
    const end = { x: c.width / 2, y: c.height / 2 };
    const result = this.executeBatch('Agent：蓝色方块入场', [
      {
        name: 'create_layer',
        kind: 'rectangle',
        layerId,
        layerName: '蓝色方块入场',
        position: start,
      },
      {
        name: 'add_keyframe',
        layerId,
        property: 'position',
        time: 0,
        value: start,
        interpolation: { type: 'spring', stiffness: 170, damping: 18, mass: 1 },
      },
      {
        name: 'add_keyframe',
        layerId,
        property: 'position',
        time: 1,
        value: end,
      },
      { name: 'add_keyframe', layerId, property: 'opacity', time: 0, value: 0 },
      { name: 'add_keyframe', layerId, property: 'opacity', time: 1, value: 1 },
    ]);
    return result.ok ? { ...result, layerId } : result;
  }
}
