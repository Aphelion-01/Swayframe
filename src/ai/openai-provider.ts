import { z } from 'zod';
import {
  AIError,
  chatRequestSchema,
  credentialsSchema,
  providerSchema,
} from './contracts';
import type {
  AIProvider,
  ChatRequest,
  ChatResponse,
  ModelInfo,
  ProviderConfig,
  ProviderCredentials,
} from './contracts';
const toolSchema = z.object({
  id: z.string().max(200),
  type: z.literal('function'),
  function: z.object({
    name: z.string().max(64),
    arguments: z.string().max(200000),
  }),
});
const completionSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z.array(toolSchema).max(100).optional(),
        }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
      total_tokens: z.number().int().nonnegative(),
      cost: z.number().nonnegative().optional(),
    })
    .optional(),
});
function response(raw: unknown, model: string): ChatResponse {
  const parsed = completionSchema.safeParse(raw);
  if (!parsed.success)
    throw new AIError('invalid_response', '服务返回了无效响应');
  const value = parsed.data;
  if (
    ['length', 'content_filter'].includes(value.choices[0]!.finish_reason ?? '')
  )
    throw new AIError(
      'invalid_response',
      '服务未返回完整结果，请调整请求后重试',
    );
  return {
    text: value.choices[0]!.message.content ?? '',
    model: value.model ?? model,
    toolCalls: (value.choices[0]!.message.tool_calls ?? []).map((t) => {
      let args: unknown;
      try {
        args = JSON.parse(t.function.arguments);
      } catch {
        throw new AIError('invalid_response', '工具参数不是完整 JSON');
      }
      return { id: t.id, name: t.function.name, arguments: args };
    }),
    ...(value.usage
      ? {
          usage: {
            inputTokens: value.usage.prompt_tokens,
            outputTokens: value.usage.completion_tokens,
            totalTokens: value.usage.total_tokens,
            ...(value.usage.cost !== undefined
              ? { cost: value.usage.cost }
              : {}),
          },
        }
      : {}),
  };
}
export class OpenAICompatibleProvider implements AIProvider {
  readonly config: ProviderConfig;
  constructor(
    config: ProviderConfig,
    private readonly credentials: () => Promise<ProviderCredentials>,
    private readonly fetcher: typeof fetch = fetch,
    private readonly options: {
      timeoutMs?: number;
      maxResponseBytes?: number;
    } = {},
  ) {
    this.config = providerSchema.parse(config);
  }
  get id() {
    return this.config.id;
  }
  get name() {
    return this.config.name;
  }
  get capabilities() {
    return [...new Set(this.config.models.flatMap((m) => m.capabilities))];
  }
  private async request<T>(
    endpoint: string,
    body: unknown | undefined,
    signal: AbortSignal | undefined,
    parse: (r: Response, signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (signal?.aborted) throw new AIError('cancelled', '已停止');
    const controller = new AbortController();
    let timeout = false;
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => {
      timeout = true;
      controller.abort();
    }, this.options.timeoutMs ?? 45000);
    try {
      const credentials = credentialsSchema.parse(await this.credentials());
      if (!credentials.apiKey.trim())
        throw new AIError('setup', '请在设置 → AI 配置密钥');
      if (controller.signal.aborted)
        throw new AIError(
          timeout ? 'timeout' : 'cancelled',
          timeout ? '服务请求超时' : '已停止',
        );
      const result = await this.fetcher(
        this.config.baseUrl
          .replace(/\/+$/, '')
          .replace(/\/(?:chat\/completions|models)$/, '') + endpoint,
        {
          method: body === undefined ? 'GET' : 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            ...credentials.headers,
            Authorization: `Bearer ${credentials.apiKey}`,
            'Content-Type': 'application/json',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
      );
      if (!result.ok) {
        await result.body?.cancel();
        const code =
          result.status === 401 || result.status === 403
            ? 'invalid_key'
            : result.status === 429
              ? 'rate_limit'
              : result.status >= 500
                ? 'provider'
                : 'invalid_request';
        throw new AIError(
          code,
          code === 'invalid_key'
            ? '密钥无效或无访问权限，请检查服务设置'
            : code === 'rate_limit'
              ? '服务请求达到速率限制'
              : code === 'provider'
                ? '模型服务暂时不可用'
                : '请求或模型不可用，请检查服务设置',
        );
      }
      return await parse(result, controller.signal);
    } catch (error) {
      if (controller.signal.aborted)
        throw new AIError(
          timeout ? 'timeout' : 'cancelled',
          timeout ? '服务请求超时' : '已停止',
        );
      if (error instanceof AIError) throw error;
      throw new AIError('network', '无法连接模型服务，请检查地址与网络');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
  private async boundedText(result: Response, signal: AbortSignal) {
    const reader = result.body?.getReader();
    if (!reader) throw new AIError('invalid_response', '服务返回空响应');
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        signal.throwIfAborted();
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > (this.options.maxResponseBytes ?? 2000000))
          throw new AIError('invalid_response', '服务响应超过大小限制');
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder().decode(bytes);
  }
  async listModels(signal?: AbortSignal): Promise<ModelInfo[]> {
    return this.request('/models', undefined, signal, async (r, s) => {
      let raw: unknown;
      try {
        raw = JSON.parse(await this.boundedText(r, s));
      } catch (e) {
        if (e instanceof AIError) throw e;
        throw new AIError('invalid_response', '模型列表格式无效');
      }
      const parsed = z
        .object({
          data: z.array(z.object({ id: z.string().min(1).max(200) })).max(5000),
        })
        .safeParse(raw);
      if (!parsed.success)
        throw new AIError('invalid_response', '模型列表格式无效');
      const preferred = parsed.data.data.find(
        (m) => m.id === this.config.defaultModel,
      );
      const visible = [
        ...(preferred ? [preferred] : []),
        ...parsed.data.data.filter((m) => m.id !== preferred?.id),
      ].slice(0, 200);
      return visible.map(
        (m) =>
          this.config.models.find((v) => v.id === m.id) ?? {
            id: m.id,
            name: m.id,
            capabilities: ['text'],
          },
      );
    });
  }
  async testConnection(signal?: AbortSignal) {
    try {
      await this.chat(
        {
          model: this.config.defaultModel,
          messages: [{ role: 'user', content: 'Reply OK.' }],
        },
        signal,
      );
      return { ok: true, message: '连接成功，默认模型可用' };
    } catch (error) {
      if (signal?.aborted) throw error;
      return {
        ok: false,
        message: error instanceof AIError ? error.message : '连接未完成',
      };
    }
  }
  async chat(
    raw: ChatRequest,
    signal?: AbortSignal,
    onText?: (text: string) => void,
  ): Promise<ChatResponse> {
    const request = chatRequestSchema.parse(raw);
    if (
      request.messages.some((m) => m.images?.length) &&
      !this.config.models
        .find((m) => m.id === request.model)
        ?.capabilities.includes('vision')
    )
      throw new AIError('invalid_request', '请为该模型明确启用视觉能力');
    const body = {
      model: request.model,
      // DeepSeek defaults to thinking mode, which rejects our named tool choice
      // and requires reasoning history. Use its compatible non-thinking mode.
      ...(new URL(this.config.baseUrl).hostname === 'api.deepseek.com'
        ? { thinking: { type: 'disabled' } }
        : {}),
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.images?.length
          ? [
              { type: 'text', text: m.content },
              ...m.images.map((url) => ({
                type: 'image_url',
                image_url: { url, detail: 'low' },
              })),
            ]
          : m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        ...(m.toolCalls
          ? {
              tool_calls: m.toolCalls.map((t) => ({
                id: t.id,
                type: 'function',
                function: { name: t.name, arguments: t.arguments },
              })),
            }
          : {}),
      })),
      ...(request.tools?.length
        ? {
            tools: request.tools.map((t) => ({
              type: 'function',
              function: t,
            })),
            ...(request.toolChoice
              ? {
                  tool_choice: {
                    type: 'function',
                    function: { name: request.toolChoice },
                  },
                }
              : {}),
          }
        : {}),
      ...(request.stream
        ? { stream: true, stream_options: { include_usage: true } }
        : {}),
    };
    return this.request('/chat/completions', body, signal, async (r, s) => {
      if (
        !request.stream ||
        !r.headers.get('content-type')?.includes('text/event-stream')
      ) {
        let raw: unknown;
        try {
          raw = JSON.parse(await this.boundedText(r, s));
        } catch (e) {
          if (e instanceof AIError) throw e;
          throw new AIError('invalid_response', '服务响应格式无效');
        }
        const result = response(raw, request.model);
        if (result.text) onText?.(result.text);
        return result;
      }
      const reader = r.body?.getReader();
      if (!reader) throw new AIError('invalid_response', '服务返回空响应');
      const decoder = new TextDecoder();
      let buffer = '',
        size = 0,
        text = '',
        done = false,
        finish: string | null = null;
      let usage: unknown;
      const calls = new Map<
        number,
        {
          id: string;
          type: 'function';
          function: { name: string; arguments: string };
        }
      >();
      const line = (value: string) => {
        if (!value.startsWith('data:')) return;
        const data = value.slice(5).trim();
        if (data === '[DONE]') {
          done = true;
          return;
        }
        if (!data) return;
        let raw: unknown;
        try {
          raw = JSON.parse(data);
        } catch {
          throw new AIError('invalid_response', '流式响应格式无效');
        }
        const parsed = z
          .object({
            choices: z.array(
              z.object({
                delta: z.object({
                  content: z.string().nullable().optional(),
                  tool_calls: z
                    .array(
                      z.object({
                        index: z.number().int().min(0).max(99),
                        id: z.string().optional(),
                        function: z
                          .object({
                            name: z.string().optional(),
                            arguments: z.string().optional(),
                          })
                          .optional(),
                      }),
                    )
                    .optional(),
                }),
                finish_reason: z.string().nullable().optional(),
              }),
            ),
            usage: z.unknown().optional(),
          })
          .safeParse(raw);
        if (!parsed.success)
          throw new AIError('invalid_response', '流式响应格式无效');
        if (parsed.data.usage) usage = parsed.data.usage;
        for (const choice of parsed.data.choices) {
          if (choice.delta.content) {
            text += choice.delta.content;
            onText?.(choice.delta.content);
          }
          if (choice.finish_reason) finish = choice.finish_reason;
          for (const t of choice.delta.tool_calls ?? []) {
            const item = calls.get(t.index) ?? {
              id: '',
              type: 'function' as const,
              function: { name: '', arguments: '' },
            };
            if (t.id) item.id = t.id;
            if (t.function?.name) item.function.name += t.function.name;
            if (t.function?.arguments)
              item.function.arguments += t.function.arguments;
            calls.set(t.index, item);
          }
        }
      };
      try {
        while (!done) {
          s.throwIfAborted();
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > (this.options.maxResponseBytes ?? 2000000))
            throw new AIError('invalid_response', '服务响应超过大小限制');
          buffer += decoder.decode(next.value, { stream: true });
          let index: number;
          while ((index = buffer.indexOf('\n')) >= 0) {
            line(buffer.slice(0, index).replace(/\r$/, ''));
            buffer = buffer.slice(index + 1);
          }
        }
        if (buffer.trim()) line(buffer.trim());
        if (!done || !finish)
          throw new AIError(
            'invalid_response',
            '流式响应被中断，未执行任何工具',
          );
        return response(
          {
            model: request.model,
            choices: [
              {
                message: { content: text, tool_calls: [...calls.values()] },
                finish_reason: finish,
              },
            ],
            ...(usage ? { usage } : {}),
          },
          request.model,
        );
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    });
  }
}
