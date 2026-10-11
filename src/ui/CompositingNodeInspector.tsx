import { CapabilityParameters } from './CapabilityParameters';
import { visualCapabilities } from '../core/visual-capabilities';
import type { Layer } from '../core/project-model';
import type { CompositingGraph, GraphNode } from '../core/compositing-graph';
import { nodeDefinitionFor } from '../core/compositing-registry';
import { graphCommand } from '../core/compositing-commands';
import {
  patchGraphNode,
  deleteGraphNodes,
} from '../core/compositing-operations';
import { AnimatedField } from './AnimatedField';
import { TextField } from './fields';
import { Section, Modal } from './workspace/primitives';
import { useState, type ReactNode } from 'react';
import { useCommandScope } from './workspace/scoped-commands';
import { CreationPrompt } from './CreationPrompt';
import type { EditorStore } from './editor-store';
import { editorCommands } from './workspace/feature-contributions';
export function CompositingNodeInspector({
  store,
  layer,
  graph,
  node,
  heading,
}: {
  store: EditorStore;
  layer: Layer;
  graph: CompositingGraph;
  node: GraphNode;
  heading?: ReactNode;
}) {
  const def = nodeDefinitionFor(node);
  const [aiOpen, setAiOpen] = useState(false);
  useCommandScope(store, [
    {
      id: 'node.ai',
      label: '用 AI 修改节点',
      disabled: layer.locked || !!def?.protected,
      action: () => setAiOpen(true),
    },
  ]);
  const commit = (label: string, g: CompositingGraph) =>
    store.run(label, [graphCommand(store.getSnapshot().project, layer.id, g)]);
  return (
    <aside className="inspector-panel" aria-label="节点属性面板">
      {aiOpen && (
        <Modal onClose={() => setAiOpen(false)}>
          <section
            className="creation-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="AI 创作与局部修改"
          >
            <h2>用 AI 修改节点 / 分支</h2>
            <CreationPrompt
              key={node.id}
              store={store}
              initialScope={{
                kind: 'PARAMETER_ONLY',
                compositionId: store.getSnapshot().project.activeCompositionId,
                layerId: layer.id,
                nodeIds: [node.id],
              }}
            />
            <button onClick={() => setAiOpen(false)}>关闭</button>
          </section>
        </Modal>
      )}
      <div className="panel-heading">
        {heading ?? <h2>节点属性</h2>}
        <button onClick={() => store.clearGraphSelection()}>图层属性</button>
      </div>
      <div className="inspector-body" key={node.id}>
        <TextField
          label="节点名称"
          value={node.name}
          onCommit={(name) =>
            commit('重命名节点', patchGraphNode(graph, node.id, { name }))
          }
        />
        <div className="section-label">
          {layer.name} · {def?.title ?? node.type}
        </div>
        {!def?.protected && (
          <label className="checkbox-field">
            <input
              aria-label="启用当前节点"
              type="checkbox"
              checked={node.enabled}
              onChange={(e) =>
                commit(
                  '切换节点启用',
                  patchGraphNode(graph, node.id, { enabled: e.target.checked }),
                )
              }
            />
            启用节点（关闭时旁路）
          </label>
        )}
        <Section title="节点参数">
          {!def?.protected && (
            <button
              disabled={layer.locked}
              onClick={() => editorCommands(store).execute('node.ai')}
            >
              用 AI 修改节点
            </button>
          )}
          {node.effectPackage && def ? (
            <CapabilityParameters
              store={store}
              parameters={node.effectPackage.parameters}
              properties={node.params}
            />
          ) : visualCapabilities.get(node.type) ? (
            <CapabilityParameters
              store={store}
              parameters={visualCapabilities.get(node.type)!.parameters}
              properties={node.params}
            />
          ) : (
            Object.entries(node.params).map(([key, property]) => {
              const spec = def?.params[key],
                scale = key === 'scale';
              return (
                <AnimatedField
                  key={property.id}
                  store={store}
                  property={property}
                  label={spec?.label ?? key}
                  color={spec?.color}
                  min={spec?.min}
                  max={spec?.max}
                  factor={scale ? 100 : 1}
                  linkMode={scale ? 'ratio' : 'offset'}
                  unit={scale ? '（%）' : undefined}
                />
              );
            })
          )}
          {!Object.keys(node.params).length && (
            <p className="empty-note">此节点无需参数</p>
          )}
        </Section>
        <Section title="端口">
          {node.inputs.map((p) => (
            <div key={p.id} className="section-label">
              输入 · {p.name} · {p.type}
            </div>
          ))}
          {node.outputs.map((p) => (
            <div key={p.id} className="section-label">
              输出 · {p.name} · {p.type}
            </div>
          ))}
        </Section>
        {!def?.protected && (
          <button
            onClick={() =>
              commit('删除节点', deleteGraphNodes(graph, [node.id]))
            }
          >
            删除当前节点
          </button>
        )}
      </div>
    </aside>
  );
}
