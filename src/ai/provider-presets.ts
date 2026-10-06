import type { ProviderConfig } from './contracts';

export const providerPresets = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-flash', 'deepseek-v4-pro'],
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [],
  },
] as const;

export function providerPresetId(provider: ProviderConfig): string {
  return (
    providerPresets.find(
      (p) =>
        provider.baseUrl.replace(/\/$/, '') === p.baseUrl ||
        (p.id === 'deepseek' &&
          provider.baseUrl.replace(/\/$/, '') === p.baseUrl + '/v1'),
    )?.id ?? 'custom'
  );
}
