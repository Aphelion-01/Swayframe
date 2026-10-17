import { z } from 'zod';
import { idSchema } from '../core/project-schema';
import {
  activeComposition,
  layerProperties,
  type Project,
} from '../core/project-model';
import type { AgentToolContext } from './tool-registry';
import { AgentExecutionError } from './execution-error';

export const objectOutputs = [
  'layerId',
  'nodeId',
  'propertyId',
  'maskId',
  'effectId',
  'edgeId',
  'compositionId',
  'keyframeId',
  'assetId',
] as const;
export type ObjectOutput = (typeof objectOutputs)[number];
export const agentObjectRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('existing'), id: idSchema }).strict(),
  z
    .object({ kind: z.literal('selection'), objectType: z.literal('layer') })
    .strict(),
  z
    .object({
      kind: z.literal('stepResult'),
      stepId: z.string().min(1).max(100),
      output: z.enum(objectOutputs),
    })
    .strict(),
  z.object({ kind: z.literal('graphNode'), nodeId: idSchema }).strict(),
]);
export type AgentObjectRef = z.infer<typeof agentObjectRefSchema>;
export type StepResultMap = Map<string, Partial<Record<ObjectOutput, string>>>;
const structuralId = '00000000-0000-4000-8000-000000000001';
type Schema = Record<string, unknown>;
export function isOutputField(tool: string, path: string) {
  return (
    (/^create(?:Shape|Layer|Rectangle|Ellipse|Polygon|Star|Path|Text|Solid|Null|Image|LayerFromAsset)$/.test(
      tool,
    ) &&
      path === 'layerId') ||
    (['createNode', 'reuseProgrammableEffect'].includes(tool) &&
      path === 'nodeId') ||
    (tool === 'addEffect' && path === 'effectId') ||
    (tool === 'createMask' && path === 'maskId') ||
    (tool === 'createComposition' && path === 'compositionId') ||
    (tool === 'addKeyframe' && path === 'keyframeId')
  );
}
function outputFor(field: string): ObjectOutput | undefined {
  const key = field.split('.').at(-1)!.replace(/s$/, '');
  if (key === 'parentId' || /LayerId$/.test(key)) return 'layerId';
  return objectOutputs.find((v) => v === key);
}
function compactReferenceSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compactReferenceSchema);
  if (value && typeof value === 'object') {
    const schema = value as Schema;
    return Object.fromEntries(
      Object.entries(schema)
        .filter(
          ([key]) =>
            key !== '$schema' &&
            !(key === 'pattern' && schema.format === 'uuid'),
        )
        .map(([key, v]) => [key, compactReferenceSchema(v)]),
    );
  }
  return value;
}
const publicReferenceSchema = compactReferenceSchema(
  z.toJSONSchema(agentObjectRefSchema),
);
export function referenceSchema(
  tool: string,
  schema: Schema,
  path = '',
): Schema {
  if (schema.format === 'uuid' && !isOutputField(tool, path))
    return {
      anyOf: [schema, publicReferenceSchema],
      description: 'Existing UUID or semantic reference. Never invent IDs.',
    };
  if (Array.isArray(schema.anyOf))
    return {
      ...schema,
      anyOf: schema.anyOf.map((s) => referenceSchema(tool, s as Schema, path)),
    };
  if (schema.properties)
    return {
      ...schema,
      properties: Object.fromEntries(
        Object.entries(schema.properties as Record<string, Schema>).map(
          ([k, s]) => [k, referenceSchema(tool, s, path ? path + '.' + k : k)],
        ),
      ),
    };
  if (schema.items)
    return {
      ...schema,
      items: referenceSchema(tool, schema.items as Schema, path),
    };
  return schema;
}
function failure(
  reason: string,
  tool: string,
  field: string,
  received: unknown,
  candidates?: unknown,
): never {
  throw new AgentExecutionError({
    code:
      reason === 'INVALID_UUID_FORMAT'
        ? 'INVALID_OBJECT_ID'
        : reason === 'VALID_UUID_BUT_NOT_FOUND'
          ? 'TARGET_NOT_FOUND'
          : 'CONTEXT_INVALID',
    phase: 'resolve',
    toolName: tool,
    field,
    received,
    recoverable: true,
    message:
      (field === 'assetId' ? '仅支持已导入素材；' : '') +
      `Object reference ${reason}: ${tool}.${field}`,
    cause: { reason, candidates },
  });
}
function entries(project: Project) {
  const values: { id: string; type: ObjectOutput; compositionId?: string }[] =
    [];
  for (const c of project.compositions) {
    values.push({ id: c.id, type: 'compositionId' });
    for (const l of c.layers) {
      const add = (id: string, type: ObjectOutput) =>
        values.push({ id, type, compositionId: c.id });
      add(l.id, 'layerId');
      for (const p of layerProperties(l)) {
        add(p.property.id, 'propertyId');
        for (const k of p.property.keyframes) add(k.id, 'keyframeId');
      }
      for (const n of l.editor?.graph?.nodes ?? []) {
        add(n.id, 'nodeId');
        if (!['source', 'output'].includes(n.type)) add(n.id, 'effectId');
      }
      for (const e of l.editor?.graph?.edges ?? []) add(e.id, 'edgeId');
      for (const m of l.editor?.masks ?? []) add(m.id, 'maskId');
      for (const e of l.editor?.effects ?? []) add(e.id, 'effectId');
    }
  }
  for (const a of project.assets) values.push({ id: a.id, type: 'assetId' });
  return values;
}
export function resolveArguments(
  tool: string,
  args: unknown,
  schema: Schema,
  context?: AgentToolContext,
  bindings?: StepResultMap,
  path = '',
): unknown {
  if (Array.isArray(schema.anyOf)) {
    const uuid = schema.anyOf.find((s) => (s as Schema).format === 'uuid');
    if (uuid && args !== null && args !== undefined)
      return resolveArguments(
        tool,
        args,
        uuid as Schema,
        context,
        bindings,
        path,
      );
  }
  if (schema.format === 'uuid') {
    if (args === null || args === undefined) return args;
    if (isOutputField(tool, path)) return args;
    let id: unknown = args;
    const type = outputFor(path);
    if (typeof args === 'object') {
      const parsed = agentObjectRefSchema.safeParse(args);
      if (!parsed.success)
        failure('UNRESOLVED_STEP_REFERENCE', tool, path, args);
      const ref = parsed.data;
      if (ref.kind === 'stepResult') {
        if (type && ref.output !== type)
          failure('WRONG_OBJECT_TYPE', tool, path, args);
        id = bindings?.get(ref.stepId)?.[ref.output];
        if (context && !id)
          failure('UNRESOLVED_STEP_REFERENCE', tool, path, args);
      } else if (ref.kind === 'selection') {
        if (type !== 'layerId') failure('WRONG_OBJECT_TYPE', tool, path, args);
        if (context && context.selection.length !== 1)
          failure(
            context.selection.length ? 'AMBIGUOUS_TARGET' : 'MISSING_TARGET',
            tool,
            path,
            args,
            context.selection,
          );
        id = context?.selection[0];
      } else if (ref.kind === 'graphNode') {
        if (type !== 'nodeId') failure('WRONG_OBJECT_TYPE', tool, path, args);
        id = ref.nodeId;
      } else id = ref.id;
      if (!context) id = structuralId;
    }
    if (!idSchema.safeParse(id).success)
      failure('INVALID_UUID_FORMAT', tool, path, args);
    if (context && type) {
      const found = entries(context.project).filter((v) => v.id === id);
      if (!found.length)
        failure(
          typeof args === 'object' &&
            (args as AgentObjectRef).kind === 'stepResult'
            ? 'STALE_OBJECT_REFERENCE'
            : 'VALID_UUID_BUT_NOT_FOUND',
          tool,
          path,
          args,
        );
      const target = found.find((v) => v.type === type);
      if (!target) failure('WRONG_OBJECT_TYPE', tool, path, args);
      if (
        target.compositionId &&
        target.compositionId !== activeComposition(context.project).id
      )
        failure('WRONG_COMPOSITION', tool, path, args);
    }
    return id;
  }
  if (
    schema.properties &&
    args &&
    typeof args === 'object' &&
    !Array.isArray(args)
  ) {
    const props = schema.properties as Record<string, Schema>;
    for (const k of (schema.required as string[] | undefined) ?? [])
      if (
        props[k]?.format === 'uuid' &&
        !(k in args) &&
        !isOutputField(tool, path ? path + '.' + k : k)
      )
        failure('MISSING_TARGET', tool, path ? path + '.' + k : k, null);
    return Object.fromEntries(
      Object.entries(args).map(([k, v]) => [
        k,
        props[k]
          ? resolveArguments(
              tool,
              v,
              props[k],
              context,
              bindings,
              path ? path + '.' + k : k,
            )
          : v,
      ]),
    );
  }
  if (schema.items && Array.isArray(args))
    return args.map((v) =>
      resolveArguments(
        tool,
        v,
        schema.items as Schema,
        context,
        bindings,
        path,
      ),
    );
  return args;
}
export function stepReferences(value: unknown): AgentObjectRef[] {
  if (!value || typeof value !== 'object') return [];
  const parsed = agentObjectRefSchema.safeParse(value);
  if (parsed.success) return [parsed.data];
  return Object.values(value).flatMap(stepReferences);
}
/** Bind only identities actually added to the shared draft, never planned UUIDs. */
export function createdOutputs(
  before: Project,
  after: Project,
  tool: string,
  args: unknown,
): Partial<Record<ObjectOutput, string>> {
  const old = new Set(entries(before).map((v) => v.type + ':' + v.id));
  const added = entries(after).filter((v) => !old.has(v.type + ':' + v.id));
  const outputs: Partial<Record<ObjectOutput, string>> = {};
  for (const type of objectOutputs) {
    let candidates = added.filter((v) => v.type === type);
    if (type === 'nodeId' && tool === 'createNode') {
      const wanted = (args as { type?: string }).type;
      const ids = after.compositions.flatMap((c) =>
        c.layers.flatMap(
          (l) =>
            l.editor?.graph?.nodes
              .filter((n) => n.type === wanted)
              .map((n) => n.id) ?? [],
        ),
      );
      candidates = candidates.filter((v) => ids.includes(v.id));
    }
    if (candidates.length === 1) outputs[type] = candidates[0]!.id;
  }
  return outputs;
}
