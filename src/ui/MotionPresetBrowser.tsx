import { useState, useSyncExternalStore } from 'react';
import {
  MotionPresetLibrary,
  builtinMotionPresets,
} from '../core/motion-presets';
import type { MotionCurve } from '../core/motion-curve';
import { evaluateMotionCurve } from '../core/motion-curve';
let browserLibrary: MotionPresetLibrary | undefined;
function loadLibrary() {
  if (browserLibrary) return { library: browserLibrary, error: '' };
  try {
    browserLibrary = new MotionPresetLibrary({
      read: () => localStorage.getItem('motion-curve-library.v1'),
      write: (value) => localStorage.setItem('motion-curve-library.v1', value),
    });
    return { library: browserLibrary, error: '' };
  } catch {
    return {
      library: new MotionPresetLibrary(),
      error: '曲线库无法读取；本次仅临时保存，原存储未覆盖。',
    };
  }
}
export function MotionPresetBrowser({
  curve,
  onApply,
  onError,
}: {
  curve: MotionCurve;
  onApply: (c: MotionCurve) => boolean;
  onError: (message: string) => void;
}) {
  const [{ library, error }] = useState(loadLibrary),
    state = useSyncExternalStore(library.subscribe, library.getSnapshot);
  const [tab, setTab] = useState('builtin'),
    [name, setName] = useState('我的曲线'),
    [chosen, setChosen] = useState('');
  const all = [...builtinMotionPresets, ...state.custom],
    items =
      tab === 'custom'
        ? state.custom
        : tab === 'favorites'
          ? all.filter((p) => state.favorites.includes(p.id))
          : tab === 'recent'
            ? state.recent
                .map((id) => all.find((p) => p.id === id))
                .filter((p) => p !== undefined)
            : builtinMotionPresets;
  const act = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      onError(e instanceof Error ? e.message : '预设操作失败');
    }
  };
  return (
    <section className="motion-library" aria-label="曲线预设库">
      <h3>曲线预设</h3>
      {error && <p role="alert">{error}</p>}
      <div className="motion-quick">
        {[
          ['builtin', '内置'],
          ['custom', '自定义'],
          ['favorites', '收藏'],
          ['recent', '最近'],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            onClick={() => setTab(id!)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="motion-preset-grid">
        {items.map((p) => (
          <button
            key={p.id}
            className={chosen === p.id ? 'active' : ''}
            title={p.name}
            aria-label={`应用预设 ${p.name}`}
            onClick={(e) => {
              if (e.detail > 1) return;
              act(() => {
                setChosen(p.id);
                setName(p.name);
                if (onApply(p.curve)) library.recordRecent(p.id);
              });
            }}
          >
            <svg viewBox="0 0 90 52" aria-hidden="true">
              <path
                d={Array.from(
                  { length: 31 },
                  (_, i) =>
                    `${i ? 'L' : 'M'}${5 + i * 2.6},${42 - evaluateMotionCurve(p.curve, i / 30) * 32}`,
                ).join(' ')}
                fill="none"
                stroke="#a7b5ff"
                strokeWidth="2"
              />
            </svg>
            <span>{p.name}</span>
          </button>
        ))}
      </div>
      <label>
        预设名称
        <input
          aria-label="预设名称"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="motion-quick">
        <button
          onClick={() =>
            act(() => {
              const p = library.saveMotionPreset(name, curve);
              setChosen(p.id);
              setTab('custom');
            })
          }
        >
          保存当前曲线
        </button>
        <button
          disabled={!chosen}
          onClick={() => act(() => library.favorite(chosen))}
        >
          {state.favorites.includes(chosen) ? '取消收藏' : '收藏预设'}
        </button>
        <button
          disabled={!chosen}
          onClick={() =>
            act(() => {
              const p = library.duplicate(chosen);
              setChosen(p.id);
              setName(p.name);
              setTab('custom');
            })
          }
        >
          复制预设
        </button>
        <button
          disabled={!chosen || chosen.startsWith('builtin:')}
          onClick={() => act(() => library.rename(chosen, name))}
        >
          重命名预设
        </button>
        <button
          disabled={!chosen || chosen.startsWith('builtin:')}
          onClick={() =>
            act(() => {
              library.delete(chosen);
              setChosen('');
            })
          }
        >
          删除预设
        </button>
      </div>
    </section>
  );
}
