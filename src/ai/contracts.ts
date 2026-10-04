import { z } from 'zod';

export const capabilitySchema = z.enum([
  'text',
  'reasoning',
  'vision',
  'image',
  'embedding',
  'video',
]);
export type ModelCapability = z.infer<typeof capabilitySchema>;
export const modelSchema = z
  .object({
    id: z.string().min(1).max(200),
    name: z.string().max(200),
    capabilities: z.array(capabilitySchema).max(6),
  })
  .strict();
export type ModelInfo = z.infer<typeof modelSchema>;
export const providerSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    type: z.enum(['openai-compatible', 'mock']),
    baseUrl: z
      .string()
      .max(2000)
      .refine((v) => {
        try {
          const u = new URL(v);
          return (
            !u.username &&
            !u.password &&
            !u.search &&
            !u.hash &&
            (u.protocol === 'https:' ||
              (u.protocol === 'http:' &&
                ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)))
          );
        } catch {
          return false;
        }
      }, '使用 HTTPS 或本地 HTTP 地址，不包含凭证和查询参数'),
    enabled: z.boolean(),
    defaultModel: z.string().min(1).max(200),
    models: z.array(modelSchema).max(200),
  })
  .strict();
export type ProviderConfig = z.infer<typeof providerSchema>;
export const credentialsSchema = z
  .object({
    apiKey: z
      .string()
      .max(8192)
      .refine((v) => !/[\r\n\0]/.test(v), '密钥包含非法字符'),
    headers: z
      .record(
        z.string().regex(/^[A-Za-z0-9-]{1,100}$/),
        z
          .string()
          .max(8192)
          .refine((v) => !/[\r\n\0]/.test(v), '请求头包含非法字符'),
      )
      .refine(
        (h) =>
          Object.keys(h).length <= 20 &&
          Object.keys(h).every(
            (k) =>
              ![
                'host',
                'content-length',
                'connection',
                'authorization',
                'cookie',
              ].includes(k.toLowerCase()),
          ),
        '禁止覆盖传输或认证头',
      ),
  })
  .strict();
export type ProviderCredentials = z.infer<typeof credentialsSchema>;
const routeSchema = z
  .object({
    providerId: z.string().uuid(),
    modelId: z.string().min(1).max(200),
  })
  .strict()
  .nullable();
export const aiSettingsSchema = z
  .object({
    version: z.literal(1),
    providers: z.array(providerSchema).max(20),
    defaultProviderId: z.string().uuid().nullable(),
    routing: z
      .object({
        general: routeSchema,
        planning: routeSchema,
        vision: routeSchema,
      })
      .strict(),
    agent: z
      .object({
        mode: z.enum(['ASSIST', 'AGENT']),
        autoApplySafe: z.boolean(),
        confirmDestructive: z.boolean(),
        maxRefinements: z.number().int().min(0).max(2),
        visualVerification: z.boolean(),
        streaming: z.boolean(),
        defaultSkill: z.string().max(100),
        contextCharacters: z.number().int().min(4000).max(64000),
      })
      .strict(),
    privacy: z
      .object({
        sendRenderPreview: z.boolean(),
        sendReferences: z.boolean(),
        saveHistory: z.boolean(),
      })
      .strict(),
    failover: z
      .object({
        enabled: z.boolean(),
        maxRetries: z.number().int().min(0).max(2),
      })
      .strict(),
    budget: z
      .object({
        dailyTokens: z.number().int().nonnegative(),
        action: z.enum(['warn', 'stop']),
      })
      .strict(),
  })
  .strict();
export type AISettings = z.infer<typeof aiSettingsSchema>;
export const defaultAISettings = (): AISettings => ({
  version: 1,
  providers: [],
  defaultProviderId: null,
  routing: { general: null, planning: null, vision: null },
  agent: {
    mode: 'AGENT',
    autoApplySafe: true,
    confirmDestructive: true,
    maxRefinements: 2,
    visualVerification: true,
    streaming: true,
    defaultSkill: 'auto',
    contextCharacters: 16000,
  },
  privacy: { sendRenderPreview: true, sendReferences: true, saveHistory: true },
  failover: { enabled: true, maxRetries: 1 },
  budget: { dailyTokens: 0, action: 'warn' },
});
export const chatMessageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string().max(200000),
    toolCallId: z.string().max(200).optional(),
    images: z
      .array(
        z
          .string()
          .max(2000000)
          .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
      )
      .max(8)
      .optional(),
    toolCalls: z
      .array(
        z
          .object({ id: z.string(), name: z.string(), arguments: z.string() })
          .strict(),
      )
      .max(100)
      .optional(),
  })
  .strict();
export const toolDefinitionSchema = z
  .object({
    name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/),
    description: z.string().max(2000),
    parameters: z.record(z.string(), z.unknown()),
  })
  .strict();
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;
export const chatRequestSchema = z
  .object({
    model: z.string().min(1).max(200),
    messages: z.array(chatMessageSchema).min(1).max(80),
    tools: z.array(toolDefinitionSchema).max(120).optional(),
    toolChoice: z.string().max(64).optional(),
    stream: z.boolean().optional(),
  })
  .strict();
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export interface ChatResponse {
  text: string;
  toolCalls: { id: string; name: string; arguments: unknown }[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost?: number;
  };
  model: string;
}
export interface ConnectionResult {
  ok: boolean;
  message: string;
}
export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: readonly ModelCapability[];
  listModels(signal?: AbortSignal): Promise<ModelInfo[]>;
  testConnection(signal?: AbortSignal): Promise<ConnectionResult>;
  chat(
    request: ChatRequest,
    signal?: AbortSignal,
    onText?: (text: string) => void,
  ): Promise<ChatResponse>;
}
export type AIErrorCode =
  | 'setup'
  | 'network'
  | 'timeout'
  | 'rate_limit'
  | 'provider'
  | 'invalid_key'
  | 'invalid_request'
  | 'invalid_response'
  | 'cancelled';
export class AIError extends Error {
  constructor(
    readonly code: AIErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AIError';
  }
}
export interface AIStorage {
  loadSettings(): Promise<AISettings>;
  saveSettings(settings: AISettings): Promise<void>;
  setCredentials(
    providerId: string,
    credentials: ProviderCredentials,
  ): Promise<void>;
  removeCredentials(providerId: string): Promise<void>;
  hasCredentials(providerId: string): Promise<boolean>;
  storageStatus(): Promise<'secure' | 'memory-only' | 'unavailable'>;
  readData(key: 'usage' | 'skills' | 'history' | 'presets'): Promise<unknown>;
  writeData(
    key: 'usage' | 'skills' | 'history' | 'presets',
    data: unknown,
  ): Promise<void>;
}
export interface AITransport {
  chat(
    provider: ProviderConfig,
    request: ChatRequest,
    signal?: AbortSignal,
    onText?: (text: string) => void,
  ): Promise<ChatResponse>;
  listModels(
    provider: ProviderConfig,
    signal?: AbortSignal,
  ): Promise<ModelInfo[]>;
  testConnection(
    provider: ProviderConfig,
    signal?: AbortSignal,
  ): Promise<ConnectionResult>;
}
