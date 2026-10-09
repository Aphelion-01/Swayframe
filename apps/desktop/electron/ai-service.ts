import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { safeStorage } from 'electron';
import { atomicWrite } from './files';
import {
  AIError,
  aiSettingsSchema,
  credentialsSchema,
  defaultAISettings,
} from '../../../src/ai/contracts';
import type {
  AISettings,
  ProviderCredentials,
} from '../../../src/ai/contracts';
import type { AIRequest } from '../../../src/ai/desktop-contracts';
import { OpenAICompatibleProvider } from '../../../src/ai/openai-provider';
export interface SecretEncryption {
  available(): Promise<boolean>;
  encrypt(value: string): Promise<Buffer>;
  decrypt(value: Buffer): Promise<string>;
}
export const electronEncryption: SecretEncryption = {
  available: async () =>
    (process.platform !== 'linux' ||
      !['basic_text', 'unknown'].includes(
        safeStorage.getSelectedStorageBackend(),
      )) &&
    (await safeStorage.isAsyncEncryptionAvailable()),
  encrypt: (value) => safeStorage.encryptStringAsync(value),
  decrypt: async (value) =>
    (await safeStorage.decryptStringAsync(value)).result,
};
export class NativeAIService {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly requests = new Map<
    string,
    { controller: AbortController; chunks: string[] }
  >();
  private readonly cancelled = new Set<string>();
  private readonly memory = new Map<string, ProviderCredentials>();
  constructor(
    readonly directory: string,
    private readonly encryption: SecretEncryption = electronEncryption,
    private readonly development = false,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const next = this.queue.then(job, job);
    this.queue = next.catch(() => {});
    return next;
  }
  private file(name: string) {
    return path.join(this.directory, 'ai', name);
  }
  private async write(name: string, value: string | Uint8Array) {
    await fs.mkdir(this.file(''), { recursive: true, mode: 0o700 });
    await atomicWrite(this.file(name), value);
    await fs.chmod(this.file(name), 0o600);
  }
  async settings(): Promise<AISettings> {
    try {
      const raw = await fs.readFile(this.file('settings.json'), 'utf8');
      if (raw.length > 500000) throw new Error();
      return aiSettingsSchema.parse(JSON.parse(raw));
    } catch {
      return defaultAISettings();
    }
  }
  private async status() {
    return (await this.encryption.available())
      ? ('secure' as const)
      : this.development
        ? ('memory-only' as const)
        : ('unavailable' as const);
  }
  private secretName(providerId: string) {
    return `secret-${z.string().uuid().parse(providerId)}.bin`;
  }
  private async credentials(id: string): Promise<ProviderCredentials> {
    const mode = await this.status();
    if (mode === 'memory-only') {
      const value = this.memory.get(id);
      if (value) return value;
    }
    if (mode === 'secure') {
      try {
        const bytes = await fs.readFile(this.file(this.secretName(id)));
        if (bytes.length > 300000) throw new Error();
        return credentialsSchema.parse(
          JSON.parse(await this.encryption.decrypt(bytes)),
        );
      } catch {
        throw new AIError('setup', '密钥不可用，请在设置中重新配置');
      }
    }
    throw new AIError(
      'setup',
      mode === 'unavailable'
        ? '系统安全存储不可用，无法保存或使用密钥'
        : '请配置密钥',
    );
  }
  private async provider(id: string) {
    const config = (await this.settings()).providers.find(
      (p) => p.id === id && p.enabled,
    );
    if (!config || config.type !== 'openai-compatible')
      throw new AIError('setup', '服务尚未配置或已停用');
    return new OpenAICompatibleProvider(
      config,
      () => this.credentials(id),
      this.fetcher,
      { timeoutMs: 120000 },
    );
  }
  async dispatch(request: AIRequest): Promise<unknown> {
    switch (request.method) {
      case 'ai.settings.load':
        return this.settings();
      case 'ai.settings.save':
        return this.enqueue(async () => {
          const value = aiSettingsSchema.parse(request.settings);
          if (
            new Set(value.providers.map((p) => p.id)).size !==
            value.providers.length
          )
            throw new AIError('invalid_request', '服务标识重复');
          await this.write('settings.json', JSON.stringify(value));
        });
      case 'ai.storage.status':
        return this.status();
      case 'ai.credentials.set':
        return this.enqueue(async () => {
          const credentials = credentialsSchema.parse(request.credentials);
          const mode = await this.status();
          if (mode === 'unavailable')
            throw new AIError('setup', '系统安全存储不可用，密钥未保存');
          if (mode === 'memory-only')
            this.memory.set(request.providerId, credentials);
          else {
            const bytes = await this.encryption.encrypt(
              JSON.stringify(credentials),
            );
            await this.write(this.secretName(request.providerId), bytes);
          }
        });
      case 'ai.credentials.has':
        try {
          return !!(await this.credentials(request.providerId)).apiKey;
        } catch {
          return false;
        }
      case 'ai.credentials.remove':
        return this.enqueue(async () => {
          this.memory.delete(request.providerId);
          await fs.rm(this.file(this.secretName(request.providerId)), {
            force: true,
          });
        });
      case 'ai.data.read':
        try {
          const file = this.file(request.key + '.json');
          if ((await fs.stat(file)).size > 4000000) return null;
          const raw = await fs.readFile(file, 'utf8');
          if (raw.length > 4000000) return null;
          return JSON.parse(raw);
        } catch {
          return null;
        }
      case 'ai.data.write':
        return this.enqueue(async () => {
          JSON.parse(request.data);
          await this.write(request.key + '.json', request.data);
        });
      case 'ai.models':
        return (await this.provider(request.providerId)).listModels();
      case 'ai.test':
        return (await this.provider(request.providerId)).testConnection();
      case 'ai.cancel': {
        const current = this.requests.get(request.requestId);
        if (current) current.controller.abort();
        else {
          this.cancelled.add(request.requestId);
          if (this.cancelled.size > 100)
            this.cancelled.delete(this.cancelled.values().next().value!);
        }
        return;
      }
      case 'ai.chunks': {
        const current = this.requests.get(request.requestId);
        return current?.chunks.splice(0) ?? [];
      }
      case 'ai.chat': {
        if (this.requests.size >= 4 || this.requests.has(request.requestId))
          throw new AIError('invalid_request', '请求已在运行，请先停止');
        const state = {
          controller: new AbortController(),
          chunks: [] as string[],
        };
        this.requests.set(request.requestId, state);
        if (this.cancelled.delete(request.requestId)) state.controller.abort();
        try {
          if (state.controller.signal.aborted)
            throw new AIError('cancelled', '已停止');
          const provider = await this.provider(request.providerId);
          return await provider.chat(
            request.request,
            state.controller.signal,
            (t) => {
              state.chunks.push(t);
              if (state.chunks.length > 1000)
                state.chunks.splice(
                  0,
                  500,
                  [state.chunks.slice(0, 500).join('')][0]!,
                );
            },
          );
        } finally {
          this.requests.delete(request.requestId);
        }
      }
    }
  }
  dispose() {
    for (const value of this.requests.values()) value.controller.abort();
    this.requests.clear();
    this.memory.clear();
  }
}
