import { z } from 'zod';
import type { AnimValue } from '../core/core-types';
import { parameterError } from '../core/visual-capabilities';
import type {
  ParameterDefinition,
  VisualCapabilityDefinition,
} from '../core/visual-capabilities';
/** Agent declaration derives names, types, bounds and refinement from the canonical capability. */
function parameterSchema(spec: ParameterDefinition): z.ZodType<AnimValue> {
  let n = z.number().finite();
  if (spec.min !== undefined) n = n.min(spec.min);
  if (spec.max !== undefined) n = n.max(spec.max);
  let schema: z.ZodType<AnimValue>;
  switch (spec.type) {
    case 'vec2':
      schema = z.object({ x: n, y: n }).strict();
      break;
    case 'vec3':
      schema = z.array(n).length(3);
      break;
    case 'color':
      schema = z.array(n.min(0).max(1)).length(4);
      break;
    case 'gradientStops':
      schema = z.array(n.min(0).max(1)).min(10).max(160);
      break;
    case 'boolean':
      schema = z.union([z.literal(0), z.literal(1)]);
      break;
    case 'integer':
      schema = n.int();
      break;
    case 'enum':
      schema = n
        .int()
        .min(0)
        .max((spec.options?.length ?? 1) - 1);
      break;
    default:
      schema = n;
  }
  return schema
    .superRefine((value, ctx) => {
      const message = parameterError(spec, value);
      if (message) ctx.addIssue({ code: 'custom', message });
    })
    .describe(
      spec.name +
        (spec.unit ? ' (' + spec.unit + ')' : '') +
        (spec.type === 'gradientStops'
          ? '; flat ordered [position,r,g,b,a] groups, 2..32 stops'
          : ''),
    );
}
export function capabilityParametersSchema(
  definition: VisualCapabilityDefinition,
) {
  return z
    .object(
      Object.fromEntries(
        definition.parameters.map((spec) => [
          spec.id,
          parameterSchema(spec).optional(),
        ]),
      ),
    )
    .strict();
}
