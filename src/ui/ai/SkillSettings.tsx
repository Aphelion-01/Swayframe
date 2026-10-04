import { useRef, useState, useSyncExternalStore } from 'react';
import { skillsFor } from '../../agent/skills';
import type { AgentSkill } from '../../agent/skills';
import type { AIProviderManager } from '../../ai/provider-manager';
export function SkillSettings({ manager }: { manager: AIProviderManager }) {
  const skills = skillsFor(manager.storage),
    state = useSyncExternalStore(skills.subscribe, skills.getSnapshot);
  const [editing, setEditing] = useState<AgentSkill>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const run = (job: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    void job()
      .catch((e) => setError(e instanceof Error ? e.message : 'Skill操作失败'))
      .finally(() => setBusy(false));
  };
  if (!state.ready) return <p role="status">正在读取 Skill…</p>;
  return (
    <section aria-label="Skill 管理">
      {error && <p role="alert">{error}</p>}
      {state.error && <p role="alert">{state.error}</p>}
      <div className="ai-actions">
        <button
          disabled={busy}
          onClick={() =>
            setEditing({
              id: crypto.randomUUID(),
              name: '我的 Skill',
              description: '',
              instructions: '',
              allowedTools: [],
              source: 'user',
              enabled: true,
            })
          }
        >
          创建 Skill
        </button>
        <button disabled={busy} onClick={() => importRef.current?.click()}>
          导入 Skill
        </button>
        <input
          type="file"
          accept="application/json,.json"
          ref={importRef}
          hidden
          aria-label="导入 Skill 文件"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              run(async () => {
                if (file.size > 100000) throw Error('Skill文件超过100KB');
                await skills.import(await file.text());
              });
            e.target.value = '';
          }}
        />
      </div>
      {editing ? (
        <form
          className="ai-provider-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await skills.save(editing);
              setEditing(undefined);
            });
          }}
        >
          <h3>
            {editing.source === 'builtin' ? '查看内置 Skill' : '编辑用户 Skill'}
          </h3>
          <label>
            名称
            <input
              aria-label="Skill 名称"
              value={editing.name}
              readOnly={editing.source === 'builtin'}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </label>
          <label>
            说明
            <input
              aria-label="Skill 说明"
              value={editing.description}
              readOnly={editing.source === 'builtin'}
              onChange={(e) =>
                setEditing({ ...editing, description: e.target.value })
              }
            />
          </label>
          <label>
            专业指令
            <textarea
              aria-label="Skill 指令"
              rows={7}
              value={editing.instructions}
              readOnly={editing.source === 'builtin'}
              onChange={(e) =>
                setEditing({ ...editing, instructions: e.target.value })
              }
            />
          </label>
          <label>
            允许工具
            <textarea
              aria-label="Skill 允许工具"
              placeholder="逗号分隔工具名称；留空表示不允许工具"
              rows={3}
              value={editing.allowedTools?.join(', ') ?? ''}
              readOnly={editing.source === 'builtin'}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  allowedTools: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <p className="metadata">
            Skill 只提供指令和工具范围，不能执行脚本或扩大应用权限。内置通用
            Skill 使用注册工具。
          </p>
          <div className="ai-actions">
            <button type="button" onClick={() => setEditing(undefined)}>
              返回
            </button>
            {editing.source === 'user' && (
              <button disabled={busy} type="submit">
                保存 Skill
              </button>
            )}
          </div>
        </form>
      ) : (
        state.skills.map((s) => (
          <div className="ai-provider-row" key={s.id}>
            <strong>{s.name}</strong>
            <p className="metadata">
              {s.description} · {s.source === 'builtin' ? '内置' : '用户'}
            </p>
            <div className="ai-actions">
              <button disabled={busy} onClick={() => setEditing(s)}>
                {s.source === 'builtin' ? '查看' : '编辑'}
              </button>
              <button
                disabled={busy}
                onClick={() => run(() => skills.toggle(s.id, !s.enabled))}
              >
                {s.enabled ? '停用' : '启用'}
              </button>
              <button
                disabled={busy}
                onClick={() => run(() => skills.duplicate(s.id))}
              >
                复制
              </button>
              {s.source === 'user' && (
                <button
                  disabled={busy}
                  onClick={() => run(() => skills.delete(s.id))}
                >
                  删除
                </button>
              )}
              <button
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([skills.export(s.id)], {
                      type: 'application/json',
                    }),
                  );
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'Swayframe-Skill.json';
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                导出
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
