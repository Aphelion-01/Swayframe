import { AssistantComposer, type PromptReference } from './AssistantComposer';
import { NativeSkillRegistry } from '../agent/native-skill-runtime';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CoreV2EditorController } from './core-v2-controller';
import { CommandRegistry } from './workspace/command-registry';
import { useCommandScope } from './workspace/scoped-commands';
import { contributionItems } from './workspace/feature-contributions';
import { downloadBlob } from './file-utils';
const phases: Record<string, string> = {
  IDLE: '就绪',
  PLANNING: '正在分析任务',
  EXECUTING: '正在编辑草稿',
  RECOVERING: '正在根据错误修复任务，已完成步骤保留',
  VERIFYING: '正在验证与渲染',
  AWAITING_ACCEPTANCE: '等待接受修改',
  COMPLETED: '修改已验证并提交',
  FAILED: '任务未完成，正式工程未被提交',
  CANCELLED: '已停止，草稿未提交',
  DISCARDED: '已拒绝，草稿未提交',
};
const actions: Record<string, string> = {
  createShape: '创建图形',
  createText: '创建文字',
  setFill: '调整填充',
  setProperty: '调整属性',
  setDimensions: '调整宽高',
  setFont: '调整字体',
  addKeyframe: '添加关键帧',
  modifyKeyframe: '调整插值',
  deleteKeyframe: '移除指定关键帧',
  addEffect: '添加效果',
  createNative: '创建原生图层',
  editNative: '编辑原生属性',
};
const nativeLabels: Record<string, string> = {
  createLayer: '创建图层',
  createPolygon: '创建多边形',
  createStar: '创建星形',
  createPath: '创建路径',
  createLayerFromAsset: '使用素材创建图层',
  setAnchor: '修改锚点',
  setStroke: '修改描边',
  setTextContent: '修改文本',
  setTextColor: '修改文字颜色',
  setTextAlignment: '修改文字对齐',
  setTracking: '修改字距',
  setLeading: '修改行距',
  renameLayer: '重命名图层',
  reorderLayer: '调整图层顺序',
  setLayerVisibility: '修改可见性',
  setParent: '设置父级',
  replaceAssetReference: '替换素材',
  removeEffect: '移除效果（需审阅）',
  setEffectParameter: '修改效果参数',
  enableEffect: '切换效果',
  reorderEffect: '调整效果顺序',
  createMask: '创建遮罩',
  setMaskMode: '修改遮罩模式',
  setMaskPath: '修改遮罩路径',
  setMaskFeather: '修改遮罩羽化',
  setMaskOpacity: '修改遮罩透明度',
  setMaskExpansion: '修改遮罩扩张',
  addKeyframe: '添加关键帧',
  moveKeyframe: '移动关键帧',
  setKeyframeValue: '修改关键帧值',
  setInterpolation: '修改插值',
  deleteKeyframe: '删除关键帧',
};
export function AgentV2EditorPanel({
  controller: core,
}: {
  controller: CoreV2EditorController;
}) {
  useSyncExternalStore(core.subscribe, core.getRevision);
  const ai = useSyncExternalStore(
    core.manager.subscribe,
    core.manager.getSnapshot,
  );
  const [prompt, setPrompt] = useState(''),
    [error, setError] = useState('');
  const [messages, setMessages] = useState<
    { text: string; summary?: string; names: string[] }[]
  >([]);
  const [skillId, setSkillId] = useState(core.skillId);
  const end = useRef<HTMLDivElement>(null);
  const projectId = core.store.getSnapshot().project.id;
  useEffect(() => {
    setMessages([]);
    setPrompt('');
    setError('');
  }, [projectId]);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages.length]);
  const state = core.state,
    busy = core.running,
    pending = core.pending;
  let configured = false;
  try {
    const route = core.manager.resolve('planning');
    configured =
      route.provider.type === 'mock' || !!ai.credentials[route.provider.id];
  } catch {
    /* Display setup guidance. */
  }
  const commands = new CommandRegistry(() => [
    {
      id: 'agent-export-diagnostic',
      label: '导出执行诊断',
      disabled: busy || !state,
      action: () =>
        downloadBlob(
          new Blob([core.diagnostic()], { type: 'application/json' }),
          'swayframe-v2-' + core.session.id + '.json',
        ),
    },
    {
      id: 'agent-v2-edit-mode',
      label: '切换 V2 编辑模式',
      disabled: busy || pending,
      action: () =>
        core.setEditMode(core.editMode === 'review' ? 'direct' : 'review'),
    },
    {
      id: 'agent-v2-new-session',
      label: '新会话',
      disabled: busy || pending,
      action: () => {
        core.newSession();
        setError('');
        setMessages([]);
      },
    },
  ]);
  useCommandScope(core.store, commands.definitions());
  const items = contributionItems('assistant.actions', commands, {
    AssistantMode: true,
  }).filter((i) => i.id !== 'agent-v2-edit-mode');
  const act = (fn: () => void) => {
    setError('');
    try {
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作未完成');
    }
  };
  const send = (reference: PromptReference) => {
    if (!prompt.trim() || busy || pending || !configured) return;
    setError('');
    const submitted = prompt;
    const previous =
      core.lastOperation ||
      (core.state?.phase === 'FAILED'
        ? core.state.errors.at(-1)?.message
        : '') ||
      phases[core.state?.phase ?? 'IDLE'];
    setMessages((value) =>
      [
        ...value.map((v, i) =>
          i === value.length - 1 ? { ...v, summary: previous } : v,
        ),
        {
          text: submitted,
          names: reference.layerIds.map(
            (id) =>
              core.store
                .getSnapshot()
                .project.compositions.find(
                  (c) => c.id === reference.compositionId,
                )
                ?.layers.find((l) => l.id === id)?.name ?? id,
          ),
        },
      ].slice(-40),
    );
    void core
      .run(submitted, reference)
      .then(() => {
        if (core.state?.phase === 'COMPLETED' || core.lastOperation)
          setPrompt((value) => (value === submitted ? '' : value));
      })
      .catch((e) => setError(e instanceof Error ? e.message : '请求未完成'));
  };
  return (
    <section
      className="agent-panel native-agent-panel agent-v2-editor assistant-chat"
      aria-label="Agent Core V2 Beta"
    >
      <div className="chat-transcript" role="log" aria-label="助手对话记录">
        <div className="agent-heading">
          <strong>Agent · Core V2 Beta</strong>
        </div>
        {!messages.length && !state && (
          <div className="chat-empty">
            <strong>今天想创作什么？</strong>
            <p>创建图层、调整效果，或为选中对象添加动画。</p>
          </div>
        )}
        {messages.map((message, index) => (
          <div className="chat-turn" key={index}>
            <div className="chat-message chat-message-user">
              {message.names.length > 0 && (
                <div className="chat-message-references">
                  {message.names.map((name, i) => (
                    <span key={i}>{name}</span>
                  ))}
                </div>
              )}
              {message.text}
            </div>
            {message.summary && (
              <p className="chat-message chat-message-assistant">
                {message.summary}
              </p>
            )}
          </div>
        ))}
        {!configured && (
          <p role="status">
            请配置支持所选协议的模型及密钥。发送请求会使用当前账户API额度。
          </p>
        )}
        <div
          className={'agent-status chat-progress ' + (busy ? 'is-running' : '')}
          role="status"
          aria-live="polite"
        >
          <span>
            {busy && !state
              ? '正在准备当前工程'
              : core.error && !state
                ? '本轮请求未启动'
                : core.lastOperation || phases[state?.phase ?? 'IDLE']}{' '}
            {busy &&
              state?.steps.find(
                (s) => s.status === 'RUNNING' || s.status === 'RECOVERING',
              ) &&
              ' · ' +
                (() => {
                  const a = state.steps.find(
                    (s) => s.status === 'RUNNING' || s.status === 'RECOVERING',
                  )!.action;
                  return 'tool' in a ? nativeLabels[a.tool] : actions[a.type];
                })()}
            {busy &&
              state &&
              state.providerRetries > 0 &&
              ' · 服务重试 ' + state.providerRetries + '/1'}
            · 第{core.session.turn}轮{' '}
            {state &&
              `· ${state.completedActions.length}/${state.steps.length}步`}
          </span>
        </div>
        {(core.error || error) && <p role="alert">{error || core.error}</p>}
        {state?.phase === 'FAILED' && (
          <p role="alert">
            {state.errors.at(-1)?.message}。已接受的前轮结果保留。
          </p>
        )}
        {core.reviewReason && <p role="status">{core.reviewReason}</p>}
        {pending && (
          <div className="agent-proposal-actions">
            <button
              className="primary"
              onClick={() =>
                act(() => {
                  core.accept();
                  setPrompt('');
                })
              }
            >
              接受修改
            </button>
            <button onClick={() => act(() => core.reject())}>拒绝草稿</button>
          </div>
        )}
        {state?.steps.length ? (
          <details className="agent-plan">
            <summary>本轮操作 · {state.steps.length}</summary>
            <ol>
              {state.steps.map((s) => (
                <li key={s.action.id}>
                  {s.status === 'SUCCEEDED' ? '✓ ' : ''}
                  {'tool' in s.action
                    ? nativeLabels[s.action.tool]
                    : (actions[s.action.type] ?? s.action.type)}
                  {'property' in s.action ? ' · ' + s.action.property : ''}
                </li>
              ))}
            </ol>
          </details>
        ) : null}
        {state?.preview && (
          <details className="chat-result">
            <summary>
              {state.phase === 'COMPLETED' ? '查看结果' : '查看草稿'}
            </summary>
            <figure className="agent-preview">
              <img
                src={state.preview.image}
                alt={
                  state.phase === 'COMPLETED'
                    ? '已提交结果'
                    : '本轮草稿预览（尚未提交）'
                }
              />
              <figcaption>
                {state.phase === 'COMPLETED'
                  ? '已提交结果'
                  : '草稿 · 尚未写入正式工程'}
              </figcaption>
            </figure>
          </details>
        )}
        {state?.phase === 'COMPLETED' && (
          <button
            disabled={
              core.store.commands.undoStack.at(-1)?.transaction.id !==
              state.changes?.transactionId
            }
            title="仅当本轮事务仍是历史最后一笔时可直接撤销；其他情况使用全局撤销"
            onClick={() => core.store.undo()}
          >
            撤销本轮修改
          </button>
        )}
        <details className="agent-verification">
          <summary>会话与开发诊断</summary>
          <p className="metadata">
            支持原生图形、文字、已有图片素材、属性、旋转动画、效果与遮罩。参考图、Forge、预设、跨合成结构与破坏性工具尚未对齐；三维仅支持现有工具可表达的属性，不会静默切换V1。
          </p>
          <p>
            对象序号优先使用本会话创建顺序，否则使用当前图层列表顺序。目标不明确时，请选择图层。关闭助手会停止未接受任务；切换引擎会丢弃未接受草稿。
          </p>
          <p>
            运行中任务不支持跨重启恢复。重新打开工程后会重新验证对象；重启后可选择已有图层继续编辑。
          </p>
          {items.map((i) => (
            <button key={i.id} disabled={i.disabled} onClick={i.action}>
              {i.label}
            </button>
          ))}
          <p>
            诊断只含身份、字段和验证/用量信息，不含输入文字、工程内容、图片或密钥。
          </p>
        </details>
        <div ref={end} />
      </div>
      <AssistantComposer
        store={core.store}
        manager={core.manager}
        prompt={prompt}
        setPrompt={setPrompt}
        busy={busy}
        blocked={!configured || pending}
        locked={pending}
        label="V2 Agent 需求"
        onSend={send}
        onStop={() => core.cancel()}
        onClear={() => {
          if (core.pending) core.reject();
          core.newSession();
          setMessages([]);
          setError('');
        }}
        skillId={skillId}
        skills={new NativeSkillRegistry()
          .all()
          .filter(
            (s) =>
              core.manager.getSnapshot().settings.agent.nativeSkills !==
                false &&
              !core.manager
                .getSnapshot()
                .settings.agent.disabledNativeSkills?.includes(s.manifest.id),
          )
          .map((s) => ({ id: s.manifest.id, name: s.manifest.name }))}
        onSkill={(id) => {
          core.skillId = id;
          setSkillId(id);
        }}
      >
        <label>
          编辑方式
          <select
            aria-label="V2 编辑模式"
            disabled={busy || pending}
            value={core.editMode}
            onChange={(e) =>
              core.setEditMode(e.target.value as 'review' | 'direct')
            }
          >
            <option value="review">审阅后应用</option>
            <option value="direct">直接编辑（可撤销）</option>
          </select>
        </label>
      </AssistantComposer>
    </section>
  );
}
