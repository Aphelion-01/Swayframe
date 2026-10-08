import { UserEffectLibrary } from '../core/effect-library';
import { effectDefinition } from '../core/programmable-effect';
import { EffectForgePanel } from './EffectForgePanel';
import type { EffectPackage } from '../core/programmable-effect';
import { useState } from 'react';
import { Modal } from './workspace/primitives';
import {
  visualCapabilities,
  nativeEffectKind,
} from '../core/visual-capabilities';
import { effectCategories } from '../core/effect-registry';
import type {
  VisualCapabilityDefinition,
  VisualCapabilityPreset,
} from '../core/visual-capabilities';
export function EffectBrowser({
  onClose,
  onSelect,
  presets = [],
  onPackageSelect,
  onGenerator,
}: {
  onClose: () => void;
  onPackageSelect?: (p: EffectPackage, independent: boolean) => boolean;
  onGenerator?: () => void;
  onSelect: (
    definition: VisualCapabilityDefinition,
    preset?: VisualCapabilityPreset,
  ) => void;
  presets?: readonly VisualCapabilityPreset[];
}) {
  const [query, setQuery] = useState(''),
    [source, setSource] = useState('builtin'),
    [group, setGroup] = useState('all');
  const definitions = visualCapabilities
    .search(query)
    .filter((d) => nativeEffectKind(d.id) || d.id === 'radialGradient')
    .filter((d) => group === 'all' || group === d.group);
  return (
    <Modal onClose={onClose}>
      <section
        className="new-dialog effect-browser"
        role="dialog"
        aria-label="效果浏览器"
      >
        <h2>添加效果</h2>
        <div className="field-grid">
          <input
            aria-label="搜索效果"
            placeholder="搜索名称或用途…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="效果分类"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="all">全部分类</option>
            {Object.entries(effectCategories).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="segmented" role="tablist" aria-label="效果来源">
          <button
            role="tab"
            aria-selected={source === 'builtin'}
            onClick={() => setSource('builtin')}
          >
            内置效果
          </button>
          <button
            role="tab"
            aria-selected={source === 'user'}
            onClick={() => setSource('user')}
          >
            我的效果
          </button>
          {onPackageSelect && (
            <button
              role="tab"
              aria-selected={source === 'drafts'}
              onClick={() => setSource('drafts')}
            >
              AI 草稿 / 导入
            </button>
          )}
        </div>
        {source === 'builtin' && onGenerator && (
          <button onClick={onGenerator}>新建径向渐变生成器图层</button>
        )}
        <div className="effect-browser-results">
          {source === 'drafts' && onPackageSelect ? (
            <EffectForgePanel mode="drafts" onApply={onPackageSelect} />
          ) : source === 'builtin' ? (
            definitions.map((d) => (
              <button
                className="effect-browser-item"
                key={d.id}
                onClick={() => onSelect(d)}
              >
                <strong>{d.name}</strong>
                <span>
                  {effectCategories[d.group]} · {d.description}
                </span>
              </button>
            ))
          ) : (
            presets
              .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
              .map((p) => {
                const d =
                  visualCapabilities.get(
                    p.capability.id,
                    p.capability.version,
                  ) ??
                  (() => {
                    try {
                      const pkg = new UserEffectLibrary(localStorage)
                        .all()
                        .find(
                          (pkg) => pkg.contentHash === p.capability.contentHash,
                        );
                      return pkg ? effectDefinition(pkg) : undefined;
                    } catch {
                      return undefined;
                    }
                  })();
                return d ? (
                  <button
                    className="effect-browser-item"
                    key={p.id}
                    onClick={() => onSelect(d, p)}
                  >
                    {p.name}
                    <span>
                      {d.name} · v{p.capability.version}
                    </span>
                  </button>
                ) : (
                  <p key={p.id}>缺少效果：{p.name}</p>
                );
              })
          )}
          {source === 'user' && onPackageSelect && (
            <EffectForgePanel
              mode="library"
              onApply={onPackageSelect}
              query={query}
              group={group}
            />
          )}
          {((source === 'builtin' && !definitions.length) ||
            (source === 'user' && !presets.length)) && (
            <p className="empty-note">
              {source === 'user'
                ? '暂无保存的参数预设。在效果实例中保存预设后，可从这里复用。'
                : '没有匹配效果，请尝试其他关键词。'}
            </p>
          )}
        </div>
        <button onClick={onClose}>关闭效果浏览器</button>
      </section>
    </Modal>
  );
}
