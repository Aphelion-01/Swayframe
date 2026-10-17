import { ProposalPanel } from './ProposalPanel';
import { AssistantComposer } from './AssistantComposer';
import { Icon } from './workspace/icons';
import { AgentV2Lab } from './AgentV2Lab';
import { AgentV2EditorPanel } from './AgentV2EditorPanel';
import { coreV2For } from './core-v2-controller';
import { agentRuntimeChoice } from './agent-runtime-selection';
import { exportAgentDiagnostic } from '../agent/working-memory';
import { useCommandScope } from './workspace/scoped-commands';
import { CommandRegistry } from './workspace/command-registry';
import { contributionItems } from './workspace/feature-contributions';
import { downloadBlob } from './file-utils';
import { diagnosticData } from '../agent/execution-error';
import { agentLibraryFor } from '../agent/library';
import { importAgentReference } from '../agent/references';
import type { ReferenceMode } from '../agent/references';
import { skillsFor } from '../agent/skills';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getAIApplication } from '../ai/application';
import type { AIProviderManager } from '../ai/provider-manager';
import type { AgentOrchestrator } from '../agent/orchestrator';
import type { AgentStatus } from '../agent/session';
import { activeComposition } from '../core/project-model';
import { nativeAgentFor } from './native-agent-controller';
import { useEditorSlice } from './use-editor-slice';
import type { EditorStore } from './editor-store';
import { CreationReview } from './CreationPrompt';
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
  visible = true,
}: {
  store: EditorStore;
  agent?: AgentOrchestrator;
  manager?: AIProviderManager;
  visible?: boolean;
}) {
  const core = coreV2For(store, manager, agent);
  useSyncExternalStore(core.subscribe, core.getRevision);
  const legacy = useSyncExternalStore(agent.subscribe, agent.getSnapshot);
  const choice = agentRuntimeChoice(store),
    busy = core.running || agent.running || legacy.pendingConfirmation;
  const [error, setError] = useState('');
  const commands = new CommandRegistry(() => [
    {
      id: 'agent-runtime-choice',
      label: '切换Agent引擎',
      disabled: !!busy,
      action: () => {
        try {
          core.select(choice === 'core-v2' ? 'legacy-v1' : 'core-v2');
          setError('');
        } catch (e) {
          setError(e instanceof Error ? e.message : '不能切换引擎');
        }
      },
    },
  ]);
  useCommandScope(store, commands.definitions());
  const item = contributionItems('assistant.actions', commands, {
    AssistantMode: true,
  }).find((i) => i.id === 'agent-runtime-choice');
  useEffect(() => {
    if (!visible) core.cancel();
    return () => core.cancel();
  }, [core, visible]);
  return (
    <div className="assistant-chat-shell">
      <details className="chat-engine-menu">
        <summary title="助手设置" aria-label="助手设置">
          <Icon name="more" />
        </summary>
        <div className="chat-engine-content">
          <label className="agent-runtime-choice">
            引擎
            <select
              aria-label="Agent 引擎"
              value={choice}
              disabled={!!busy}
              onChange={() => item?.action()}
            >
              <option value="legacy-v1">Legacy V1</option>
              <option value="core-v2">Core V2 Beta</option>
            </select>
          </label>
          <details className="chat-legacy-advisor">
            <summary>快速建议（离线示例）</summary>
            <ProposalPanel store={store} />
          </details>
        </div>
      </details>
      {error && <p role="alert">{error}</p>}
      {choice === 'core-v2' ? (
        <AgentV2EditorPanel controller={core} />
      ) : (
        <LegacyAgentPanel store={store} agent={agent} manager={manager} />
      )}
    </div>
  );
}
function LegacyAgentPanel({
  store,
  agent = nativeAgentFor(store),
  manager = getAIApplication(),
}: {
  store: EditorStore;
  agent?: AgentOrchestrator;
  manager?: AIProviderManager;
}) {
  const [v2Lab, setV2Lab] = useState(false);
  const developerV2 = window.location.hash === '#agent-v2-test';
  const session = useSyncExternalStore(agent.subscribe, agent.getSnapshot);
  const diagnosticCommands = new CommandRegistry(() => [
    ...(developerV2
      ? [
          {
            id: 'agent-v2-test',
            label: '打开 V2 隔离测试',
            disabled: agent.running,
            action: () => setV2Lab(true),
          },
        ]
      : []),
    {
      id: 'agent-export-diagnostic',
      label: '导出执行诊断',
      disabled: agent.running || !session.trace,
      action: () =>
        downloadBlob(
          new Blob([exportAgentDiagnostic(agent.getSnapshot())], {
            type: 'application/json',
          }),
          'swayframe-agent-' + session.sessionId + '.json',
        ),
    },
  ]);
  useCommandScope(store, diagnosticCommands.definitions());
  const diagnosticAction = contributionItems(
    'assistant.actions',
    diagnosticCommands,
    { AssistantMode: true },
  ).find((item) => item.id === 'agent-export-diagnostic');
  const ai = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
  const view = useEditorSlice(store, ['project', 'selection']);
  const [prompt, setPrompt] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [referenceDrag, setReferenceDrag] = useState(false);
  const referenceImport = useRef<AbortController | null>(null);
  useEffect(() => () => referenceImport.current?.abort(), []);
  const addReferences = async (files: readonly File[]) => {
    if (agent.running || referenceImport.current || !files.length) return;
    const available = 2 - agent.getSnapshot().references.length;
    if (files.length > available) {
      setError('最多添加两份参考，请先移除已有参考');
      return;
    }
    const controller = new AbortController();
    referenceImport.current = controller;
    setImporting(true);
    setError('');
    try {
      const imported = [];
      for (const file of files)
        imported.push(await importAgentReference(file, controller.signal));
      if (!controller.signal.aborted)
        agent.setReferences(
          [...agent.getSnapshot().references, ...imported],
          agent.getSnapshot().referenceMode,
        );
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : '导入失败');
    } finally {
      if (!controller.signal.aborted) setImporting(false);
      referenceImport.current = null;
    }
  };
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
  let configured = false;
  try {
    const route = manager.resolve('planning');
    configured =
      route.provider.type === 'mock' || !!ai.credentials[route.provider.id];
  } catch {
    /* Setup state is shown below. */
  }
  const submit = () => {
    if (!prompt.trim() || agent.running || importing || !configured) return;
    const value = prompt;
    setError('');
    if (session.references.length && ai.settings.privacy.sendReferences) {
      try {
        const vision = manager.resolve('vision');
        if (
          vision.provider.type !== 'mock' &&
          !ai.credentials[vision.provider.id]
        )
          throw Error('请为视觉模型配置密钥');
      } catch (e) {
        setError(
          '当前参考无法发送：' +
            (e instanceof Error ? e.message : '模型不支持识图') +
            '。请在 AI 设置中选择支持识图的模型，或移除参考后发送文字。',
        );
        return;
      }
    }
    void agent
      .run(value)
      .then(() => {
        if (agent.getSnapshot().status === 'completed')
          setPrompt((current) => (current === value ? '' : current));
      })
      .catch((e) => setError(e instanceof Error ? e.message : '任务未完成'));
  };
  const latest = store.commands.undoStack.at(-1)?.transaction.id;
  const canUndo =
    !!session.changes?.transactionId &&
    latest === session.changes.transactionId;
  return (
    <section
      className="agent-panel native-agent-panel assistant-chat legacy-chat"
      aria-label="原生 AI Agent"
      onPaste={(event) => {
        const files = Array.from(event.clipboardData.files).filter((file) =>
          file.type.startsWith('image/'),
        );
        if (!files.length) return;
        event.preventDefault();
        event.stopPropagation();
        void addReferences(files);
      }}
    >
      <div className="chat-transcript" role="log" aria-label="助手对话记录">
        <div className="agent-heading">
          <strong>Agent · Legacy V1</strong>
        </div>
        {ai.fallback && <p role="status">{ai.fallback}</p>}
        {ai.budgetWarning && <p role="status">{ai.budgetWarning}</p>}
        {!session.conversation.length && session.status === 'idle' && (
          <div className="chat-empty">
            <strong>今天想创作什么？</strong>
            <p>选择图层继续编辑，也可以直接描述新的创作。</p>
          </div>
        )}
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
        <div
          className={
            'agent-status chat-progress ' + (agent.running ? 'is-running' : '')
          }
          role={session.error ? 'alert' : 'status'}
        >
          <span>
            {statusLabels[session.status]}
            {session.pendingConfirmation ? ' · 等待确认' : ''}
          </span>
          {(agent.running || session.pendingConfirmation) && (
            <button onClick={() => agent.stop()}>停止</button>
          )}
        </div>
        {session.conversation.length > 0 && (
          <div className="agent-conversation">
            {session.conversation.slice(-6).map((message, index) => (
              <p
                className={'chat-message chat-message-' + message.role}
                key={index}
              >
                <strong>{message.role === 'user' ? '你' : 'Agent'}</strong>{' '}
                {message.content}
              </p>
            ))}
          </div>
        )}
        {session.currentPlan && (
          <section className="agent-plan" aria-label="Agent 计划">
            <strong>{session.currentPlan.goal}</strong>
            <details>
              <summary>执行步骤 · {session.currentPlan.steps.length}</summary>
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
            </details>
            {session.pendingConfirmation && !session.currentPlan.creation && (
              <button
                className="primary"
                onClick={() => {
                  setError('');
                  const submitted = [...session.conversation]
                    .reverse()
                    .find((message) => message.role === 'user')?.content;
                  void agent
                    .apply(session.currentPlan!.id)
                    .then(() => {
                      if (agent.getSnapshot().status === 'completed')
                        setPrompt((current) =>
                          current.trim() === submitted?.trim() ? '' : current,
                        );
                    })
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
        {session.currentPlan?.creation && (
          <CreationReview agent={agent} onAccepted={() => setPrompt('')} />
        )}
        {session.response && (
          <details className="agent-response">
            <summary>处理记录</summary>
            <p>{session.response}</p>
          </details>
        )}
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
                {String(label)}：
                {(items as readonly string[]).join('、') || '无'}
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
        {developerV2 && (
          <details className="agent-verification">
            <summary>开发者：V2 隔离测试</summary>
            <p>不影响当前工程，真实模型测试需自行确认 API 费用。</p>
            {contributionItems('assistant.actions', diagnosticCommands, {
              AssistantMode: true,
            })
              .filter((item) => item.id === 'agent-v2-test')
              .map((item) => (
                <button
                  key={item.id}
                  disabled={item.disabled}
                  onClick={item.action}
                >
                  {item.label}
                </button>
              ))}
          </details>
        )}
        {v2Lab && (
          <AgentV2Lab manager={manager} onClose={() => setV2Lab(false)} />
        )}
        {session.trace && (
          <details className="agent-verification">
            <summary>开发者详情：执行诊断</summary>
            <p>
              仅导出技能版本、对象引用、调用用量与验证状态，不包含输入文字、工程内容或图片。
            </p>
            {diagnosticAction && (
              <button
                disabled={diagnosticAction.disabled}
                onClick={diagnosticAction.action}
              >
                {diagnosticAction.label}
              </button>
            )}
          </details>
        )}
        {!!session.recoveryTrace?.length && (
          <section className="agent-verification" aria-live="polite">
            <p>
              {agent.running
                ? session.recoveryStatus
                : session.status === 'completed'
                  ? '恢复已完成，修改已验证'
                  : '恢复检查已结束'}
            </p>
            <details>
              <summary>
                开发者详情：恢复记录 · {session.recoveryTrace.length}
              </summary>
              <pre>
                {JSON.stringify(
                  diagnosticData({ records: session.recoveryTrace }, 1000000)
                    .records,
                  null,
                  2,
                )}
              </pre>
            </details>
          </section>
        )}
        {session.toolCalls.length > 0 && (
          <details
            className="agent-activity"
            open={
              session.toolCalls.some((t) => t.status === 'failed') || undefined
            }
          >
            <summary>操作记录 · {session.toolCalls.length}</summary>
            {session.toolCalls.slice(-40).map((activity, index) => (
              <div key={index}>
                {activity.status === 'completed'
                  ? '✓'
                  : activity.status === 'failed'
                    ? '×'
                    : '…'}{' '}
                {activity.label}
                {activity.status === 'failed' && activity.result != null && (
                  <details>
                    <summary>开发者详情：错误字段与调用参数</summary>
                    <pre>{JSON.stringify(activity.result, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </details>
        )}
        {!!session.visualReviews?.length && (
          <details className="agent-preview">
            <summary>
              视觉检查与局部修正 · {session.visualReviews.length}
            </summary>
            {session.visualReviews.map((r) => (
              <figure key={r.iteration}>
                {r.image && (
                  <img
                    src={r.image}
                    alt={'实际渲染 · 第 ' + r.iteration + ' 轮'}
                  />
                )}
                <figcaption>
                  {r.iteration === 0 ? '初次检查' : '修正 ' + r.iteration} ·{' '}
                  {r.message}
                </figcaption>
              </figure>
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
        <div
          className={`agent-references ${referenceDrag ? 'drag-over' : ''}`}
          role="region"
          aria-label="参考图：支持拖入或粘贴"
          tabIndex={0}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes('Files')) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'copy';
            setReferenceDrag(true);
          }}
          onDragLeave={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              setReferenceDrag(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setReferenceDrag(false);
            void addReferences(Array.from(event.dataTransfer.files));
          }}
        >
          <small>拖入或粘贴参考图片</small>
          <label className="ai-file">
            <Icon name="image" />
            {importing ? '读取中…' : '参考素材'}
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
                void addReferences([file]);
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
              <img src={ref.frames[0]} alt={'参考预览 ' + ref.name} />
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
      </div>
      <AssistantComposer
        store={store}
        manager={manager}
        prompt={prompt}
        setPrompt={setPrompt}
        busy={agent.running}
        blocked={!configured || importing || session.pendingConfirmation}
        locked={importing || session.pendingConfirmation}
        removableReferences={false}
        label="Agent 需求"
        maxLength={10000}
        onSend={(reference) => {
          const project = store.getSnapshot().project;
          if (
            reference.projectId !== project.id ||
            reference.compositionId !== activeComposition(project).id
          ) {
            setError('工程已变化，请重新选择');
            return;
          }
          submit();
        }}
        onStop={() => agent.stop()}
        onClear={() => {
          referenceImport.current?.abort();
          agent.restoreConversation([]);
          agent.setReferences([], session.referenceMode);
          setImporting(false);
          setError('');
        }}
        skillId={session.skillId}
        skills={skillState.skills.filter((v) => v.enabled)}
        onSkill={(id) => agent.setSkill(id)}
      >
        <label>
          模式
          <select
            aria-label="Agent 模式"
            value={session.mode}
            disabled={agent.running}
            onChange={(e) =>
              agent.setMode(e.target.value as 'ASSIST' | 'AGENT')
            }
          >
            <option value="AGENT">执行</option>
            <option value="ASSIST">辅助</option>
          </select>
        </label>
      </AssistantComposer>
    </section>
  );
}
