import { useState, useSyncExternalStore } from 'react';
import type { AIProviderManager } from '../../ai/provider-manager';
import type { AISettings } from '../../ai/contracts';
import { skillsFor } from '../../agent/skills';
export function AdvancedAISettings({
  manager,
  tab,
}: {
  manager: AIProviderManager;
  tab: string;
}) {
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot),
    s = state.settings;
  const skills = skillsFor(manager.storage),
    skillState = useSyncExternalStore(skills.subscribe, skills.getSnapshot);
  const [error, setError] = useState('');
  const save = (fn: (s: AISettings) => AISettings) => {
    void manager.update(fn).catch(() => setError('设置保存失败'));
  };
  const toggle = (
    label: string,
    checked: boolean,
    change: (value: boolean) => void,
  ) => (
    <label className="ai-option">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(e) => change(e.target.checked)}
      />
      {label}
    </label>
  );
  const models = manager.models.list();
  return (
    <section className="ai-advanced">
      {error && <p role="alert">{error}</p>}
      {tab === '路由' && (
        <>
          <p>普通对话、规划和视觉可使用不同模型。能力标记在“模型”中设置。</p>
          {(['general', 'planning', 'vision'] as const).map((task) => (
            <label className="ai-option" key={task}>
              {
                {
                  general: '普通对话',
                  planning: '任务规划',
                  vision: '视觉分析',
                }[task]
              }
              <select
                aria-label={task + ' 模型路由'}
                value={
                  s.routing[task]
                    ? `${s.routing[task]!.providerId}/${s.routing[task]!.modelId}`
                    : ''
                }
                onChange={(e) => {
                  const m = models.find(
                    (m) => `${m.providerId}/${m.id}` === e.target.value,
                  );
                  save((a) => ({
                    ...a,
                    routing: {
                      ...a.routing,
                      [task]: m
                        ? { providerId: m.providerId, modelId: m.id }
                        : null,
                    },
                  }));
                }}
              >
                <option value="">跟随默认服务</option>
                {models
                  .filter(
                    (m) =>
                      task !== 'vision' || m.capabilities.includes('vision'),
                  )
                  .map((m) => (
                    <option
                      key={m.providerId + '/' + m.id}
                      value={m.providerId + '/' + m.id}
                    >
                      {s.providers.find((p) => p.id === m.providerId)?.name} ·{' '}
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
          ))}
          {toggle('服务失败时自动切换或重试', s.failover.enabled, (v) =>
            save((a) => ({ ...a, failover: { ...a.failover, enabled: v } })),
          )}
          <label className="ai-option">
            最多重试次数
            <select
              aria-label="最多重试次数"
              value={s.failover.maxRetries}
              onChange={(e) =>
                save((a) => ({
                  ...a,
                  failover: {
                    ...a.failover,
                    maxRetries: Number(e.target.value),
                  },
                }))
              }
            >
              {[0, 1, 2].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {s.providers.map((p) => (
            <p key={p.id}>
              {p.name}：{state.health[p.id] ?? '尚未请求'}
            </p>
          ))}
        </>
      )}
      {tab === 'Agent' && (
        <>
          <label className="ai-option">
            默认模式
            <select
              aria-label="默认 Agent 模式"
              value={s.agent.mode}
              onChange={(e) =>
                save((a) => ({
                  ...a,
                  agent: {
                    ...a.agent,
                    mode: e.target.value as 'ASSIST' | 'AGENT',
                  },
                }))
              }
            >
              <option value="AGENT">执行</option>
              <option value="ASSIST">辅助</option>
            </select>
          </label>
          {toggle('自动应用安全修改', s.agent.autoApplySafe, (v) =>
            save((a) => ({ ...a, agent: { ...a.agent, autoApplySafe: v } })),
          )}
          <p>删除和危险结构修改始终需要确认。</p>
          {toggle('启用视觉验证', s.agent.visualVerification, (v) =>
            save((a) => ({
              ...a,
              agent: { ...a.agent, visualVerification: v },
            })),
          )}
          {toggle('流式显示回复', s.agent.streaming, (v) =>
            save((a) => ({ ...a, agent: { ...a.agent, streaming: v } })),
          )}
          <label className="ai-option">
            最多自动修正次数
            <select
              aria-label="最多自动修正次数"
              value={s.agent.maxRefinements}
              onChange={(e) =>
                save((a) => ({
                  ...a,
                  agent: { ...a.agent, maxRefinements: Number(e.target.value) },
                }))
              }
            >
              {[0, 1, 2].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="ai-option">
            默认 Skill
            <select
              aria-label="默认 Skill"
              value={s.agent.defaultSkill}
              onChange={(e) =>
                save((a) => ({
                  ...a,
                  agent: { ...a.agent, defaultSkill: e.target.value },
                }))
              }
            >
              <option value="auto">自动</option>
              {skillState.skills
                .filter((k) => k.enabled)
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
            </select>
          </label>
        </>
      )}
      {tab === '隐私' && (
        <>
          <p>
            请求可能将需求、工程摘要、选区、预览及参考图片发送给当前服务。素材磁盘路径、密钥不进入工程上下文。
          </p>
          {toggle('发送渲染预览', s.privacy.sendRenderPreview, (v) =>
            save((a) => ({
              ...a,
              privacy: { ...a.privacy, sendRenderPreview: v },
            })),
          )}
          {toggle('发送外部参考', s.privacy.sendReferences, (v) =>
            save((a) => ({
              ...a,
              privacy: { ...a.privacy, sendReferences: v },
            })),
          )}
          {toggle('保存工程会话历史', s.privacy.saveHistory, (v) =>
            save((a) => ({ ...a, privacy: { ...a.privacy, saveHistory: v } })),
          )}
        </>
      )}
      {tab === '用量' && (
        <>
          <p>
            仅记录服务返回的 token
            和费用。缺失统计不估算，费用显示“未知”。保留最近500次调用及31天合计。
          </p>
          <label className="ai-option">
            每日 token 预算（0 为不限）
            <input
              aria-label="每日 token 预算"
              type="number"
              min={0}
              step={1000}
              value={s.budget.dailyTokens}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isInteger(value) && value >= 0)
                  save((a) => ({
                    ...a,
                    budget: { ...a.budget, dailyTokens: value },
                  }));
              }}
            />
          </label>
          <label className="ai-option">
            达到预算
            <select
              aria-label="达到预算行为"
              value={s.budget.action}
              onChange={(e) =>
                save((a) => ({
                  ...a,
                  budget: {
                    ...a.budget,
                    action: e.target.value as 'warn' | 'stop',
                  },
                }))
              }
            >
              <option value="warn">提醒</option>
              <option value="stop">停止后续请求</option>
            </select>
          </label>
          {state.budgetWarning && <p role="status">{state.budgetWarning}</p>}
          <table>
            <thead>
              <tr>
                <th>模型</th>
                <th>输入</th>
                <th>输出</th>
                <th>合计</th>
                <th>费用</th>
              </tr>
            </thead>
            <tbody>
              {state.usage.records
                .slice(-50)
                .reverse()
                .map((r, i) => (
                  <tr key={r.at + ':' + i}>
                    <td title={r.model}>
                      {s.providers.find((p) => p.id === r.providerId)?.name} ·{' '}
                      {r.model}
                    </td>
                    <td>{r.inputTokens}</td>
                    <td>{r.outputTokens}</td>
                    <td>{r.totalTokens}</td>
                    <td>{r.cost === undefined ? '未知' : r.cost}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!state.usage.records.length && <p>尚无服务返回的用量统计。</p>}
        </>
      )}
    </section>
  );
}
