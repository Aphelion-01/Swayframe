import { effectRegistry, effectCategories } from '../core/effect-registry';
import { editorCommands } from './workspace/feature-contributions';
import {
  effectsToGraph,
  linearGraphEffects,
  reorderGraphEffects,
} from '../core/compositing-migration';
import { graphCommand } from '../core/compositing-commands';
import {
  deleteGraphNodes,
  patchGraphNode,
} from '../core/compositing-operations';
import { useEffect, useState } from 'react';
import type {
  Layer,
  LayerEditor,
  EffectKind,
  Mask,
  Effect,
} from '../core/project-model';
import { blendModes } from '../core/project-model';
import { createMask, effectDefinitions } from '../core/effect-model';
import { command } from '../core/command-system';
import { AnimatedField } from './AnimatedField';
import { PathEditor } from './PathEditor';
import type { EditorStore } from './editor-store';
const blends: Record<string, string> = {
  normal: '正常',
  multiply: '正片叠底',
  screen: '滤色',
  overlay: '叠加',
  add: '相加',
  darken: '变暗',
  lighten: '变亮',
};
export function CompositingControls({
  store,
  layer,
  compositionId,
}: {
  store: EditorStore;
  layer: Layer;
  compositionId: string;
}) {
  const [effectQuery, setEffectQuery] = useState('');
  const [kind, setKind] = useState<EffectKind>('exposure'),
    [maskPath, setMaskPath] = useState<string>();
  useEffect(() => {
    const add = () => {
      editorCommands(store).execute('effect-gaussianBlur');
    };
    window.addEventListener('motion:add-blur', add);
    return () => window.removeEventListener('motion:add-blur', add);
  }, [store, layer.id, compositionId]);
  const editor = layer.editor;
  if (!editor) return null;
  const update = (patch: Partial<LayerEditor>) =>
    store.run('修改合成属性', [
      command({
        type: 'layer.replace',
        compositionId,
        layer: {
          ...layer,
          editor: {
            ...editor,
            ...patch,
          },
        },
      }),
    ]);
  const updateMask = (mask: Mask, patch: Partial<Mask>) =>
    update({
      masks: editor.masks.map((m) =>
        m.id === mask.id ? { ...m, ...patch } : m,
      ),
    });
  const graph = editor.graph ?? effectsToGraph(layer.id, editor.effects ?? []),
    linear = linearGraphEffects(graph),
    effects = linear ?? [];
  const graphUpdate = (label: string, next: typeof graph) =>
    store.run(label, [
      graphCommand(store.getSnapshot().project, layer.id, next),
    ]);
  const effectChange = (effect: Effect, patch: Partial<Effect>) =>
    graphUpdate(
      '切换效果启用',
      patchGraphNode(graph, effect.id, {
        enabled: patch.enabled ?? effect.enabled,
      }),
    );
  const moveEffect = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= effects.length) return;
    const ids = effects.map((e) => e.id),
      from = ids[index]!;
    ids[index] = ids[to]!;
    ids[to] = from;
    graphUpdate('重排效果栈', reorderGraphEffects(graph, ids));
  };
  return (
    <>
      <div className="section-label">合成</div>
      <button
        onClick={() => window.dispatchEvent(new Event('motion:compositing'))}
      >
        打开合成节点
      </button>
      <label className="field">
        混合模式
        <select
          aria-label="混合模式"
          value={editor.blendMode}
          onChange={(e) =>
            update({ blendMode: e.target.value as LayerEditor['blendMode'] })
          }
        >
          {blendModes.map((m) => (
            <option key={m} value={m}>
              {blends[m]}
            </option>
          ))}
        </select>
      </label>
      <details className="feature-details" open>
        <summary>遮罩</summary>
        <div className="graph-tools">
          {(['rectangle', 'ellipse', 'path'] as const).map((kind) => (
            <button
              key={kind}
              onClick={() =>
                update({ masks: [...editor.masks, createMask(layer, kind)] })
              }
            >
              添加{{ rectangle: '矩形', ellipse: '椭圆', path: '路径' }[kind]}
              遮罩
            </button>
          ))}
        </div>
        {editor.masks.map((mask, i) => (
          <div className="feature-card" key={mask.id}>
            <div className="feature-card-heading">
              <label>
                <input
                  aria-label={`启用遮罩${i + 1}`}
                  type="checkbox"
                  checked={mask.enabled}
                  onChange={(e) =>
                    updateMask(mask, { enabled: e.target.checked })
                  }
                />
                遮罩 {i + 1}
              </label>
              <button
                aria-label={`删除遮罩${i + 1}`}
                onClick={() =>
                  update({
                    masks: editor.masks.filter((m) => m.id !== mask.id),
                  })
                }
              >
                删除
              </button>
            </div>
            <label className="field">
              模式
              <select
                aria-label={`遮罩${i + 1}模式`}
                value={mask.mode}
                onChange={(e) =>
                  updateMask(mask, { mode: e.target.value as Mask['mode'] })
                }
              >
                <option value="add">相加</option>
                <option value="subtract">相减</option>
                <option value="intersect">交集</option>
              </select>
            </label>
            <button onClick={() => setMaskPath(mask.id)}>
              编辑遮罩{i + 1}路径
            </button>
            <AnimatedField
              store={store}
              property={mask.opacity}
              label={`遮罩${i + 1}不透明度`}
              min={0}
              max={1}
            />
            <AnimatedField
              store={store}
              property={mask.feather}
              label={`遮罩${i + 1}羽化`}
              min={0}
              max={500}
            />
            <AnimatedField
              store={store}
              property={mask.expansion}
              label={`遮罩${i + 1}扩展`}
              min={-1000}
              max={1000}
            />
            {maskPath === mask.id && (
              <PathEditor
                store={store}
                property={mask.path}
                title={`遮罩${i + 1}路径`}
                onClose={() => setMaskPath(undefined)}
              />
            )}
          </div>
        ))}
      </details>
      <details className="feature-details" open>
        <summary>效果与调色</summary>
        <input
          aria-label="搜索效果"
          placeholder="搜索效果…"
          value={effectQuery}
          onChange={(e) => {
            setEffectQuery(e.target.value);
            const first = effectRegistry.search(e.target.value, layer.type)[0];
            if (first) setKind(first.id as EffectKind);
          }}
        />
        <div className="effect-add">
          <select
            aria-label="添加效果类型"
            value={kind}
            onChange={(e) => setKind(e.target.value as EffectKind)}
          >
            {[
              ...new Set(
                effectRegistry
                  .search(effectQuery, layer.type)
                  .map((d) => d.category),
              ),
            ].map((category) => (
              <optgroup key={category} label={effectCategories[category]}>
                {effectRegistry
                  .search(effectQuery, layer.type)
                  .filter((d) => d.category === category)
                  .map((def) => (
                    <option key={def.id} value={def.id}>
                      {def.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <button
            disabled={
              !effectRegistry
                .search(effectQuery, layer.type)
                .some((d) => d.id === kind)
            }
            onClick={() => editorCommands(store).execute(`effect-${kind}`)}
          >
            添加效果
          </button>
        </div>
        {!linear && (
          <p className="empty-note">
            高级节点图 · 请在底部“合成节点”中编辑分支
          </p>
        )}
        {effects.map((effect, i) => (
          <div className="feature-card" key={effect.id}>
            <div className="feature-card-heading">
              <label>
                <input
                  aria-label={`启用效果${i + 1}`}
                  type="checkbox"
                  checked={effect.enabled}
                  onChange={(e) =>
                    effectChange(effect, { enabled: e.target.checked })
                  }
                />
                {i + 1}. {effectDefinitions[effect.kind].label}
              </label>
              <button
                aria-label={`删除效果${i + 1}`}
                onClick={() =>
                  graphUpdate('删除效果', deleteGraphNodes(graph, [effect.id]))
                }
              >
                ×
              </button>
            </div>
            <div className="effect-order">
              <button
                aria-label={`上移效果${i + 1}`}
                disabled={i === 0}
                onClick={() => moveEffect(i, -1)}
              >
                ↑ 上移
              </button>
              <button
                aria-label={`下移效果${i + 1}`}
                disabled={i === effects.length - 1}
                onClick={() => moveEffect(i, 1)}
              >
                ↓ 下移
              </button>
            </div>
            {Object.entries(effect.parameters).map(([key, property]) => {
              const spec = effectDefinitions[effect.kind].parameters[key];
              return (
                <AnimatedField
                  key={key}
                  store={store}
                  property={property}
                  label={`效果${i + 1}${spec?.label ?? key}`}
                  min={spec?.min}
                  max={spec?.max}
                />
              );
            })}
          </div>
        ))}
      </details>
    </>
  );
}
