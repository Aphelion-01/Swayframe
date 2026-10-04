import { agentLibraryFor } from '../agent/library';
import { importAgentReference } from '../agent/references';
import type { ReferenceMode } from '../agent/references';
import { skillsFor } from '../agent/skills';
import { useState, useSyncExternalStore } from 'react';
import { getAIApplication } from '../ai/application';
import type { AIProviderManager } from '../ai/provider-manager';
import type { AgentOrchestrator } from '../agent/orchestrator';
import type { AgentStatus } from '../agent/session';
import { activeComposition } from '../core/project-model';
import { nativeAgentFor } from './native-agent-controller';
import { useEditorSlice } from './use-editor-slice';
import type { EditorStore } from './editor-store';
const statusLabels: Record<AgentStatus, string> = {
  idle: '就绪',
  thinking: '正在读取需求',
  planning: '正在规划',
  executing: '正在执行',
  verifying: '正在验证',
  completed: '已完成',
  failed: '未完成',
  cancelled: '已停止',
};
export function AgentPanel({
  store,
  agent = nativeAgentFor(store),
  manager = getAIApplication(),
}: {
  store: EditorStore;
  agent?: AgentOrchestrator;
  manager?: AIProviderManager;
}) {
  const session = useSyncExternalStore(agent.subscribe, agent.getSnapshot);
  const ai = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
  const view = useEditorSlice(store, ['project', 'selection']);
  const [prompt, setPrompt] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const c = activeComposition(view.project);
  const skills = skillsFor(manager.storage);
  const skillState = useSyncExternalStore(skills.subscribe, skills.getSnapshot);
  const library = agentLibraryFor(manager.storage);
  const libraryState = useSyncExternalStore(
    library.subscribe,
    library.getSnapshot,
  );
  const [presetName, setPresetName] = useState('');
  const selected = c.layers.filter((l) => view.selection.includes(l.id));
  let provider: string | undefined;
  let configured = false;
  try {
    const route = manager.resolve('planning');
    provider = route.provider.name + ' · ' + route.model;
    configured =
      route.provider.type === 'mock' || !!ai.credentials[route.provider.id];
  } catch {
    /* Setup state is shown below. */
  }
  const submit = () => {
    if (!prompt.trim() || agent.running || !configured) return;
    const value = prompt;
    setPrompt('');
    setError('');
    void agent
      .run(value)
      .catch((e) => setError(e instanceof Error ? e.message : '任务未完成'));
  };
  const latest = store.commands.undoStack.at(-1)?.transaction.id;
  const canUndo =
    !!session.changes?.transactionId &&
    latest === session.changes.transactionId;
  return (
    <section
      className="agent-panel native-agent-panel"
      aria-label="原生 AI Agent"
    >
      <div className="agent-heading">
        <strong>Agent</strong>
        <select
          aria-label="Agent 模式"
          value={session.mode}
          disabled={agent.running}
          onChange={(e) => agent.setMode(e.target.value as 'ASSIST' | 'AGENT')}
        >
          <option value="AGENT">执行</option>
          <option value="ASSIST">辅助</option>
        </select>
      </div>
      <label className="agent-skill">
        Skill{' '}
        <select
          aria-label="Agent Skill"
          value={session.skillId}
          disabled={agent.running}
          onChange={(e) => agent.setSkill(e.target.value)}
        >
          <option value="auto">自动</option>
          {skillState.skills
            .filter((s) => s.enabled)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      </label>
      {ai.fallback && <p role="status">{ai.fallback}</p>}
      {ai.budgetWarning && <p role="status">{ai.budgetWarning}</p>}
      <div className="agent-provider">
        <span title={provider}>{provider ?? '尚未配置 AI 服务'}</span>
        <button
          onClick={() =>
            window.dispatchEvent(new Event('swayframe:ai-settings'))
          }
        >
          管理
        </button>
      </div>
      <div className="agent-context" aria-label="Agent 当前上下文">
        <span title={c.name}>{c.name}</span>
        {selected.slice(0, 3).map((l) => (
          <span key={l.id} title={l.name}>
            {l.name}
          </span>
        ))}
        {selected.length > 3 && <span>+{selected.length - 3}</span>}
      </div>
      {!ai.ready ? (
        <p role="status">正在读取 AI 设置…</p>
      ) : !configured ? (
        <div className="agent-setup">
          <p>配置服务后，Agent 将使用当前工程和选区完成编辑。</p>
          <button
            onClick={() =>
              window.dispatchEvent(new Event('swayframe:ai-settings'))
            }
          >
            配置 AI 服务
          </button>
        </div>
      ) : null}
      <div className="agent-status" role={session.error ? 'alert' : 'status'}>
        <span>
          {statusLabels[session.status]}
          {session.pendingConfirmation ? ' · 等待确认' : ''}
        </span>
        {(agent.running || session.pendingConfirmation) && (
          <button onClick={() => agent.stop()}>停止</button>
        )}
      </div>
      {session.conversation.length > 0 && (
        <details className="agent-conversation">
          <summary>对话 · {session.conversation.length}</summary>
          {session.conversation.slice(-6).map((message, index) => (
            <p key={index}>
              <strong>{message.role === 'user' ? '你' : 'Agent'}</strong>{' '}
              {message.content}
            </p>
          ))}
        </details>
      )}
      {session.currentPlan && (
        <section className="agent-plan" aria-label="Agent 计划">
          <strong>{session.currentPlan.goal}</strong>
          <ol>
            {session.currentPlan.steps.map((step) => (
              <li key={step.id}>
                <span>
                  {session.toolCalls.some(
                    (t) => t.id === step.id && t.status === 'completed',
                  )
                    ? '✓ '
                    : ''}
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
          {session.pendingConfirmation && (
            <button
              className="primary"
              onClick={() => {
                setError('');
                void agent
                  .apply(session.currentPlan!.id)
                  .catch((e) =>
                    setError(e instanceof Error ? e.message : '计划未执行'),
                  );
              }}
            >
              确认并执行计划
            </button>
          )}
        </section>
      )}
      {session.response && <p className="agent-response">{session.response}</p>}
      {session.error && <p role="alert">{session.error}</p>}
      {error && <p role="alert">{error}</p>}
      {session.changes && (
        <section className="agent-changes" aria-label="Agent 修改">
          <strong>修改</strong>
          {[
            ['新增', session.changes.added],
            ['调整', session.changes.modified],
            ['删除', session.changes.deleted],
          ].map(([label, items]) => (
            <p key={String(label)}>
              {String(label)}：{(items as readonly string[]).join('、') || '无'}
            </p>
          ))}
          <button
            disabled={!canUndo}
            title={
              canUndo
                ? '通过共享历史撤销整次操作'
                : '当前没有可直接撤销的 Agent 操作；后续编辑可使用全局撤销'
            }
            onClick={() => {
              const result = store.commands.undo();
              if (!result.ok) store.setStatus(result.error, true);
            }}
          >
            撤销 Agent 修改
          </button>
        </section>
      )}
      {session.toolCalls.length > 0 && (
        <details className="agent-activity">
          <summary>操作记录 · {session.toolCalls.length}</summary>
          {session.toolCalls.slice(-40).map((activity, index) => (
            <div key={index}>
              {activity.status === 'completed'
                ? '✓'
                : activity.status === 'failed'
                  ? '×'
                  : '…'}{' '}
              {activity.label}
            </div>
          ))}
        </details>
      )}
      {session.verification && (
        <p className="agent-verification">{session.verification}</p>
      )}
      {session.beforeSnapshot && session.afterSnapshot && (
        <details className="agent-preview">
          <summary>查看修改前后</summary>
          <figure>
            <img src={session.beforeSnapshot} alt="修改前" />
            <figcaption>修改前</figcaption>
          </figure>
          <figure>
            <img src={session.afterSnapshot} alt="修改后" />
            <figcaption>修改后</figcaption>
          </figure>
        </details>
      )}
      <details className="agent-library">
        <summary>会话历史与动画预设</summary>
        {libraryState.error && <p role="alert">{libraryState.error}</p>}
        <button
          disabled={agent.running}
          onClick={() => agent.restoreConversation([])}
        >
          新会话
        </button>
        <button
          disabled={agent.running}
          onClick={() => {
            void library.clear(view.project.id).catch(() => {});
            agent.restoreConversation([]);
          }}
        >
          清除当前工程历史
        </button>
        {libraryState.history
          .filter((h) => h.projectId === view.project.id)
          .slice(-10)
          .reverse()
          .map((h) => (
            <button
              key={h.id}
              disabled={agent.running}
              title={h.summary}
              onClick={() => agent.restoreConversation(h.conversation)}
            >
              {h.conversation
                .find((m) => m.role === 'user')
                ?.content.slice(0, 30) ?? '历史会话'}
            </button>
          ))}
        <label>
          动画预设名称
          <input
            aria-label="Agent 动画预设名称"
            value={presetName}
            maxLength={100}
            onChange={(e) => setPresetName(e.target.value)}
          />
        </label>
        <button
          disabled={agent.running || !selected[0] || !presetName.trim()}
          onClick={() => {
            try {
              void library
                .savePreset(selected[0]!, presetName)
                .then(() => setPresetName(''))
                .catch((e) =>
                  setError(e instanceof Error ? e.message : '预设保存失败'),
                );
            } catch (e) {
              setError(e instanceof Error ? e.message : '预设保存失败');
            }
          }}
        >
          保存当前图层动画为预设
        </button>
        <small>
          保存实际属性数值、关键帧和曲线；应用时沿用预设的绝对时间与数值。
        </small>
        {libraryState.presets.map((p) => (
          <div key={p.id}>
            <span>{p.name}</span>
            <button
              disabled={agent.running}
              onClick={() => {
                setPrompt(
                  '使用动画预设 ' +
                    p.name +
                    '，presetId=' +
                    p.id +
                    '，应用到当前选中的图层',
                );
              }}
            >
              用于下次请求
            </button>
            <button
              disabled={agent.running}
              onClick={() => void library.deletePreset(p.id).catch(() => {})}
            >
              删除预设
            </button>
          </div>
        ))}
      </details>
      <div className="agent-references">
        <label className="ai-file">
          {importing ? '正在读取参考…' : '添加参考'}
          <input
            aria-label="添加 Agent 参考"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/*"
            disabled={
              agent.running || importing || session.references.length >= 2
            }
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setImporting(true);
              void importAgentReference(file, new AbortController().signal)
                .then((ref) =>
                  agent.setReferences(
                    [...agent.getSnapshot().references, ref],
                    agent.getSnapshot().referenceMode,
                  ),
                )
                .catch((e) =>
                  setError(e instanceof Error ? e.message : '导入失败'),
                )
                .finally(() => setImporting(false));
            }}
          />
        </label>
        {session.references.length > 0 && (
          <select
            aria-label="参考模式"
            value={session.referenceMode}
            disabled={agent.running}
            onChange={(e) =>
              agent.setReferences(
                session.references,
                e.target.value as ReferenceMode,
              )
            }
          >
            <option value="overall">整体参考</option>
            <option value="layout-only">仅布局</option>
            <option value="color-only">仅颜色</option>
            <option value="typography-only">仅字体</option>
            <option value="shape-only">仅形状</option>
          </select>
        )}
        {session.references.map((ref) => (
          <span className="agent-reference-chip" key={ref.id}>
            {ref.name}
            {ref.kind === 'gif-first-frame'
              ? ' · 首帧'
              : ref.kind === 'video-samples'
                ? ' · 3帧'
                : ''}
            <button
              aria-label={'移除参考 ' + ref.name}
              disabled={agent.running}
              onClick={() =>
                agent.setReferences(
                  session.references.filter((r) => r.id !== ref.id),
                  session.referenceMode,
                )
              }
            >
              ×
            </button>
          </span>
        ))}
        {session.references.length > 0 &&
          !ai.settings.privacy.sendReferences && (
            <small>隐私设置已禁止发送参考</small>
          )}
      </div>
      <div className="agent-input">
        <textarea
          aria-label="Agent 需求"
          placeholder={
            session.conversation.length
              ? '继续调整，例如“再快一点”'
              : '描述需要创建或调整的内容'
          }
          rows={3}
          value={prompt}
          maxLength={10000}
          disabled={agent.running}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="ai-actions">
          <small>Enter 发送 · Shift+Enter 换行</small>
          <button
            className="primary"
            disabled={
              !configured || !prompt.trim() || agent.running || importing
            }
            onClick={submit}
          >
            发送
          </button>
        </div>
      </div>
    </section>
  );
}
