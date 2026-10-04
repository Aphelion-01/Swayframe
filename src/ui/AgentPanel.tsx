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
  const [error, setError] = useState('');
  const c = activeComposition(view.project);
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
            disabled={!configured || !prompt.trim() || agent.running}
            onClick={submit}
          >
            发送
          </button>
        </div>
      </div>
    </section>
  );
}
