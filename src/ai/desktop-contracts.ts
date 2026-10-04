import { z } from 'zod';
import {
  aiSettingsSchema,
  chatRequestSchema,
  credentialsSchema,
} from './contracts';
import type {
  AIStorage,
  ChatRequest,
  ChatResponse,
  ModelInfo,
  ConnectionResult,
} from './contracts';
const id = z.string().uuid();
const dataKey = z.enum(['usage', 'skills', 'history', 'presets']);
export const aiRequestSchemas = [
  z.object({ method: z.literal('ai.settings.load') }).strict(),
  z
    .object({
      method: z.literal('ai.settings.save'),
      settings: aiSettingsSchema,
    })
    .strict(),
  z
    .object({
      method: z.literal('ai.credentials.set'),
      providerId: id,
      credentials: credentialsSchema,
    })
    .strict(),
  z
    .object({ method: z.literal('ai.credentials.remove'), providerId: id })
    .strict(),
  z
    .object({ method: z.literal('ai.credentials.has'), providerId: id })
    .strict(),
  z.object({ method: z.literal('ai.storage.status') }).strict(),
  z.object({ method: z.literal('ai.data.read'), key: dataKey }).strict(),
  z
    .object({
      method: z.literal('ai.data.write'),
      key: dataKey,
      data: z.string().max(4000000),
    })
    .strict(),
  z
    .object({
      method: z.literal('ai.chat'),
      providerId: id,
      requestId: id,
      request: chatRequestSchema,
    })
    .strict(),
  z.object({ method: z.literal('ai.cancel'), requestId: id }).strict(),
  z.object({ method: z.literal('ai.models'), providerId: id }).strict(),
  z.object({ method: z.literal('ai.test'), providerId: id }).strict(),
  z.object({ method: z.literal('ai.chunks'), requestId: id }).strict(),
] as const;
export const aiRequestSchema = z.discriminatedUnion('method', aiRequestSchemas);
export type AIRequest = z.infer<typeof aiRequestSchema>;
export interface DesktopAIAPI extends AIStorage {
  chat(
    providerId: string,
    requestId: string,
    request: ChatRequest,
  ): Promise<ChatResponse>;
  cancel(requestId: string): Promise<void>;
  models(providerId: string): Promise<ModelInfo[]>;
  test(providerId: string): Promise<ConnectionResult>;
  chunks(requestId: string): Promise<string[]>;
}
