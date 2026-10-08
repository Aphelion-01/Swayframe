import {
  processingStack,
  reorderProcessingStack,
} from '../core/processing-stack';
import type { GraphNode } from '../core/compositing-graph';
import { effectDefinition } from '../core/programmable-effect';
import { UserEffectLibrary } from '../core/effect-library';
import type { VisualCapabilityDefinition } from '../core/visual-capabilities';
import type { AnimValue } from '../core/core-types';
import type { Property } from '../core/project-model';
import { createGeneratorLayer } from '../core/generator-layer';
import { activeComposition } from '../core/project-model';
import {
  createProgrammableNode,
  nodeDefinitionFor,
} from '../core/compositing-registry';
import {
  rememberEffectTrust,
  isEffectTrusted,
  configureEffectTrust,
} from '../core/effect-trust';
import { CapabilityParameters } from './CapabilityParameters';
import { visualCapabilities } from '../core/visual-capabilities';
import { EffectBrowser } from './EffectBrowser';
import { EffectPresetLibrary } from '../core/effect-presets';
import { evaluateProperty } from '../core/animation-engine';
import { insertGraphNode } from '../core/compositing-operations';
import { Modal } from './workspace/primitives';
import { editorCommands } from './workspace/feature-contributions';
import { effectsToGraph } from '../core/compositing-migration';
import { graphCommand } from '../core/compositing-commands';
import {
  deleteGraphNodes,
  patchGraphNode,
} from '../core/compositing-operations';
import { useEffect, useState } from 'react';
import type { Layer, LayerEditor, Mask } from '../core/project-model';
import { blendModes } from '../core/project-model';
import { createMask } from '../core/effect-model';
import { command } from '../core/command-system';
import { AnimatedField } from './AnimatedField';
import { PathEditor } from './PathEditor';
import type { EditorStore } from './editor-store';
interface StackEffect {
  id: string;
  kind: string;
  enabled: boolean;
  parameters: Readonly<Record<string, Property<AnimValue>>>;
  definition?: VisualCapabilityDefinition;
  node: GraphNode;
}
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
  const [runtimeErrors, setRuntimeErrors] = useState<
    readonly { message: string }[]
  >([]);
  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.graphId === layer.editor?.graph?.id)
        setRuntimeErrors(detail.diagnostics);
    };
    window.addEventListener('motion:graph-errors', handle);
    return () => window.removeEventListener('motion:graph-errors', handle);
  }, [layer.editor?.graph?.id]);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [presetEffect, setPresetEffect] = useState<StackEffect>();
  const [presetName, setPresetName] = useState('');
  const [maskPath, setMaskPath] = useState<string>();
  configureEffectTrust(localStorage);
  const library = new EffectPresetLibrary(localStorage);
  useEffect(() => {
    const add = () => {
      editorCommands(store).execute('effect-gaussianBlur');
    };
    const open = () => setBrowserOpen(true);
    window.addEventListener('motion:effect-browser', open);
    window.addEventListener('motion:add-blur', add);
    return () => {
      window.removeEventListener('motion:add-blur', add);
      window.removeEventListener('motion:effect-browser', open);
    };
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
    linear = processingStack(graph),
    effects: StackEffect[] = (
      linear ??
      graph.nodes.filter(
        (n) => visualCapabilities.get(n.type) || n.type.startsWith('fx.'),
      )
    ).map((node) => ({
      id: node.id,
      kind: node.type,
      enabled: node.enabled,
      parameters: node.params,
      node,
      definition:
        node.effectPackage && nodeDefinitionFor(node)
          ? effectDefinition(node.effectPackage)
          : visualCapabilities.get(node.type),
    }));
  const graphUpdate = (label: string, next: typeof graph) =>
    store.run(label, [
      graphCommand(store.getSnapshot().project, layer.id, next),
    ]);
  const effectChange = (effect: StackEffect, patch: Partial<StackEffect>) =>
    graphUpdate(
      '切换效果启用',
      patchGraphNode(graph, effect.id, {
        enabled: patch.enabled ?? effect.enabled,
      }),
    );
  const moveEffect = (index: number, delta: number) => {
    const to = index + delta;
    if (!linear || to < 0 || to >= effects.length) return;
    const ids = effects.map((e) => e.id),
      from = ids[index]!;
    ids[index] = ids[to]!;
    ids[to] = from;
    graphUpdate('重排效果栈', reorderProcessingStack(graph, ids));
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
        {runtimeErrors.map((e, i) => (
          <p role="alert" key={i}>
            {e.message}
          </p>
        ))}
        <button
          aria-label="添加效果"
          onClick={() => editorCommands(store).execute('effect-browser')}
        >
          ＋ 添加效果
        </button>
        {browserOpen && (
          <EffectBrowser
            presets={library.all()}
            onGenerator={() => {
              editorCommands(store).execute('create-radial-generator');
              setBrowserOpen(false);
            }}
            onPackageSelect={(p, independent) => {
              try {
                const c = activeComposition(store.getSnapshot().project);
                const created = independent
                  ? createGeneratorLayer(c, p)
                  : undefined;
                const result = created
                  ? store.run('应用效果生成器', [
                      command({
                        type: 'layer.create',
                        compositionId: c.id,
                        layer: created,
                      }),
                    ])
                  : store.run('应用程序化效果', [
                      graphCommand(
                        store.getSnapshot().project,
                        layer.id,
                        insertGraphNode(graph, createProgrammableNode(p)).graph,
                      ),
                    ]);
                if (result.ok) {
                  rememberEffectTrust(p.contentHash);
                  if (created) store.select(created.id);
                  store.setStatus('自定义效果已应用，可在属性栏和时间轴编辑');
                }
                return result.ok;
              } catch (error) {
                store.setStatus(
                  error instanceof Error ? error.message : '效果应用失败',
                  true,
                );
                return false;
              }
            }}
            onClose={() => setBrowserOpen(false)}
            onSelect={(definition, preset) => {
              const p = definition.contentHash
                ? new UserEffectLibrary(localStorage)
                    .all()
                    .find((p) => p.contentHash === definition.contentHash)
                : undefined;
              const inserted = insertGraphNode(
                graph,
                p ? createProgrammableNode(p) : definition.id,
              );
              const next = preset
                ? {
                    ...inserted.graph,
                    nodes: inserted.graph.nodes.map((n) =>
                      n.id === inserted.node.id
                        ? {
                            ...n,
                            params: Object.fromEntries(
                              Object.entries(n.params).map(([k, p]) => [
                                k,
                                {
                                  ...p,
                                  baseValue: preset.values[k] ?? p.baseValue,
                                },
                              ]),
                            ),
                          }
                        : n,
                    ),
                  }
                : inserted.graph;
              graphUpdate('添加效果', next);
              setBrowserOpen(false);
            }}
          />
        )}
        {presetEffect && (
          <Modal onClose={() => setPresetEffect(undefined)}>
            <section
              className="new-dialog"
              role="dialog"
              aria-label="保存效果预设"
            >
              <h2>保存效果预设</h2>
              <input
                aria-label="预设名称"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
              <p>保存当前时间的参数值；不会复制当前实例的关键帧。</p>
              <button
                disabled={!presetName.trim()}
                onClick={() => {
                  try {
                    library.save(
                      presetName,
                      presetEffect.definition?.id ?? presetEffect.kind,
                      Object.fromEntries(
                        Object.entries(presetEffect.parameters).map(
                          ([k, p]) => [
                            k,
                            evaluateProperty(p, store.getSnapshot().time),
                          ],
                        ),
                      ),
                      presetEffect.definition,
                    );
                    setPresetEffect(undefined);
                    store.setStatus('预设已保存到我的效果');
                  } catch (error) {
                    store.setStatus(
                      error instanceof Error ? error.message : '保存失败',
                      true,
                    );
                  }
                }}
              >
                保存当前参数
              </button>
              <button onClick={() => setPresetEffect(undefined)}>取消</button>
            </section>
          </Modal>
        )}
        {!linear && (
          <p className="empty-note">
            高级节点图 · 参数可在此编辑，连接顺序请到“合成节点”调整
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
                {linear ? `${i + 1}. ` : ''}
                {effect.definition?.name ?? effect.node.name}
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
                aria-label={`保存效果${i + 1}预设`}
                onClick={() => {
                  setPresetEffect(effect);
                  setPresetName(
                    (effect.definition?.name ?? effect.node.name) + ' 预设',
                  );
                }}
              >
                保存预设
              </button>
              {effect.node.effectPackage && effect.definition && (
                <button
                  onClick={() => {
                    try {
                      new UserEffectLibrary(localStorage).save(
                        effect.node.effectPackage,
                      );
                      store.setStatus('效果包已保存到我的效果库');
                    } catch (e) {
                      store.setStatus(
                        e instanceof Error ? e.message : '保存失败',
                        true,
                      );
                    }
                  }}
                >
                  保存效果包
                </button>
              )}
              <button
                aria-label={`上移效果${i + 1}`}
                disabled={
                  !linear ||
                  i === 0 ||
                  !effect.node.inputs.length ||
                  !effects[i - 1]?.node.inputs.length
                }
                onClick={() => moveEffect(i, -1)}
              >
                ↑ 上移
              </button>
              <button
                aria-label={`下移效果${i + 1}`}
                disabled={
                  !linear ||
                  i === effects.length - 1 ||
                  !effect.node.inputs.length
                }
                onClick={() => moveEffect(i, 1)}
              >
                ↓ 下移
              </button>
            </div>
            {effect.definition ? (
              <CapabilityParameters
                store={store}
                parameters={effect.definition.parameters}
                properties={effect.parameters}
                prefix={linear ? `效果${i + 1}` : effect.node.name + ' · '}
              />
            ) : (
              <p role="alert">
                效果包缺失或校验失败，参数已保留。请禁用、删除，或导入对应版本重新添加。
              </p>
            )}
            {effect.node.effectPackage &&
              effect.definition &&
              !isEffectTrusted(effect.node.effectPackage.contentHash) && (
                <button
                  onClick={() => {
                    rememberEffectTrust(effect.node.effectPackage!.contentHash);
                    graphUpdate(
                      '信任并启用效果',
                      patchGraphNode(graph, effect.id, { enabled: true }),
                    );
                  }}
                >
                  信任并启用此效果
                </button>
              )}
          </div>
        ))}
      </details>
    </>
  );
}
