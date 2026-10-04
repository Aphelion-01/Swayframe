import { z } from 'zod';
import type { ChatResponse } from './contracts';
const recordSchema = z
  .object({
    at: z.number().finite(),
    providerId: z.string().uuid(),
    model: z.string().max(200),
    task: z.enum(['general', 'planning', 'vision']),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    cost: z.number().nonnegative().optional(),
  })
  .strict();
export const usageSchema = z
  .object({
    version: z.literal(1),
    records: z.array(recordSchema).max(500),
    days: z
      .array(
        z
          .object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            tokens: z.number().nonnegative(),
          })
          .strict(),
      )
      .max(31),
  })
  .strict();
export type AIUsage = z.infer<typeof usageSchema>;
export const emptyUsage = (): AIUsage => ({
  version: 1,
  records: [],
  days: [],
});
export const usageDate = (at = Date.now()) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function appendUsage(
  previous: AIUsage,
  providerId: string,
  model: string,
  task: 'general' | 'planning' | 'vision',
  usage: ChatResponse['usage'],
): AIUsage {
  if (!usage) return previous;
  const record = recordSchema.parse({
    at: Date.now(),
    providerId,
    model,
    task,
    ...usage,
  });
  const date = usageDate(record.at),
    day = previous.days.find((d) => d.date === date);
  return {
    version: 1,
    records: [...previous.records, record].slice(-500),
    days: [
      ...previous.days.filter((d) => d.date !== date),
      { date, tokens: (day?.tokens ?? 0) + record.totalTokens },
    ].slice(-31),
  };
}
