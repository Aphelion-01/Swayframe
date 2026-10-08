import { useEffect, useRef, useState } from 'react';
import { effectForge } from '../core/effect-forge';
import { organicTexturePackage } from '../core/effect-examples';
import { UserEffectLibrary } from '../core/effect-library';
import type { EffectPackage } from '../core/programmable-effect';
import { runtimeLimits } from '../core/programmable-effect';
import { NumberField } from './fields';
function PixelPreview({
  pixels,
  width,
  height,
}: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) {
      const image = ctx.createImageData(width, height);
      image.data.set(pixels);
      ctx.putImageData(image, 0, 0);
    }
  }, [pixels, width, height]);
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      aria-label="效果真实像素预览"
      style={{
        width: '100%',
        maxWidth: 384,
        aspectRatio: '16/9',
        background: '#111',
      }}
    />
  );
}
function exportPackage(p: EffectPackage) {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }),
    ),
    a = document.createElement('a');
  a.href = url;
  a.download = p.id + '-' + p.version + '.sfe.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function EffectForgePanel({
  mode,
  onApply,
  query = '',
  group = 'all',
}: {
  mode: 'library' | 'drafts';
  query?: string;
  group?: string;
  onApply: (p: EffectPackage, independent: boolean) => boolean;
}) {
  const [revision, refresh] = useState(0),
    [selected, setSelected] = useState<string>(),
    [error, setError] = useState(''),
    [source, setSource] = useState(''),
    [time, setTime] = useState(0),
    [independent, setIndependent] = useState(false),
    [note, setNote] = useState('');
  void revision;
  const library = new UserEffectLibrary(localStorage),
    attempt = (fn: () => void) => {
      try {
        fn();
        setError('');
        refresh((n) => n + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : '操作失败');
      }
    },
    draft = selected
      ? effectForge.all().find((d) => d.id === selected)
      : undefined;
  let packages: EffectPackage[] = [],
    libraryError = '';
  try {
    packages = library.all();
  } catch (e) {
    libraryError = e instanceof Error ? e.message : '效果库不可读';
  }
  return (
    <div className="effect-forge">
      <p className="empty-note">
        受控声明式像素效果 ·
        不执行脚本、访问文件系统或网络。复杂程序可能降低预览速度。
      </p>
      {error && <p role="alert">{error}</p>}
      {libraryError && <p role="alert">{libraryError}</p>}
      {mode === 'library' ? (
        <>
          {packages
            .filter(
              (p) =>
                [p.id, p.name, p.description]
                  .join(' ')
                  .toLowerCase()
                  .includes(query.toLowerCase()) &&
                (group === 'all' ||
                  group ===
                    (p.category === 'generator' ? 'Generate' : 'Stylize')),
            )
            .map((p) => (
              <div className="feature-card" key={p.contentHash}>
                <strong>
                  {p.name} · v{p.version}
                </strong>
                <p>{p.description}</p>
                <small>{p.contentHash.slice(0, 16)}</small>
                <div className="graph-tools">
                  <button
                    onClick={() =>
                      attempt(() => {
                        onApply(p, false);
                      })
                    }
                  >
                    添加到当前图层
                  </button>
                  {p.category === 'generator' && (
                    <button
                      onClick={() =>
                        attempt(() => {
                          onApply(p, true);
                        })
                      }
                    >
                      新建生成器图层
                    </button>
                  )}
                  <button onClick={() => exportPackage(p)}>导出效果包</button>
                  <button
                    onClick={() => attempt(() => library.remove(p.contentHash))}
                  >
                    从库移除
                  </button>
                </div>
              </div>
            ))}
          {!packages.length && (
            <p className="empty-note">
              暂无效果包，或效果库不可读。导入后先预览，再保存。
            </p>
          )}
        </>
      ) : (
        <>
          <div className="graph-tools">
            <button
              onClick={() =>
                attempt(() => {
                  const d = effectForge.create(organicTexturePackage());
                  setSelected(d.id);
                  setSource(JSON.stringify(d.package, null, 2));
                })
              }
            >
              创建流动纹理示例草稿
            </button>
            <label className="field">
              导入效果包
              <input
                aria-label="导入效果包"
                type="file"
                accept=".json,.sfe.json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > runtimeLimits.maxPackageBytes) {
                    setError('效果包超出256KB上限');
                    return;
                  }
                  try {
                    const text = await file.text();
                    attempt(() => {
                      const d = effectForge.create(JSON.parse(text));
                      setSelected(d.id);
                      setSource(text);
                    });
                  } catch {
                    setError('无法读取效果包');
                  }
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <select
            aria-label="效果草稿"
            value={selected ?? ''}
            onChange={(e) => {
              setSelected(e.target.value);
              const d = effectForge.get(e.target.value);
              setSource(JSON.stringify(d.package, null, 2));
              setNote('');
            }}
          >
            <option value="" disabled>
              选择草稿
            </option>
            {effectForge.all().map((d) => (
              <option key={d.id} value={d.id}>
                {d.package.name} · {d.state}
              </option>
            ))}
          </select>
          {draft && (
            <>
              <p>
                {draft.package.name} · {draft.state} · v{draft.package.version}
              </p>
              <details>
                <summary>编辑效果包源定义</summary>
                <p>
                  JSON
                  参数和运算指令；修改后需要重新验证、编译和预览。手工修改时可删除旧
                  contentHash，由系统重新计算。
                </p>
                <textarea
                  aria-label="效果包源定义"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  rows={10}
                />
                <button
                  onClick={() =>
                    attempt(() => {
                      effectForge.update(draft.id, JSON.parse(source));
                      setNote('');
                    })
                  }
                >
                  更新草稿
                </button>
              </details>
              <div className="graph-tools">
                <button
                  disabled={draft.state === 'accepted'}
                  onClick={() => attempt(() => effectForge.validate(draft.id))}
                >
                  验证
                </button>
                <button
                  disabled={draft.state !== 'validated'}
                  onClick={() => attempt(() => effectForge.compile(draft.id))}
                >
                  编译
                </button>
                <button
                  disabled={
                    !['compiled', 'previewed', 'evaluated'].includes(
                      draft.state,
                    )
                  }
                  onClick={() =>
                    attempt(() => effectForge.preview(draft.id, {}, time))
                  }
                >
                  渲染预览
                </button>
                <button onClick={() => exportPackage(draft.package)}>
                  导出效果包
                </button>
                <button
                  onClick={() =>
                    attempt(() => {
                      effectForge.discard(draft.id);
                      setSelected(undefined);
                    })
                  }
                >
                  丢弃草稿
                </button>
              </div>
              <NumberField
                label="效果预览时间"
                value={time}
                min={0}
                max={3600}
                onCommit={setTime}
                onError={setError}
              />
              {draft.preview && (
                <>
                  <PixelPreview {...draft.preview} />
                  {draft.package.category === 'filter' && (
                    <small>滤镜草稿预览使用固定棋盘测试图。</small>
                  )}
                </>
              )}
              {draft.state === 'previewed' && (
                <>
                  <label className="field">
                    检查结论
                    <input
                      aria-label="效果检查结论"
                      placeholder="检查颜色、运动、边界和预期是否一致"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={!note.trim()}
                    onClick={() =>
                      attempt(() => effectForge.evaluate(draft.id, note))
                    }
                  >
                    确认已检查预览
                  </button>
                </>
              )}
              {draft.package.category === 'generator' && (
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={independent}
                    onChange={(e) => setIndependent(e.target.checked)}
                  />
                  新建独立生成器图层
                </label>
              )}
              {draft.state === 'evaluated' && (
                <button
                  onClick={() =>
                    attempt(() => {
                      effectForge.ready(draft.id);
                      if (onApply(draft.package, independent))
                        effectForge.accept(draft.id);
                    })
                  }
                >
                  确认应用到工程
                </button>
              )}
              {draft.state === 'accepted' && (
                <>
                  <p>已应用到工程，可撤销。保存到效果库需要单独操作。</p>
                  <button
                    onClick={() =>
                      attempt(() => {
                        library.save(draft.package);
                      })
                    }
                  >
                    保存到我的效果库
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
