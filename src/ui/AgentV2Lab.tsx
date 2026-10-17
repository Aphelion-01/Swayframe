import { useEffect, useRef, useState } from 'react';
import { createDefaultProject } from '../core/project-model';
import { EditorStore } from './editor-store';
import { AgentSnapshotRenderer } from '../agent/vision';
import type { AIProviderManager } from '../ai/provider-manager';
import {
  createProviderCoreV2,
  exportCoreV2Diagnostic,
} from '../agent-v2/provider-session';
import type { TaskState } from '../agent-v2/runtime';
import { Modal } from './workspace/primitives';
import { downloadBlob } from './file-utils';
import './agent-v2-lab.css';

const labels = {
  IDLE: '就绪',
  PLANNING: '真实模型正在规划',
  EXECUTING: '正在执行隔离草稿',
  RECOVERING: '正在修复失败操作，已完成操作保持不变',
  VERIFYING: '正在验证与渲染',
  AWAITING_ACCEPTANCE: '结果待接受',
  COMPLETED: '已提交到隔离工程',
  FAILED: '任务失败，未提交',
  CANCELLED: '已停止，未提交',
  DISCARDED: '已拒绝，未提交',
};
const actionLabels: Record<string, string> = {
  createShape: '创建图形',
  createText: '创建文字',
  setPosition: '调整位置',
  setFill: '调整填充',
  setProperty: '修改属性',
  addKeyframe: '添加关键帧',
  modifyKeyframe: '修改关键帧',
  addGaussianBlur: '添加模糊效果',
};
const stepLabels = {
  PENDING: '待执行',
  READY: '就绪',
  RUNNING: '执行中',
  RECOVERING: '修复中',
  SUCCEEDED: '已完成',
  FAILED: '失败',
  CANCELLED: '已停止',
};
export function AgentV2Lab({
  manager,
  onClose,
}: {
  manager: AIProviderManager;
  onClose: () => void;
}) {
  // Never receives the user's EditorStore. No persistence, autosave or Legacy executor.
  const [store] = useState(() => new EditorStore(createDefaultProject()));
  const session = useRef<ReturnType<typeof createProviderCoreV2> | null>(null);
  const alive = useRef(true);
  const rendering = useRef<AbortController | null>(null);
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'tools' | 'structured-plan'>('tools');
  const [prompt, setPrompt] = useState(''),
    [error, setError] = useState('');
  const [state, setState] = useState<TaskState | null>(null),
    [image, setImage] = useState('');
  const [time, setTime] = useState(0);
  const refresh = () =>
    setState(session.current?.runtime.getSnapshot() ?? null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      session.current?.runtime.discard();
      rendering.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!busy) return;
    const interval = setInterval(refresh, 120);
    return () => clearInterval(interval);
  }, [busy]);
  const preview = async (nextTime: number) => {
    rendering.current?.abort();
    const controller = new AbortController();
    rendering.current = controller;
    const runtime = session.current?.runtime;
    const project =
      runtime &&
      (runtime.getSnapshot().phase === 'AWAITING_ACCEPTANCE' ||
        (runtime.getSnapshot().phase === 'FAILED' &&
          runtime.getSnapshot().draftDisposition === 'INSPECTABLE'))
        ? runtime.draftSnapshot()
        : store.commands.getSnapshot();
    try {
      const result = await new AgentSnapshotRenderer().render(
        project,
        nextTime,
        controller.signal,
      );
      if (alive.current && !controller.signal.aborted) setImage(result.image);
    } catch {
      if (alive.current && !controller.signal.aborted) setError('预览未完成');
    }
  };
  const run = async () => {
    if (
      !enabled ||
      busy ||
      !prompt.trim() ||
      state?.phase === 'AWAITING_ACCEPTANCE'
    )
      return;
    setError('');
    setImage('');
    setBusy(true);
    try {
      const project = store.commands.getSnapshot();
      session.current = createProviderCoreV2({
        isolatedProject: true,
        host: store.commands,
        manager,
        mode,
        scope: {
          compositionId: project.activeCompositionId,
          existingLayerIds: [],
          allowCreate: true,
        },
        renderer: async (project, time, signal) => {
          const result = await new AgentSnapshotRenderer().render(
            project,
            time,
            signal,
            undefined,
            undefined,
            true,
          );
          return { image: result.image, ...result.pixelEvidence! };
        },
      });
      refresh();
      const result = await session.current.runtime.planAndRun(
        prompt,
        session.current.planner,
      );
      if (alive.current) {
        setState(result);
        setTime(0);
        if (result.preview) setImage(result.preview.image);
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : '任务未完成');
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const accept = () => {
    try {
      const runtime = session.current?.runtime,
        id = runtime?.getSnapshot().proposalId;
      if (id) runtime!.accept(id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '接受失败');
      refresh();
    }
  };
  const close = () => {
    session.current?.runtime.discard();
    onClose();
  };
  const current = state?.steps.find((step) =>
    ['RUNNING', 'RECOVERING', 'FAILED'].includes(step.status),
  );
  const inspectable =
    state?.phase === 'FAILED' &&
    state.draftDisposition === 'INSPECTABLE' &&
    state.completedActions.length > 0;
  const terminalError =
    error || (state?.phase === 'FAILED' ? state.errors.at(-1)?.message : '');
  const diagnostic = exportCoreV2Diagnostic(
    state,
    session.current ?? undefined,
  );
  return (
    <Modal onClose={close}>
      <section
        className="dialog agent-v2-lab"
        role="dialog"
        aria-modal="true"
        aria-label="Agent Core V2 隔离测试"
      >
        <header>
          <strong>Agent Core V2 · 隔离测试工程</strong>
          <button onClick={close}>关闭 / 返回 Legacy V1</button>
        </header>
        <p>
          普通工程仍由 Legacy V1
          管理。本窗口仅创建独立工程；接受不会写入原工程。真实请求使用现有 AI
          设置和账户，产生 API 费用。
        </p>
        <label>
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy || state?.phase === 'AWAITING_ACCEPTANCE'}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          明确启用 Agent Core V2 隔离测试
        </label>
        <label>
          响应模式{' '}
          <select
            value={mode}
            disabled={busy}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="tools">Function Calling（需端点支持）</option>
            <option value="structured-plan">
              Structured Intent JSON（需端点支持）
            </option>
          </select>
        </label>
        <textarea
          aria-label="V2 测试任务"
          value={prompt}
          disabled={busy}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="输入基础创作任务；暂不支持参考图片、Skill 或 Effect Forge"
        />
        <div className="dialog-actions">
          <button
            disabled={
              !enabled ||
              busy ||
              !prompt.trim() ||
              state?.phase === 'AWAITING_ACCEPTANCE'
            }
            onClick={() => void run()}
          >
            执行隔离任务
          </button>
          <button
            disabled={!busy}
            onClick={() => {
              session.current?.runtime.cancel();
              refresh();
            }}
          >
            停止
          </button>
          <button
            disabled={state?.phase !== 'AWAITING_ACCEPTANCE'}
            onClick={accept}
          >
            接受到隔离工程
          </button>
          <button
            disabled={state?.phase !== 'AWAITING_ACCEPTANCE'}
            onClick={() => {
              session.current?.runtime.discard();
              refresh();
              void preview(0);
            }}
          >
            拒绝结果
          </button>
          <button
            disabled={
              busy ||
              state?.phase === 'AWAITING_ACCEPTANCE' ||
              !store.commands.undoStack.length
            }
            onClick={() => {
              store.commands.undo();
              refresh();
              void preview(time);
            }}
          >
            Undo
          </button>
          <button
            disabled={
              busy ||
              state?.phase === 'AWAITING_ACCEPTANCE' ||
              !store.commands.redoStack.length
            }
            onClick={() => {
              store.commands.redo();
              refresh();
              void preview(time);
            }}
          >
            Redo
          </button>
        </div>
        <p role="status">
          {state
            ? labels[state.phase]
            : 'Legacy V1 为默认运行时；V2 等待明确启用'}
          {session.current
            ? ` · ${session.current.provider} / ${session.current.model}`
            : ''}
        </p>
        {state && state.steps.length > 0 && (
          <p aria-label="任务进度">
            已完成 {state.completedActions.length} / {state.steps.length} 步
            {current
              ? ` · ${actionLabels[current.action.type] ?? current.action.type}：${stepLabels[current.status]}`
              : ''}
            {state.recoveries.some((r) => r.outcome === 'SUCCEEDED')
              ? ` · 已恢复 ${state.recoveries.filter((r) => r.outcome === 'SUCCEEDED').length} 次`
              : ''}
          </p>
        )}
        {terminalError && <p role="alert">{terminalError}</p>}
        {state?.phase === 'FAILED' && (
          <p>
            {state.draftDisposition === 'UNSAFE'
              ? '操作结果不确定，已阻止重试和提交。'
              : '已完成操作保留供检查；未完成草稿不能接受。'}{' '}
            输入已保留，可修改后重新执行独立任务。
            {inspectable && (
              <button onClick={() => void preview(time)}>检查未完成草稿</button>
            )}
          </p>
        )}
        {inspectable && image && <p>未完成草稿 · 仅供检查，不代表任务通过</p>}
        <div className="agent-v2-preview">
          {image ? (
            <img src={image} alt="实际 Renderer 输出的隔离工程画面" />
          ) : (
            <span>执行并通过验证后显示实际画布</span>
          )}
        </div>
        <label>
          预览时间{' '}
          <input
            aria-label="隔离预览时间"
            type="range"
            min="0"
            max="5"
            step="0.033333333"
            value={time}
            disabled={busy || !image}
            onChange={(e) => {
              const value = Number(e.target.value);
              setTime(value);
              void preview(value);
            }}
          />
          {time.toFixed(3)} s
        </label>
        <details>
          <summary>执行计划与对象引用 · {state?.steps.length ?? 0} 步</summary>
          <ol>
            {state?.steps.map((step) => (
              <li key={step.action.id}>
                {actionLabels[step.action.type] ?? step.action.type} ·{' '}
                {stepLabels[step.status]} · 尝试 {step.attempts} 次
                <pre>
                  {JSON.stringify(
                    {
                      action: step.action,
                      result: step.result,
                      draftVersion: step.draftVersion,
                      failure: step.failure
                        ? { code: step.failure.code, field: step.failure.field }
                        : null,
                    },
                    null,
                    2,
                  )}
                </pre>
              </li>
            ))}
          </ol>
        </details>
        <details>
          <summary>脱敏执行 Trace</summary>
          <p>诊断导出不包含输入、模型原文、工程内容或图片。</p>
          <button
            onClick={() =>
              downloadBlob(
                new Blob([diagnostic], {
                  type: 'application/json',
                }),
                'swayframe-core-v2-diagnostic.json',
              )
            }
          >
            导出脱敏诊断
          </button>
          <pre>{diagnostic}</pre>
        </details>
        <p>
          基础执行试验：正式 Canary 与替换门禁尚未通过。Gaussian Blur
          当前只能添加实例，不能修改 Radius。
        </p>
      </section>
    </Modal>
  );
}
