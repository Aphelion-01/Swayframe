import { z } from 'zod';
import {
  command,
  CommandSystem,
  editPropertyCommand,
  transaction,
} from './command-system';
import type { Command, Transaction } from './command-system';
import { newId } from './core-types';
import { interpolationSchema } from './animation-engine';
import { activeComposition } from './project-model';
import type { Project } from './project-model';
import { colorSchema, idSchema, vec2Schema } from './project-schema';

const target = {
  layerId: idSchema,
  property: z.enum(['position', 'scale', 'rotation', 'opacity']),
  value: z.union([z.number().finite(), vec2Schema]),
  time: z.number().nonnegative(),
};
export const proposalSchema = z
  .object({
    id: idSchema,
    kind: z.enum(['layout', 'color', 'motion']),
    label: z.string().min(1).max(200),
    score: z.number().min(0).max(1).optional(),
    operations: z
      .array(
        z.discriminatedUnion('type', [
          z.object({ type: z.literal('property.set'), ...target }).strict(),
          z
            .object({
              type: z.literal('layer.fill'),
              layerId: idSchema,
              color: colorSchema,
            })
            .strict(),
          z
            .object({
              type: z.literal('keyframe.set'),
              ...target,
              interpolation: interpolationSchema,
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(500),
  })
  .strict();
export function proposalToTransaction(
  raw: unknown,
  project: Project,
): Transaction {
  const proposal = proposalSchema.parse(raw);
  const planner = new CommandSystem(project);
  const commands: Command[] = [];
  for (const operation of proposal.operations) {
    const c = activeComposition(planner.getSnapshot());
    const layer = c.layers.find((item) => item.id === operation.layerId);
    if (!layer || layer.locked) throw new Error('建议目标不存在或已锁定');
    let next: Command;
    if (operation.type === 'layer.fill')
      next = command({
        type: 'layer.patch',
        compositionId: c.id,
        layerId: layer.id,
        patch: { fill: operation.color },
      });
    else {
      if (operation.time > c.duration) throw new Error('建议时间超出合成时长');
      const p = layer.transform[operation.property];
      if (operation.type === 'property.set')
        next = editPropertyCommand(
          planner.getSnapshot(),
          p.id,
          operation.time,
          operation.value,
        );
      else {
        const existing = p.keyframes.find(
          (frame) => Math.abs(frame.time - operation.time) < 1e-8,
        );
        next = existing
          ? command({
              type: 'keyframe.update',
              propertyId: p.id,
              keyframeId: existing.id,
              patch: {
                value: operation.value,
                interpolation: operation.interpolation,
              },
            })
          : command({
              type: 'keyframe.add',
              propertyId: p.id,
              keyframe: {
                id: newId(),
                time: operation.time,
                value: operation.value,
                interpolation: operation.interpolation,
              },
            });
      }
    }
    const result = planner.executeTransaction(
      transaction('Validate Proposal', 'system', [next]),
    );
    if (!result.ok) throw new Error(result.error);
    commands.push(next);
  }
  return transaction(`智能建议：${proposal.label}`, 'human', commands);
}
