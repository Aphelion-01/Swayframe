import { useEffect, useState, useSyncExternalStore } from 'react';
import { getAIApplication } from '../../ai/application';
import { AIError, providerSchema } from '../../ai/contracts';
import type { ModelCapability, ProviderConfig } from '../../ai/contracts';
import type { AIProviderManager } from '../../ai/provider-manager';
import { Modal, Tabs } from '../workspace/primitives';
const capabilities: ModelCapability[] = [
  'text',
  'reasoning',
  'vision',
  'image',
  'embedding',
  'video',
];
function ProviderEditor({
  manager,
  provider,
  onClose,
}: {
  manager: AIProviderManager;
  provider?: ProviderConfig;
  onClose: () => void;
}) {
  const [value, setValue] = useState<ProviderConfig>(
    provider ?? {
      id: crypto.randomUUID(),
      name: '我的 AI 服务',
      type: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      enabled: true,
      defaultModel: '',
      models: [],
    },
  );
  const [key, setKey] = useState('');
  const [headers, setHeaders] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const patch = (data: Partial<ProviderConfig>) =>
    setValue({ ...value, ...data });
  return (
    <form
      className="ai-provider-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        void (async () => {
          const parsed = providerSchema.safeParse({
            ...value,
            models: value.models.length
              ? value.models
              : [
                  {
                    id: value.defaultModel,
                    name: value.defaultModel,
                    capabilities: ['text'],
                  },
                ],
          });
          if (!parsed.success)
            throw new Error(
              parsed.error.issues[0]?.message ?? '请检查服务设置',
            );
          let extra: Record<string, string> = {};
          if (headers.trim()) {
            const raw: unknown = JSON.parse(headers);
            if (
              !raw ||
              typeof raw !== 'object' ||
              Array.isArray(raw) ||
              Object.values(raw).some((v) => typeof v !== 'string')
            )
              throw new Error('自定义请求头需要 JSON 字符串对象');
            extra = raw as Record<string, string>;
          }
          if (headers.trim() && !key.trim())
            throw new Error('替换请求头时请同时输入密钥');
          await manager.saveProvider(
            parsed.data,
            key.trim() ? { apiKey: key.trim(), headers: extra } : undefined,
          );
          setKey('');
          setHeaders('');
          onClose();
        })()
          .catch((e) =>
            setError(
              e instanceof AIError
                ? e.message
                : e instanceof Error
                  ? e.message
                  : '设置保存失败',
            ),
          )
          .finally(() => setBusy(false));
      }}
    >
      <h3>{provider ? '编辑服务' : '添加服务'}</h3>
      <label>
        服务名称
        <input
          aria-label="服务名称"
          value={value.name}
          maxLength={100}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </label>
      <label>
        服务类型
        <select aria-label="服务类型" value={value.type} disabled>
          <option value="openai-compatible">OpenAI-compatible</option>
          <option value="mock">本地测试服务</option>
        </select>
      </label>
      <label>
        API Base URL
        <input
          aria-label="API Base URL"
          value={value.baseUrl}
          onChange={(e) => patch({ baseUrl: e.target.value })}
        />
      </label>
      <label>
        API Key
        <input
          aria-label="API Key"
          type="password"
          autoComplete="off"
          value={key}
          placeholder={provider ? '留空保留已保存密钥' : '输入服务密钥'}
          onChange={(e) => setKey(e.target.value)}
        />
      </label>
      <label>
        默认模型
        <input
          aria-label="默认模型"
          value={value.defaultModel}
          placeholder="填写服务支持的模型 ID"
          onChange={(e) => patch({ defaultModel: e.target.value })}
        />
      </label>
      <details>
        <summary>自定义请求头</summary>
        <p className="metadata">与密钥一起安全存储。填写后替换原配置。</p>
        <textarea
          aria-label="自定义请求头"
          value={headers}
          rows={3}
          placeholder={'{"X-Custom-Header":"value"}'}
          onChange={(e) => setHeaders(e.target.value)}
        />
      </details>
      {error && <p role="alert">{error}</p>}
      <div className="ai-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setKey('');
            setHeaders('');
            onClose();
          }}
        >
          取消
        </button>
        <button disabled={busy} type="submit">
          {busy ? '正在保存…' : '保存服务'}
        </button>
      </div>
    </form>
  );
}
export function AISettings({
  manager = getAIApplication(),
  onClose,
}: {
  manager?: AIProviderManager;
  onClose: () => void;
}) {
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
  const [tab, setTab] = useState('服务');
  const [editing, setEditing] = useState<ProviderConfig | null | undefined>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = (operation: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    void operation()
      .catch((e) =>
        setError(e instanceof AIError ? e.message : '操作未完成，请检查配置'),
      )
      .finally(() => setBusy(false));
  };
  return (
    <Modal onClose={onClose}>
      <section
        className="ai-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="设置 → AI"
      >
        <header className="panel-heading">
          <h2>设置 · AI</h2>
          <button aria-label="关闭 AI 设置" onClick={onClose}>
            关闭
          </button>
        </header>
        <Tabs items={['服务', '模型']} value={tab} onChange={setTab} />
        <div className="ai-settings-body">
          {!state.ready ? (
            <p role="status">正在读取设置…</p>
          ) : (
            <>
              <p className="metadata">
                {state.storage === 'secure'
                  ? '密钥使用系统安全存储。'
                  : state.storage === 'memory-only'
                    ? '开发模式：密钥仅本次会话有效，关闭后需重新配置。'
                    : '当前环境不支持安全密钥存储，请使用桌面版。'}
              </p>
              {state.error && <p role="alert">{state.error}</p>}
              {error && <p role="alert">{error}</p>}
              {tab === '服务' &&
                (editing !== undefined ? (
                  <ProviderEditor
                    manager={manager}
                    provider={editing ?? undefined}
                    onClose={() => setEditing(undefined)}
                  />
                ) : (
                  <>
                    <button onClick={() => setEditing(null)}>添加服务</button>
                    {!state.settings.providers.length && (
                      <p>尚未配置服务。添加服务后，Agent 才能使用模型。</p>
                    )}
                    {state.settings.providers.map((p) => (
                      <section key={p.id} className="ai-provider-row">
                        <div>
                          <strong>{p.name}</strong>
                          <span className="metadata">
                            {' '}
                            {p.id === state.settings.defaultProviderId
                              ? '默认 · '
                              : ''}
                            {p.enabled ? '已启用' : '已停用'} ·{' '}
                            {state.credentials[p.id]
                              ? '密钥已保存'
                              : '未配置密钥'}
                          </span>
                        </div>
                        <div className="metadata">
                          {p.defaultModel} · {p.baseUrl}
                        </div>
                        <div className="ai-actions">
                          <button disabled={busy} onClick={() => setEditing(p)}>
                            编辑
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(() =>
                                manager.saveProvider({
                                  ...p,
                                  enabled: !p.enabled,
                                }),
                              )
                            }
                          >
                            {p.enabled ? '停用' : '启用'}
                          </button>
                          <button
                            disabled={
                              busy ||
                              !p.enabled ||
                              p.id === state.settings.defaultProviderId
                            }
                            onClick={() =>
                              run(() =>
                                manager.update((s) => ({
                                  ...s,
                                  defaultProviderId: p.id,
                                })),
                              )
                            }
                          >
                            设为默认
                          </button>
                          <button
                            disabled={busy || !p.enabled}
                            onClick={() => run(() => manager.test(p.id))}
                          >
                            测试连接
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(() => manager.deleteProvider(p.id))
                            }
                          >
                            删除
                          </button>
                        </div>
                        {state.connection[p.id] && (
                          <p role="status">{state.connection[p.id]}</p>
                        )}
                      </section>
                    ))}
                  </>
                ))}
              {tab === '模型' && (
                <>
                  {!state.settings.providers.length && (
                    <p>先添加服务，再获取或配置模型。</p>
                  )}
                  {state.settings.providers.map((p) => (
                    <section key={p.id} className="ai-provider-row">
                      <div className="ai-actions">
                        <strong>{p.name}</strong>
                        <button
                          disabled={busy || !p.enabled}
                          onClick={() => run(() => manager.refreshModels(p.id))}
                        >
                          获取模型列表
                        </button>
                      </div>
                      <p className="metadata">
                        视觉等能力需按服务说明明确启用。
                      </p>
                      {p.models.map((m) => (
                        <div key={m.id} className="ai-model-row">
                          <span title={m.id}>{m.name || m.id}</span>
                          <div>
                            {capabilities.map((cap) => (
                              <label key={cap}>
                                <input
                                  type="checkbox"
                                  aria-label={`${m.id} ${cap}`}
                                  checked={m.capabilities.includes(cap)}
                                  disabled={busy}
                                  onChange={(e) =>
                                    run(() =>
                                      manager.saveProvider({
                                        ...p,
                                        models: p.models.map((item) =>
                                          item.id === m.id
                                            ? {
                                                ...item,
                                                capabilities: e.target.checked
                                                  ? [...item.capabilities, cap]
                                                  : item.capabilities.filter(
                                                      (c) => c !== cap,
                                                    ),
                                              }
                                            : item,
                                        ),
                                      }),
                                    )
                                  }
                                />
                                {cap}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </section>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </section>
    </Modal>
  );
}
export function ApplicationSettings() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const listener = () => setOpen(true);
    window.addEventListener('swayframe:ai-settings', listener);
    return () => window.removeEventListener('swayframe:ai-settings', listener);
  }, []);
  return open ? <AISettings onClose={() => setOpen(false)} /> : null;
}
