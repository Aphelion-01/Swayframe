import {
  AIError,
  aiSettingsSchema,
  credentialsSchema,
  defaultAISettings,
} from './contracts';
import type {
  AIStorage,
  AITransport,
  ProviderCredentials,
  ProviderConfig,
} from './contracts';
import type { DesktopAIAPI } from './desktop-contracts';
import { OpenAICompatibleProvider } from './openai-provider';
export function createAIPlatform(
  native?: DesktopAIAPI,
  development = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env
    ?.DEV === true,
): { storage: AIStorage; transport: AITransport } {
  if (native)
    return {
      storage: native,
      transport: {
        chat: async (provider, request, signal, onText) => {
          if (signal?.aborted) throw new AIError('cancelled', '已停止');
          const id = crypto.randomUUID();
          const abort = () => {
            void native.cancel(id).catch(() => {});
          };
          signal?.addEventListener('abort', abort, { once: true });
          let polling = false;
          const timer =
            request.stream && onText
              ? setInterval(() => {
                  if (polling) return;
                  polling = true;
                  void native
                    .chunks(id)
                    .then((chunks) => {
                      if (!signal?.aborted) chunks.forEach(onText);
                    })
                    .catch(() => {})
                    .finally(() => {
                      polling = false;
                    });
                }, 80)
              : undefined;
          try {
            const value = await native.chat(provider.id, id, request);
            if (signal?.aborted) throw new AIError('cancelled', '已停止');
            return value;
          } catch (e) {
            const code =
              typeof e === 'object' && e !== null && 'code' in e
                ? String(e.code)
                : 'provider';
            const allowed = [
              'setup',
              'network',
              'timeout',
              'rate_limit',
              'provider',
              'invalid_key',
              'invalid_request',
              'invalid_response',
              'cancelled',
            ] as const;
            throw new AIError(
              allowed.find((v) => v === code) ?? 'provider',
              e instanceof Error ? e.message : '模型请求未完成',
            );
          } finally {
            if (timer) clearInterval(timer);
            signal?.removeEventListener('abort', abort);
          }
        },
        listModels: (provider) => native.models(provider.id),
        testConnection: (provider) => native.test(provider.id),
      },
    };
  const secrets = new Map<string, ProviderCredentials>();
  const storage: AIStorage = {
    loadSettings: async () => {
      try {
        return aiSettingsSchema.parse(
          JSON.parse(
            localStorage.getItem('swayframe.ai.settings.v1') ?? 'null',
          ),
        );
      } catch {
        return defaultAISettings();
      }
    },
    saveSettings: async (settings) =>
      localStorage.setItem(
        'swayframe.ai.settings.v1',
        JSON.stringify(aiSettingsSchema.parse(settings)),
      ),
    setCredentials: async (id, credentials) => {
      if (!development)
        throw new AIError('setup', '请使用桌面版的安全密钥存储');
      secrets.set(id, credentialsSchema.parse(credentials));
    },
    removeCredentials: async (id) => {
      secrets.delete(id);
    },
    hasCredentials: async (id) => !!secrets.get(id)?.apiKey,
    storageStatus: async () => (development ? 'memory-only' : 'unavailable'),
    readData: async (key) => {
      try {
        return JSON.parse(
          localStorage.getItem('swayframe.ai.' + key) ?? 'null',
        );
      } catch {
        return null;
      }
    },
    writeData: async (key, data) => {
      const raw = JSON.stringify(data);
      if (raw.length > 4000000) throw new Error('应用数据过大');
      localStorage.setItem('swayframe.ai.' + key, raw);
    },
  };
  const provider = (config: ProviderConfig) =>
    new OpenAICompatibleProvider(config, async () => {
      const value = secrets.get(config.id);
      if (!development || !value)
        throw new AIError(
          'setup',
          '请配置服务密钥；开发网页密钥仅本次会话有效',
        );
      return value;
    });
  return {
    storage,
    transport: {
      chat: (config, request, signal, onText) =>
        provider(config).chat(request, signal, onText),
      listModels: (config, signal) => provider(config).listModels(signal),
      testConnection: (config, signal) =>
        provider(config).testConnection(signal),
    },
  };
}
