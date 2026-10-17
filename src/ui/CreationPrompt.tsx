import { useState, useSyncExternalStore } from 'react';
import type { AgentOrchestrator } from '../agent/orchestrator';
import type { ExecutionScope } from '../agent/creation-contracts';
import type { EditorStore } from './editor-store';
import { nativeAgentFor } from './native-agent-controller';
import { graphBranch } from '../agent/creation-scope';
import { activeComposition } from '../core/project-model';
export function CreationReview({
  agent,
  onAccepted,
}: {
  agent: AgentOrchestrator;
  onAccepted?: () => void;
}) {
  const session = useSyncExternalStore(agent.subscribe, agent.getSnapshot),
    [error, setError] = useState('');
  const proposal = session.creationProposal;
  if (!session.currentPlan) return null;
  return (
    <section aria-label="创作修改方案" className="agent-plan">
      {session.currentPlan.creation && (
        <ol>
          {session.currentPlan.creation.tasks.map((t) => (
            <li key={t.id}>
              {t.description} ·{' '}
              {
                {
                  'modify-existing': '修改已有内容',
                  reuse: '复用现有能力',
                  compose: '组合现有能力',
                  generate: '生成',
                  forge: '程序化草稿',
                }[t.strategy]
              }
            </li>
          ))}
        </ol>
      )}
      {proposal && (
        <>
          <p>
            图层：新增 {proposal.objects.created.length} / 修改{' '}
            {proposal.objects.modified.length} / 删除{' '}
            {proposal.objects.deleted.length}；节点：新增{' '}
            {proposal.nodes.created.length} / 修改{' '}
            {proposal.nodes.modified.length} / 删除{' '}
            {proposal.nodes.deleted.length}
          </p>
          <p>
            连接：新增 {proposal.connections.created.length} / 移除{' '}
            {proposal.connections.deleted.length}；保持不变：
            {proposal.objects.unchanged.length} 个图层、
            {proposal.nodes.unchanged.length} 个节点
          </p>
          <details>
            <summary>查看受影响与保留内容</summary>
            <p>
              修改：
              {[
                ...proposal.objects.created,
                ...proposal.objects.modified,
                ...proposal.objects.deleted,
                ...proposal.nodes.created,
                ...proposal.nodes.modified,
                ...proposal.nodes.deleted,
              ]
                .map((id) => proposal.labels[id] ?? id)
                .join('、') || '无'}
            </p>
            <p>
              保留：
              {[...proposal.objects.unchanged, ...proposal.nodes.unchanged]
                .map((id) => proposal.labels[id] ?? id)
                .join('、') || '无'}
            </p>
          </details>
          <ul>
            {proposal.parameters.map((p) => (
              <li key={p.nodeId + p.key}>
                {p.key}: {JSON.stringify(p.before)} → {JSON.stringify(p.after)}
              </li>
            ))}
          </ul>
          <p>{proposal.estimatedCost.note}</p>
          {proposal.warnings.map((warning, index) => (
            <p role="status" key={index}>
              {warning}
            </p>
          ))}
        </>
      )}
      {session.usage.some((u) => u) && (
        <p>
          模型用量：
          {session.usage.reduce(
            (sum, u) => sum + (u?.totalTokens ?? 0),
            0,
          )}{' '}
          tokens；费用以服务账单为准。
        </p>
      )}
      {session.previewSnapshot && (
        <img
          src={session.previewSnapshot}
          alt="修改方案预览（尚未应用）"
          style={{ width: '100%', maxHeight: 240, objectFit: 'contain' }}
        />
      )}
      {session.pendingConfirmation && (
        <>
          <button
            disabled={agent.running}
            onClick={() => {
              setError('');
              void agent
                .preview(session.currentPlan!.id)
                .catch((e) => setError(e.message));
            }}
          >
            预览修改方案
          </button>
          <button
            disabled={!proposal}
            onClick={() => {
              setError('');
              void agent
                .apply(session.currentPlan!.id)
                .then(() => {
                  if (agent.getSnapshot().status === 'completed')
                    onAccepted?.();
                })
                .catch((e) => setError(e.message));
            }}
          >
            接受修改
          </button>
          <button onClick={() => agent.stop()}>拒绝方案</button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function CreationPrompt({
  store,
  initialScope,
}: {
  store: EditorStore;
  initialScope: ExecutionScope;
}) {
  const agent = nativeAgentFor(store),
    session = useSyncExternalStore(agent.subscribe, agent.getSnapshot);
  const [prompt, setPrompt] = useState(''),
    [kind, setKind] = useState(initialScope.kind),
    [error, setError] = useState('');
  const c = activeComposition(store.getSnapshot().project);
  const layer =
    initialScope.kind !== 'FULL_COMPOSITION'
      ? c.layers.find((l) => l.id === initialScope.layerId)
      : undefined;
  const ids =
    initialScope.kind !== 'FULL_COMPOSITION' ? initialScope.nodeIds : [];
  const targets =
    kind === 'SELECTED_BRANCH' && layer?.editor?.graph
      ? graphBranch(layer.editor.graph, ids)
      : ids;
  const scoped =
    session.executionScope &&
    session.executionScope.compositionId === initialScope.compositionId &&
    (initialScope.kind === 'FULL_COMPOSITION'
      ? session.executionScope.kind === 'FULL_COMPOSITION'
      : session.executionScope.kind !== 'FULL_COMPOSITION' &&
        session.executionScope.layerId === initialScope.layerId &&
        ids.every(
          (id) =>
            session.executionScope!.kind !== 'FULL_COMPOSITION' &&
            session.executionScope!.nodeIds.includes(id),
        ));
  return (
    <section aria-label="AI 创作请求">
      {initialScope.kind !== 'FULL_COMPOSITION' && (
        <label>
          修改范围
          <select
            aria-label="AI 修改范围"
            disabled={agent.running || session.pendingConfirmation}
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="PARAMETER_ONLY">仅节点参数（默认）</option>
            <option value="SELECTED_NODE">选中节点</option>
            <option value="SELECTED_BRANCH">上游分支</option>
          </select>
        </label>
      )}
      <p>
        {initialScope.kind === 'FULL_COMPOSITION'
          ? '为当前合成规划可编辑内容'
          : `可修改：${targets.map((id) => layer?.editor?.graph?.nodes.find((n) => n.id === id)?.name ?? id).join('、')}；其他节点和图层保持不变。`}
      </p>
      <textarea
        aria-label="AI 创作需求"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          initialScope.kind === 'FULL_COMPOSITION'
            ? '描述背景、文字和动画…'
            : '描述当前节点或分支需要如何修改…'
        }
        rows={3}
      />
      <button
        disabled={
          !prompt.trim() || agent.running || session.pendingConfirmation
        }
        onClick={() => {
          setError('');
          const scope =
            initialScope.kind === 'FULL_COMPOSITION'
              ? initialScope
              : {
                  ...initialScope,
                  kind: kind as
                    'PARAMETER_ONLY' | 'SELECTED_NODE' | 'SELECTED_BRANCH',
                };
          void agent.run(prompt, scope).catch((e) => setError(e.message));
        }}
      >
        生成修改方案
      </button>
      {scoped && (
        <>
          <p role="status">
            {agent.running ? '正在分析结构并规划修改…' : session.response}
          </p>
          <CreationReview agent={agent} onAccepted={() => setPrompt('')} />
          {session.error && <p role="alert">{session.error}</p>}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
