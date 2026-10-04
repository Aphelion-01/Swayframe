import { AIError } from './contracts';
import type {
  AIProvider,
  ChatRequest,
  ChatResponse,
  ModelInfo,
} from './contracts';
export type MockHandler = (
  request: ChatRequest,
  signal?: AbortSignal,
) => Promise<ChatResponse> | ChatResponse;
export class MockAIProvider implements AIProvider {
  readonly capabilities = ['text', 'reasoning', 'vision'] as const;
  constructor(
    readonly id: string,
    readonly name = '本地测试服务',
    private readonly handler?: MockHandler,
  ) {}
  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'mock-v1',
        name: '确定性测试模型',
        capabilities: [...this.capabilities],
      },
    ];
  }
  async testConnection() {
    return { ok: true, message: '本地测试服务可用，不访问网络' };
  }
  async chat(
    request: ChatRequest,
    signal?: AbortSignal,
    onText?: (text: string) => void,
  ): Promise<ChatResponse> {
    if (signal?.aborted) throw new AIError('cancelled', '已停止');
    if (!this.handler)
      throw new AIError('setup', '本地测试服务需要预设测试场景');
    const result = await this.handler(request, signal);
    if (signal?.aborted) throw new AIError('cancelled', '已停止');
    if (result.text) onText?.(result.text);
    return structuredClone(result);
  }
}
