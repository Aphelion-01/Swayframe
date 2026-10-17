import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { AIProviderManager } from '../ai/provider-manager';
import type { EditorStore } from './editor-store';
import { activeComposition } from '../core/project-model';
import { Icon } from './workspace/icons';
import { CommandRegistry } from './workspace/command-registry';
import { useCommandScope } from './workspace/scoped-commands';
import { contributionItems } from './workspace/feature-contributions';
export interface PromptReference {
  projectId: string;
  compositionId: string;
  layerIds: readonly string[];
}
/** UI only. Object IDs are validated again by the existing execution controller. */
export function AssistantComposer({
  store,
  manager,
  prompt,
  setPrompt,
  busy,
  blocked,
  label,
  onSend,
  onStop,
  onClear,
  skillId,
  skills,
  onSkill,
  children,
  maxLength = 4000,
  locked = false,
  removableReferences = true,
}: {
  store: EditorStore;
  manager: AIProviderManager;
  prompt: string;
  setPrompt: (value: string) => void;
  busy: boolean;
  blocked: boolean;
  label: string;
  onSend: (reference: PromptReference) => void;
  onStop: () => void;
  onClear: () => void;
  skillId: string;
  skills: { id: string; name: string }[];
  onSkill: (id: string) => void;
  children?: React.ReactNode;
  maxLength?: number;
  locked?: boolean;
  removableReferences?: boolean;
}) {
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const ai = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
  const [menu, setMenu] = useState<'model' | 'skill' | 'effort' | null>(null);
  const [error, setError] = useState('');
  const [omitted, setOmitted] = useState<string[]>([]);
  const file = useRef<HTMLInputElement>(null),
    area = useRef<HTMLTextAreaElement>(null),
    root = useRef<HTMLDivElement>(null);
  const current = useRef({
    prompt,
    busy,
    projectId: view.project.id,
    compositionId: view.project.activeCompositionId,
  });
  current.current = {
    prompt,
    busy,
    projectId: view.project.id,
    compositionId: view.project.activeCompositionId,
  };
  const fileEpoch = useRef(0);
  const c = activeComposition(view.project);
  const key = view.project.id + '/' + c.id + '/' + view.selection.join(',');
  useEffect(() => {
    fileEpoch.current++;
    return () => {
      fileEpoch.current++;
    };
  }, [key, busy]);
  useEffect(() => {
    setOmitted([]);
    setError('');
  }, [key]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenu(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [menu]);
  const targets = c.layers.filter(
    (l) => view.selection.includes(l.id) && !omitted.includes(l.id),
  );
  let model = '选择模型';
  try {
    model = manager.resolve('planning').model;
  } catch {
    /* setup */
  }
  const reference = {
    projectId: view.project.id,
    compositionId: c.id,
    layerIds: targets.map((l) => l.id),
  };
  const toggle = (value: typeof menu) => setMenu(menu === value ? null : value);
  const commands = new CommandRegistry(() => [
    {
      id: 'agent-chat-send',
      label: busy ? '停止' : '发送',
      disabled: !busy && (blocked || !prompt.trim()),
      action: () => {
        setMenu(null);
        if (busy) onStop();
        else onSend(reference);
      },
    },
    {
      id: 'agent-chat-clear',
      label: '清空上下文',
      disabled: busy,
      action: () => {
        fileEpoch.current++;
        onClear();
        setPrompt('');
        setError('');
        setMenu(null);
        area.current?.focus();
      },
    },
    {
      id: 'agent-chat-attach',
      label: '上传提示词',
      disabled: busy || locked,
      action: () => file.current?.click(),
    },
    {
      id: 'agent-chat-model',
      label: '更换模型',
      disabled: busy || locked,
      action: () => toggle('model'),
    },
    {
      id: 'agent-chat-skill',
      label: '更换 Skill',
      disabled: busy || locked,
      action: () => toggle('skill'),
    },
    {
      id: 'agent-chat-effort',
      label: '思考深度',
      disabled: busy || locked,
      action: () => toggle('effort'),
    },
  ]);
  useCommandScope(store, commands.definitions());
  const items = contributionItems('assistant.actions', commands, {
    AssistantMode: true,
  });
  const control = (
    id: string,
    icon: Parameters<typeof Icon>[0]['name'],
    text?: string,
  ) => {
    const item = items.find((i) => i.id === id);
    const label = commands.entry(id)?.label ?? item?.label;
    return (
      item && (
        <button
          type="button"
          className={
            'chat-control ' + (id === 'agent-chat-send' ? 'chat-send' : '')
          }
          title={label}
          aria-label={label}
          disabled={item.disabled}
          onClick={item.action}
          aria-expanded={
            id === 'agent-chat-model'
              ? menu === 'model'
              : id === 'agent-chat-skill'
                ? menu === 'skill'
                : id === 'agent-chat-effort'
                  ? menu === 'effort'
                  : undefined
          }
        >
          <Icon name={icon} />
          {text ? (
            <span>{text}</span>
          ) : (
            <span className="chat-sr-only">{label}</span>
          )}
        </button>
      )
    );
  };
  return (
    <div className="assistant-composer" ref={root}>
      {targets.length > 0 && (
        <div className="chat-references" aria-label="提示词中的图层引用">
          {targets.map((l) => (
            <span
              className="chat-layer-reference"
              key={l.id}
              title={'已绑定图层：' + l.name}
              data-layer-id={l.id}
            >
              <Icon name="comp" />
              <span>{l.name}</span>
              {removableReferences && (
                <button
                  title={'移除图层引用 ' + l.name}
                  aria-label={'移除图层引用 ' + l.name}
                  onClick={() => setOmitted([...omitted, l.id])}
                >
                  <Icon name="close" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <textarea
        ref={area}
        aria-label={label}
        placeholder="描述你想创建或调整的内容…"
        rows={3}
        value={prompt}
        maxLength={maxLength}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (!busy)
              items
                .find((i) => i.id === 'agent-chat-send' && !i.disabled)
                ?.action();
          }
        }}
      />
      <div className="chat-composer-controls">
        {control('agent-chat-attach', 'attachment')}
        {control('agent-chat-skill', 'assistant')}
        {control('agent-chat-effort', 'brain')}
        {control('agent-chat-model', 'cube', model)}
        {control('agent-chat-clear', 'new-chat')}
        {control('agent-chat-send', busy ? 'stop' : 'send')}
      </div>
      <div
        hidden={!menu}
        className="chat-popover"
        role="group"
        aria-label={
          menu === 'model'
            ? '模型设置'
            : menu === 'skill'
              ? 'Skill 设置'
              : '思考深度设置'
        }
      >
        {menu === 'model' && (
          <>
            <label>
              模型
              <select
                aria-label="助手模型"
                value={(() => {
                  try {
                    const v = manager.resolve('planning');
                    return v.provider.id + '/' + v.model;
                  } catch {
                    return '';
                  }
                })()}
                disabled={busy}
                onChange={(e) => {
                  const m = manager.models
                    .list()
                    .find((v) => v.providerId + '/' + v.id === e.target.value);
                  if (m)
                    void manager
                      .update((s) => ({
                        ...s,
                        routing: {
                          ...s.routing,
                          planning: {
                            providerId: m.providerId,
                            modelId: m.id,
                          },
                        },
                      }))
                      .then(() => setMenu(null))
                      .catch(() => setError('模型设置保存失败'));
                }}
              >
                <option value="" disabled>
                  选择服务与模型
                </option>
                {manager.models.list().map((m) => (
                  <option
                    key={m.providerId + '/' + m.id}
                    value={m.providerId + '/' + m.id}
                  >
                    {
                      ai.settings.providers.find((p) => p.id === m.providerId)
                        ?.name
                    }{' '}
                    · {m.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() =>
                window.dispatchEvent(new Event('swayframe:ai-settings'))
              }
            >
              管理服务
            </button>
          </>
        )}
        {menu === 'skill' && (
          <label>
            Skill
            <select
              aria-label="Agent Skill"
              value={skillId}
              disabled={busy}
              onChange={(e) => {
                onSkill(e.target.value);
                setMenu(null);
              }}
            >
              <option value="auto">自动选择</option>
              {skills.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {menu === 'effort' && (
          <>
            <label>
              思考深度
              <select
                aria-label="思考深度"
                value={manager.assistantEffort}
                disabled={busy}
                onChange={(e) => {
                  manager.setAssistantEffort(
                    e.target.value as 'low' | 'medium' | 'high',
                  );
                  setMenu(null);
                }}
              >
                <option value="low">快速</option>
                <option value="medium">标准</option>
                <option value="high">深入</option>
              </select>
            </label>
            <small>
              调整规划与检查要求；不承诺改变服务端内部推理模式。恢复次数与费用上限保持不变。
            </small>
          </>
        )}
        <div hidden={menu !== 'model'}>{children}</div>
      </div>
      <input
        ref={file}
        type="file"
        hidden
        accept=".txt,.md,text/plain,text/markdown"
        aria-label="上传提示词文件"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          e.target.value = '';
          if (!selected) return;
          if (
            selected.size > maxLength * 4 ||
            !/\.(?:txt|md)$/i.test(selected.name)
          ) {
            setError('请选择范围内的 TXT 或 Markdown 提示词文件');
            return;
          }
          const epoch = ++fileEpoch.current;
          const captured = { ...current.current };
          void selected
            .text()
            .then((value) => {
              if (
                epoch !== fileEpoch.current ||
                current.current.projectId !== captured.projectId ||
                current.current.compositionId !== captured.compositionId ||
                current.current.prompt !== captured.prompt ||
                current.current.busy
              )
                return;
              const next = [prompt, value].filter(Boolean).join('\n\n');
              if (next.length > maxLength || value.includes('\0')) {
                setError('提示词文件超出 ' + maxLength + ' 字符或含非法内容');
                return;
              }
              setPrompt(next);
              setError('');
              area.current?.focus();
            })
            .catch(() => setError('提示词文件读取失败'));
        }}
      />
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
