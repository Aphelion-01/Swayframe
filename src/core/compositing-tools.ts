import { z } from 'zod';
import { idSchema, vec2Schema, animValueSchema } from './project-schema';
import { CompositingGraphService } from './compositing-service';
import type { CompositingHost } from './compositing-service';
import { CommandSystem } from './command-system';
import type { Project } from './project-model';
const ref = z
  .object({ nodeId: idSchema, portId: z.string().min(1).max(80) })
  .strict();
export const compositingToolSchemas = [
  z.object({ name: z.literal('inspectGraph'), layerId: idSchema }).strict(),
  z.object({ name: z.literal('compileGraph'), layerId: idSchema }).strict(),
  z
    .object({
      name: z.literal('createNode'),
      layerId: idSchema,
      type: z.string().min(1).max(80),
      nodeId: idSchema.optional(),
      position: vec2Schema.optional(),
      edgeId: idSchema.optional(),
    })
    .strict(),
  z.object({ name: z.literal('deleteNode'), nodeId: idSchema }).strict(),
  z.object({ name: z.literal('connectPorts'), from: ref, to: ref }).strict(),
  z.object({ name: z.literal('disconnectEdge'), edgeId: idSchema }).strict(),
  z
    .object({
      name: z.literal('setNodeParameter'),
      nodeId: idSchema,
      key: z.string().min(1).max(100),
      value: animValueSchema,
      time: z.number().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('setNodePosition'),
      nodeId: idSchema,
      position: vec2Schema,
    })
    .strict(),
  z
    .object({
      name: z.literal('enableNode'),
      nodeId: idSchema,
      enabled: z.boolean(),
    })
    .strict(),
] as const;
export const compositingToolSchema = z.discriminatedUnion(
  'name',
  compositingToolSchemas,
);
export type CompositingTool = z.infer<typeof compositingToolSchema>;
export function isCompositingTool(call: {
  name: string;
}): call is CompositingTool {
  return [
    'inspectGraph',
    'compileGraph',
    'createNode',
    'deleteNode',
    'connectPorts',
    'disconnectEdge',
    'setNodeParameter',
    'setNodePosition',
    'enableNode',
  ].includes(call.name);
}
export function runCompositingTool(
  host: CompositingHost,
  call: CompositingTool,
  time: number,
): unknown {
  const api = new CompositingGraphService(host, () => time, 'agent');
  switch (call.name) {
    case 'inspectGraph':
      return api.inspectGraph(call.layerId);
    case 'compileGraph':
      return api.compileGraph(call.layerId);
    case 'createNode':
      return api.createNode(call.layerId, call.type, call);
    case 'deleteNode':
      return api.deleteNode(call.nodeId);
    case 'connectPorts':
      return api.connectPorts(call.from, call.to);
    case 'disconnectEdge':
      return api.disconnectEdge(call.edgeId);
    case 'setNodeParameter':
      return api.setNodeParameter(
        call.nodeId,
        call.key,
        call.value,
        call.time ?? time,
      );
    case 'setNodePosition':
      return api.setNodePosition(call.nodeId, call.position);
    case 'enableNode':
      return api.enableNode(call.nodeId, call.enabled);
  }
}
export function compileCompositingTool(
  call: CompositingTool,
  project: Project,
  time: number,
) {
  const planner = new CommandSystem(project);
  runCompositingTool(planner, call, time);
  const commands = planner.undoStack.flatMap((e) => [
    ...e.transaction.commands,
  ]);
  if (!commands.length) throw new Error('只读节点工具不用于写入事务');
  return commands;
}
