import { appendUsage, emptyUsage, usageDate, usageSchema } from './usage';
import type { AIUsage } from './usage';
import {
  AIError,
  aiSettingsSchema,
  defaultAISettings,
  providerSchema,
} from './contracts';
import type {
  AIProvider,
  AISettings,
  AIStorage,
  AITransport,
  ChatRequest,
  ProviderConfig,
  ProviderCredentials,
  ModelInfo,
} from './contracts';
export class ModelRegistry {
  constructor(private readonly settings: () => AISettings) {}
  list(): (ModelInfo & { providerId: string })[] {
    return this.settings()
      .providers.filter((p) => p.enabled)
      .flatMap((p) => p.models.map((m) => ({ ...m, providerId: p.id })));
  }
  resolve(providerId: string, modelId: string) {
    return this.list().find(
      (m) => m.providerId === providerId && m.id === modelId,
    );
  }
}
export interface AIApplicationState {
  settings: AISettings;
  ready: boolean;
  error: string | null;
  storage: 'secure' | 'memory-only' | 'unavailable';
  credentials: Readonly<Record<string, boolean>>;
  connection: Readonly<Record<string, string>>;
  usage: AIUsage;
  health: Readonly<Record<string, string>>;
  fallback: string | null;
  budgetWarning: string | null;
}
export class AIProviderManager {
  private state: AIApplicationState = {
    settings: defaultAISettings(),
    ready: false,
    error: null,
    storage: 'unavailable',
    credentials: {},
    connection: {},
    usage: emptyUsage(),
    health: {},
    fallback: null,
    budgetWarning: null,
  };
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private overrides = new Map<string, AIProvider>();
  assistantEffort: 'low' | 'medium' | 'high' = 'medium';
  setAssistantEffort(value: 'low' | 'medium' | 'high') {
    if (!['low', 'medium', 'high'].includes(value))
      throw Error('无效的思考深度');
    this.assistantEffort = value;
    this.set({});
  }
  planningPreference() {
    return {
      level: this.assistantEffort,
      instruction:
        (this.assistantEffort === 'low'
          ? 'Prefer the smallest sufficient plan.'
          : this.assistantEffort === 'high'
            ? 'Carefully check all requested effects, animation values, dependencies and target constraints before submitting.'
            : 'Check targets, dependencies and requested parameter values before submitting.') +
        ' Return only the requested structured result. Do not output private reasoning. This preference never expands permissions or execution budgets.',
    };
  }
  readonly models = new ModelRegistry(() => this.state.settings);
  constructor(
    readonly storage: AIStorage,
    readonly transport: AITransport,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private set(patch: Partial<AIApplicationState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  async initialize() {
    try {
      const [settings, mode, usageData] = await Promise.all([
        this.storage.loadSettings(),
        this.storage.storageStatus(),
        this.storage.readData('usage'),
      ]);
      const credentials = Object.fromEntries(
        await Promise.all(
          settings.providers.map(async (p) => [
            p.id,
            await this.storage.hasCredentials(p.id),
          ]),
        ),
      );
      this.set({
        settings: aiSettingsSchema.parse(settings),
        usage: usageSchema.safeParse(usageData).success
          ? usageSchema.parse(usageData)
          : emptyUsage(),
        ready: true,
        storage: mode,
        credentials,
        error: null,
      });
    } catch {
      this.set({ ready: true, error: 'AI 设置读取失败，可重新配置' });
    }
  }
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const next = this.queue.then(job, job);
    this.queue = next.catch(() => {});
    return next;
  }
  update(update: (settings: AISettings) => AISettings) {
    return this.enqueue(async () => {
      const value = aiSettingsSchema.parse(update(this.state.settings));
      await this.storage.saveSettings(value);
      this.set({ settings: value, error: null });
    });
  }
  async saveProvider(raw: ProviderConfig, credentials?: ProviderCredentials) {
    const provider = providerSchema.parse(raw);
    if (credentials)
      await this.storage.setCredentials(provider.id, credentials);
    await this.update((s) => ({
      ...s,
      providers: [...s.providers.filter((p) => p.id !== provider.id), provider],
      defaultProviderId: s.defaultProviderId ?? provider.id,
    }));
    this.set({
      credentials: {
        ...this.state.credentials,
        [provider.id]:
          provider.type === 'mock' ||
          (await this.storage.hasCredentials(provider.id)),
      },
    });
  }
  async deleteProvider(id: string) {
    await this.storage.removeCredentials(id);
    await this.update((s) => ({
      ...s,
      providers: s.providers.filter((p) => p.id !== id),
      defaultProviderId:
        s.defaultProviderId === id ? null : s.defaultProviderId,
      routing: {
        general:
          s.routing.general?.providerId === id ? null : s.routing.general,
        planning:
          s.routing.planning?.providerId === id ? null : s.routing.planning,
        vision: s.routing.vision?.providerId === id ? null : s.routing.vision,
      },
    }));
  }
  register(provider: AIProvider) {
    this.overrides.set(provider.id, provider);
    return () => this.overrides.delete(provider.id);
  }
  resolve(task: 'general' | 'planning' | 'vision' = 'general') {
    const s = this.state.settings;
    const route =
      s.routing[task] ?? (task === 'planning' ? s.routing.general : null);
    const provider = s.providers.find(
      (p) => p.enabled && p.id === (route?.providerId ?? s.defaultProviderId),
    );
    if (!provider) throw new AIError('setup', '请先配置并启用 AI 服务');
    const model = route?.modelId ?? provider.defaultModel;
    if (
      task === 'vision' &&
      !this.models.resolve(provider.id, model)?.capabilities.includes('vision')
    )
      throw new AIError('setup', '请在设置中选择支持视觉的模型');
    return { provider, model };
  }
  async test(id: string) {
    const p = this.state.settings.providers.find((v) => v.id === id);
    if (!p) throw new AIError('setup', '服务不存在');
    this.set({ connection: { ...this.state.connection, [id]: '正在测试…' } });
    try {
      const result = await (this.overrides.get(id)?.testConnection() ??
        this.transport.testConnection(p));
      this.set({
        connection: { ...this.state.connection, [id]: result.message },
      });
      return result;
    } catch (e) {
      this.set({
        connection: {
          ...this.state.connection,
          [id]: e instanceof AIError ? e.message : '连接未完成',
        },
      });
      throw e;
    }
  }
  async refreshModels(id: string) {
    const p = this.state.settings.providers.find((v) => v.id === id);
    if (!p) throw new AIError('setup', '服务不存在');
    const models = await (this.overrides.get(id)?.listModels() ??
      this.transport.listModels(p));
    await this.saveProvider({ ...p, models });
    return models;
  }
  private readonly countedFailures = new WeakMap<object, number>();
  /** One transport attempt per counted recovery call; permitted failover occurs on the next counted call. */
  chatOnce: AIProviderManager['chat'] = async (
    task,
    request,
    signal,
    onText,
  ) => {
    const failed = this.countedFailures.get(request) ?? 0;
    try {
      const response = await this.chat(task, request, signal, onText, {
        singleAttempt: true,
        attempt: this.state.settings.failover.enabled
          ? Math.min(failed, this.state.settings.failover.maxRetries)
          : 0,
      });
      this.countedFailures.delete(request);
      return response;
    } catch (error) {
      if (
        error instanceof AIError &&
        (['network', 'timeout', 'rate_limit'].includes(error.code) ||
          (error.code === 'provider' && (error.details?.status ?? 0) >= 500))
      )
        this.countedFailures.set(request, failed + 1);
      else this.countedFailures.delete(request);
      throw error;
    }
  };
  async chat(
    task: 'general' | 'planning' | 'vision',
    request: Omit<ChatRequest, 'model'>,
    signal?: AbortSignal,
    onText?: (text: string) => void,
    control?: { singleAttempt: boolean; attempt?: number },
  ) {
    const settings = this.state.settings;
    const tokens =
      this.state.usage.days.find((d) => d.date === usageDate())?.tokens ?? 0;
    const limit = settings.budget.dailyTokens;
    const budgetWarning =
      limit && tokens >= limit * 0.8
        ? `今日已使用 ${tokens} tokens，预算 ${limit}${tokens >= limit ? '（已达到）' : '（超过80%）'}`
        : null;
    this.set({ budgetWarning, fallback: null });
    if (limit && tokens >= limit && settings.budget.action === 'stop')
      throw new AIError('invalid_request', '已达到每日 token 预算，请调整设置');
    if (
      request.messages.some((m) => m.images?.length) &&
      !(settings.privacy.sendRenderPreview || settings.privacy.sendReferences)
    )
      throw new AIError('invalid_request', '隐私设置禁止发送图片');
    const first = this.resolve(task);
    const alternatives = settings.providers
      .filter(
        (p) =>
          p.enabled &&
          p.id !== first.provider.id &&
          (p.type === 'mock' || this.state.credentials[p.id]),
      )
      .map((provider) => ({ provider, model: provider.defaultModel }))
      .filter(
        (r) =>
          task !== 'vision' ||
          this.models
            .resolve(r.provider.id, r.model)
            ?.capabilities.includes('vision'),
      )
      .slice(0, 2);
    let route = control?.attempt
      ? (alternatives[control.attempt - 1] ?? first)
      : first;
    if (route.provider.id !== first.provider.id)
      this.set({
        fallback: `${first.provider.name} 请求失败，已切换 ${route.provider.name}`,
      });
    for (let attempt = 0; ; attempt++) {
      if (signal?.aborted) throw new AIError('cancelled', '已停止');
      this.set({
        health: { ...this.state.health, [route.provider.id]: '正在请求' },
      });
      try {
        const raw = {
          ...request,
          model: route.model,
          ...(request.tools?.length
            ? {
                responseMode:
                  request.responseMode ??
                  settings.agent.planTransport ??
                  ('tools' as const),
              }
            : {}),
        };
        const response = await (this.overrides
          .get(route.provider.id)
          ?.chat(raw, signal, onText) ??
          this.transport.chat(route.provider, raw, signal, onText));
        if (signal?.aborted) throw new AIError('cancelled', '已停止');
        this.set({
          health: { ...this.state.health, [route.provider.id]: '可用' },
        });
        await this.enqueue(async () => {
          const usage = appendUsage(
            this.state.usage,
            route.provider.id,
            response.model,
            task,
            response.usage,
          );
          const used =
            usage.days.find((d) => d.date === usageDate())?.tokens ?? 0;
          this.set({
            usage,
            budgetWarning:
              limit && used >= limit * 0.8
                ? `今日已使用 ${used} tokens，预算 ${limit}${used >= limit ? '（已达到）' : '（超过80%）'}`
                : null,
          });
          if (usage !== this.state.usage || response.usage)
            try {
              await this.storage.writeData('usage', usage);
            } catch {
              this.set({ error: '用量记录保存失败' });
            }
        });
        return {
          ...response,
          providerId: route.provider.id,
        } as import('./contracts').ChatResponse;
      } catch (error) {
        const retryable =
          error instanceof AIError &&
          ['network', 'timeout', 'rate_limit', 'provider'].includes(error.code);
        this.set({
          health: {
            ...this.state.health,
            [route.provider.id]:
              error instanceof AIError ? error.message : '请求失败',
          },
        });
        if (
          signal?.aborted ||
          control?.singleAttempt ||
          !settings.failover.enabled ||
          !retryable ||
          attempt >= settings.failover.maxRetries
        )
          throw error;
        const next = alternatives[attempt] ?? route;
        this.set({
          fallback:
            next.provider.id !== route.provider.id
              ? `${route.provider.name} 请求失败，已切换 ${next.provider.name}`
              : `${route.provider.name} 暂时不可用，正在重试 (${attempt + 1})`,
        });
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            reject(new AIError('cancelled', '已停止'));
          };
          const timer = setTimeout(
            () => {
              signal?.removeEventListener('abort', abort);
              resolve();
            },
            100 * 2 ** attempt,
          );
          signal?.addEventListener('abort', abort, { once: true });
          if (signal?.aborted) abort();
        });
        route = next;
      }
    }
  }
}
