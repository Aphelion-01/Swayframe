import { z } from 'zod';
import { easePresets } from '../core/curve-model';
import {
  CommandSystem,
  transaction,
  type Command,
} from '../core/command-system';
import { activeComposition } from '../core/project-model';
import { colorSchema, idSchema, animValueSchema } from '../core/project-schema';
import { interpolationSchema } from '../core/animation-engine';
import { radialGradientDefinition } from '../core/radial-gradient';
import { capabilityParametersSchema } from './capability-schema';
import { AgentToolRegistry, type AgentToolContext } from './tool-registry';
import { AgentExecutionError } from './execution-error';

/** Compose only existing validated compilers. The returned Commands are executed
 * exclusively by the caller's AgentTransaction; this sandbox is a dry run. */
export function compileSemanticActions(
  registry: AgentToolRegistry,
  context: AgentToolContext,
  actions: readonly { tool: string; arguments: unknown }[],
): readonly Command[] {
  const dry = new CommandSystem(context.project);
  const commands: Command[] = [];
  for (const action of actions) {
    const next = registry.compile(action.tool, action.arguments, {
      ...context,
      project: dry.getSnapshot(),
    });
    const result = dry.executeTransaction(
      transaction('语义预检', 'agent', next),
    );
    if (!result.ok)
      throw new AgentExecutionError({
        code: 'TOOL_ARGUMENT_INVALID',
        phase: 'compile',
        toolName: action.tool,
        recoverable: true,
        message: result.error,
      });
    commands.push(...next);
  }
  return commands;
}
export function registerSemanticActions(registry: AgentToolRegistry) {
  registry.register(
    'createShape',
    'Create a native editable shape; default rectangle, composition-center position. Real layerId is returned; reference it with stepResult.',
    z
      .object({
        kind: z
          .enum(['rectangle', 'ellipse', 'polygon', 'star'])
          .default('rectangle'),
        name: z.string().min(1).max(200).optional(),
        width: z.number().positive().max(16384).optional(),
        height: z.number().positive().max(16384).optional(),
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, { kind, ...args }) =>
        compileSemanticActions(registry, ctx, [
          {
            tool: 'create' + kind[0]!.toUpperCase() + kind.slice(1),
            arguments: args,
          },
        ]),
    },
  );
  registry.register(
    'placeAtCompositionCenter',
    'Place an existing native layer anchor at the actual current composition center in pixels. Does not infer dimensions from model prose.',
    z
      .object({ layerId: idSchema, time: z.number().nonnegative().optional() })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) => {
        const c = activeComposition(ctx.project);
        return compileSemanticActions(registry, ctx, [
          {
            tool: 'setPosition',
            arguments: { ...args, value: { x: c.width / 2, y: c.height / 2 } },
          },
        ]);
      },
    },
  );
  registry.register(
    'setGradientFill',
    'Apply native linear/radial fill preserving shape alpha. Colors are normalized {r,g,b,a}; radial parameters derive from the real radialGradient capability (center normalized, radius normalized, flat ordered stops). No detached graph generator.',
    z
      .object({
        layerId: idSchema,
        kind: z.enum(['linear', 'radial']),
        color: colorSchema,
        endColor: colorSchema,
        radialParameters: capabilityParametersSchema(
          radialGradientDefinition,
        ).optional(),
        time: z.number().nonnegative().optional(),
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, { kind, ...args }) => {
        if (kind === 'linear' && args.radialParameters)
          throw new AgentExecutionError({
            code: 'TOOL_ARGUMENT_INVALID',
            phase: 'compile',
            field: 'radialParameters',
            recoverable: true,
            message: '线性填充不接受径向参数',
          });
        return compileSemanticActions(registry, ctx, [
          { tool: 'setFill', arguments: { ...args, gradient: kind } },
        ]);
      },
    },
  );
  registry.register(
    'animateLayerProperty',
    'Create native Property keyframes using the actual target layer property path; times in seconds. Does not guess property UUID. Prefer easing=linear/easeIn/easeOut/easeInOut for standard timing. Explicit bezier out/in are BOTH control points of the entire outgoing normalized segment, not one tangent per keyframe; standard easeInOut out=(0.42,0), in=(0.58,1).',
    z
      .object({
        layerId: idSchema,
        property: z.string().min(1).max(100),
        easing: z
          .enum(['linear', 'hold', 'easeIn', 'easeOut', 'easeInOut'])
          .optional(),
        keyframes: z
          .array(
            z
              .object({
                time: z.number().nonnegative(),
                value: animValueSchema,
                interpolation: interpolationSchema.optional(),
              })
              .strict(),
          )
          .min(1)
          .max(40),
      })
      .strict(),
    'WRITE',
    {
      compile: (ctx, args) =>
        compileSemanticActions(
          registry,
          ctx,
          args.keyframes.map((k) => ({
            tool: 'addKeyframe',
            arguments: {
              layerId: args.layerId,
              property: args.property,
              ...k,
              ...(args.easing
                ? { interpolation: easePresets[args.easing] }
                : {}),
            },
          })),
        ),
    },
  );
  registry.register(
    'inspectToolContract',
    'Load authoritative tool schemas on demand. Catalog discovery never grants permission or executes writes.',
    z
      .object({ names: z.array(z.string().min(1).max(64)).min(1).max(12) })
      .strict(),
    'READ',
    {
      read: (_ctx, args) => args.names.map((name) => registry.contract(name)),
    },
  );
  return registry;
}
