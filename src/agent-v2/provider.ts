import { AIError } from '../ai/contracts';
import type {
  ChatRequest,
  ChatResponse,
  ProviderConfig,
} from '../ai/contracts';
import { providerCapabilityProfile } from '../ai/provider-profile';
import {
  isModelUnavailable,
  modelUnavailableMessage,
} from '../ai/provider-diagnostics';
import { problem } from './errors';
export interface ModelTransport {
  chat(
    request: ChatRequest,
    signal: AbortSignal,
    onText?: (text: string) => void,
  ): Promise<ChatResponse>;
}
export interface NormalizedResponse {
  payload: unknown;
  model: string;
  providerId?: string;
  usage: ChatResponse['usage'];
}
/** Reuses transport/credentials/cancellation; never receives a Scene mutation port. */
export class ProviderBridge {
  readonly profile: ReturnType<typeof providerCapabilityProfile>;
  constructor(
    private readonly transport: ModelTransport,
    provider: ProviderConfig,
    readonly model: string,
    readonly mode: 'tools' | 'structured-plan',
  ) {
    this.profile = providerCapabilityProfile(provider, model);
    if (provider.type !== 'openai-compatible' && provider.type !== 'mock')
      throw problem('PROVIDER_UNSUPPORTED', '当前传输不支持此供应商', {
        phase: 'planning',
      });
  }
  async request(
    request: Omit<ChatRequest, 'model' | 'responseMode'>,
    signal: AbortSignal,
    beforeRequest?: (request: ChatRequest) => void,
  ): Promise<NormalizedResponse> {
    signal.throwIfAborted();
    const prepared = { ...request, model: this.model, responseMode: this.mode };
    beforeRequest?.(prepared);
    let response: ChatResponse;
    try {
      response = await this.transport.chat(prepared, signal);
    } catch (error) {
      signal.throwIfAborted();
      if (
        error instanceof AIError &&
        ['unsupported_tools', 'tool_calling_not_supported'].includes(
          error.details?.code ?? '',
        )
      )
        throw problem(
          'PROVIDER_UNSUPPORTED',
          '当前模型端点不支持所选工具协议',
          { phase: 'planning' },
        );
      if (error instanceof AIError) {
        if (
          error.code === 'invalid_request' &&
          isModelUnavailable(error.details)
        )
          throw problem('PROVIDER_RESPONSE', modelUnavailableMessage, {
            phase: 'planning',
            field: 'provider',
            actual: {
              code: error.code,
              status: error.details?.status,
              serviceCode: error.details?.code,
            },
            recoverable: false,
            strategy: 'NONE',
          });
        const transient =
          ['network', 'timeout', 'rate_limit'].includes(error.code) ||
          (error.code === 'provider' && (error.details?.status ?? 0) >= 500);
        throw problem(
          error.code === 'cancelled'
            ? 'CANCELLED'
            : error.code === 'invalid_key' ||
                error.details?.status === 401 ||
                error.details?.status === 403
              ? 'AUTHORIZATION_REQUIRED'
              : transient
                ? 'PROVIDER_TRANSIENT_FAILURE'
                : 'PROVIDER_RESPONSE',
          '模型服务未完成请求（' +
            error.code +
            (error.details?.status ? ' · HTTP ' + error.details.status : '') +
            '）；编辑草稿不会提交',
          {
            phase: 'planning',
            field: 'provider',
            actual: { code: error.code, status: error.details?.status },
            recoverable: transient,
            strategy: transient ? 'RETRY_PROVIDER' : 'NONE',
            ...(error.details?.retryAfterMs === undefined
              ? {}
              : { retryAfterMs: error.details.retryAfterMs }),
          },
        );
      }
      throw problem('PROVIDER_RESPONSE', '模型服务请求未完成；未执行编辑操作', {
        phase: 'planning',
      });
    }
    signal.throwIfAborted();
    const rejected = (message: string) =>
      problem('PROVIDER_RESPONSE', message, {
        phase: 'planning',
        field: 'response',
        expected:
          this.mode === 'tools'
            ? 'one complete submitIntent tool call'
            : 'complete JSON Task Intent',
        recoverable: true,
        ...(response.usage
          ? {
              usage: {
                inputTokens: response.usage.inputTokens,
                outputTokens: response.usage.outputTokens,
              },
            }
          : {}),
      });
    if (response.toolCalls.length) {
      if (
        this.mode !== 'tools' ||
        response.toolCalls.length !== 1 ||
        response.toolCalls[0]?.name !== (request.toolChoice ?? 'submitIntent')
      )
        throw rejected('模型必须返回一个完整任务意图');
      return {
        payload: response.toolCalls[0].arguments,
        model: response.model,
        providerId: response.providerId,
        usage: response.usage,
      };
    }
    if (this.mode === 'tools')
      throw rejected('模型未返回任务意图；不会自动切换协议');
    try {
      return {
        payload: JSON.parse(response.text),
        model: response.model,
        providerId: response.providerId,
        usage: response.usage,
      };
    } catch {
      throw rejected('模型返回的结构化任务不完整');
    }
  }
}
