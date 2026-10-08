import { inspectorSections } from './inspector-sections';
import { PivotSelector } from './PivotSelector';
import { CompositingNodeInspector } from './CompositingNodeInspector';
import { AnimatedField } from './AnimatedField';
import { Section } from './workspace/primitives';
import { colorValue } from '../renderers/draw-content';
import { layerKindLabels } from './labels';
import { useSyncExternalStore } from 'react';
import { evaluateProperty } from '../core/animation-engine';
import { command } from '../core/command-system';
import type { LayerPatch } from '../core/command-system';
import { activeComposition } from '../core/project-model';
import type { SemanticMetadata } from '../core/project-model';
import type { EditorStore } from './editor-store';

export function Inspector({ store }: { store: EditorStore }) {
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const c = activeComposition(view.project);
  const layer = c.layers.find((item) => item.id === view.selection[0]);
  if (!layer)
    return (
      <aside className="inspector-panel" aria-label="属性面板">
        <div className="panel-heading">
          <h2>属性</h2>
        </div>
        <div className="empty-note">
          <p>选择一个图层</p>
          <small>在画布或图层列表中选择</small>
        </div>
      </aside>
    );
  if (view.selection.length > 1)
    return (
      <aside className="inspector-panel" aria-label="属性面板">
        <div className="panel-heading">
          <h2>属性</h2>
          <span>{view.selection.length} 个图层</span>
        </div>
        <div className="inspector-body">
          <Section title="变换">
            {c.layers
              .filter((l) => view.selection.includes(l.id))
              .every((l) => !l.editor?.is3D && l.type !== 'camera') ? (
              <>
                <PivotSelector store={store} />
                <AnimatedField
                  store={store}
                  property={layer.transform.position}
                  label="位置"
                />
                <AnimatedField
                  store={store}
                  property={layer.transform.scale}
                  label="缩放"
                  linkMode="ratio"
                  factor={100}
                  unit="（%）"
                />
                <AnimatedField
                  store={store}
                  property={layer.transform.rotation}
                  label="旋转"
                  unit="（°）"
                />
              </>
            ) : c.layers
                .filter((l) => view.selection.includes(l.id))
                .every((l) => l.editor?.is3D && l.type !== 'camera') ? (
              <>
                <AnimatedField
                  store={store}
                  property={layer.editor!.properties.position3D!}
                  label="三维位置"
                  defaultLinked={false}
                />
                <AnimatedField
                  store={store}
                  property={layer.editor!.properties.rotation3D!}
                  label="三维旋转"
                  defaultLinked={false}
                />
                <AnimatedField
                  store={store}
                  property={layer.editor!.properties.scale3D!}
                  label="三维缩放"
                  linkMode="ratio"
                />
              </>
            ) : (
              <p className="inspector-note">
                选区包含不同维度或摄像机；选择同类图层后编辑对应变换。
              </p>
            )}
            {c.layers
              .filter((l) => view.selection.includes(l.id))
              .every((l) => !['camera', 'null'].includes(l.type)) && (
              <AnimatedField
                store={store}
                property={layer.transform.opacity}
                label="透明度"
                factor={100}
                unit="（%）"
              />
            )}
          </Section>
        </div>
      </aside>
    );
  const node =
    view.graphSelection?.layerId === layer.id
      ? layer.editor?.graph?.nodes.find(
          (n) => n.id === view.graphSelection?.nodeIds[0],
        )
      : undefined;
  if (node && layer.editor?.graph)
    return (
      <CompositingNodeInspector
        store={store}
        layer={layer}
        graph={layer.editor.graph}
        node={node}
      />
    );
  const patch = (value: LayerPatch) =>
    store.run('修改图层', [
      command({
        type: 'layer.patch',
        compositionId: c.id,
        layerId: layer.id,
        patch: value,
      }),
    ]);
  const error = (message: string) => store.setStatus(message, true);
  const t = layer.transform;

  const semantic = (value: Partial<SemanticMetadata>) =>
    patch({ semantic: { ...layer.semantic, ...value } });
  const fill =
    'fill' in layer
      ? layer.editor?.properties.fill
        ? colorValue(evaluateProperty(layer.editor.properties.fill, view.time))
        : layer.fill
      : undefined;
  const hex = fill
    ? '#' +
      [fill.r, fill.g, fill.b]
        .map((v) =>
          Math.round(v * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    : '#000000';
  return (
    <aside className="inspector-panel" aria-label="属性面板">
      <div className="panel-heading">
        <h2>属性</h2>
        <span className="type-badge">
          {
            layerKindLabels[
              layer.type === 'shape' ? layer.shapeKind : layer.type
            ]
          }
        </span>
      </div>
      <div className="inspector-body" key={layer.id}>
        {inspectorSections(layer).map(({ id, component: Component }) => (
          <div key={id} data-inspector-section={id}>
            <Component
              {...{
                store,
                layer,
                c,
                view,
                patch,
                error,
                t,
                semantic,
                fill,
                hex,
              }}
            />
          </div>
        ))}
      </div>
    </aside>
  );
}
