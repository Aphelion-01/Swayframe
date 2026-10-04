import { CompositingNodeInspector } from './CompositingNodeInspector';
import { AnimatedField } from './AnimatedField';
import { Section } from './workspace/primitives';
import { ThreeDControls } from './ThreeDControls';
import { StructureControls } from './StructureControls';
import { CompositingControls } from './CompositingControls';
import { AppearanceControls } from './AppearanceControls';
import { colorValue } from '../renderers/draw-content';
import { layerKindLabels, displayName } from './labels';
import { useSyncExternalStore } from 'react';
import { evaluateProperty } from '../core/animation-engine';
import { command } from '../core/command-system';
import type { LayerPatch } from '../core/command-system';
import { activeComposition } from '../core/project-model';
import type { SemanticMetadata } from '../core/project-model';
import { NumberField, TextField } from './fields';
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
        <TextField
          label="图层名称"
          value={displayName(layer.name)}
          onCommit={(name) => patch({ name })}
        />
        <Section title="变换">
          <AnimatedField store={store} property={t.position} label="位置" />
          <AnimatedField
            store={store}
            property={t.scale}
            label="缩放"
            linkMode="ratio"
            factor={100}
            unit="（%）"
          />
          <AnimatedField
            store={store}
            property={t.rotation}
            label="旋转"
            unit="（°）"
          />
          <AnimatedField
            store={store}
            property={t.opacity}
            label="透明度"
            factor={100}
            unit="（%）"
            min={0}
            max={100}
          />
        </Section>
        <label className="checkbox-field">
          <input
            aria-label="锁定图层"
            type="checkbox"
            checked={layer.locked}
            onChange={(event) => patch({ locked: event.target.checked })}
          />
          锁定图层
        </label>
        <Section title="外观">
          {fill && (
            <label className="color-field">
              填充颜色
              <input
                aria-label="填充颜色"
                type="color"
                value={hex}
                onChange={(event) => {
                  const value = event.target.value.slice(1);
                  const fillValue = {
                    r: parseInt(value.slice(0, 2), 16) / 255,
                    g: parseInt(value.slice(2, 4), 16) / 255,
                    b: parseInt(value.slice(4, 6), 16) / 255,
                    a: fill.a,
                  };
                  if (layer.editor?.properties.fill)
                    store.run('修改填充颜色', [
                      store.valueCommand(layer.editor.properties.fill.id, [
                        fillValue.r,
                        fillValue.g,
                        fillValue.b,
                        fillValue.a,
                      ]),
                    ]);
                  else patch({ fill: fillValue });
                }}
              />
              <span>{hex.toUpperCase()}</span>
            </label>
          )}
          {fill && (
            <TextField
              label="填充颜色 HEX"
              value={hex}
              onCommit={(h) => {
                if (!/^#[0-9a-f]{6}$/i.test(h)) {
                  error('请输入 #RRGGBB 颜色');
                  return;
                }
                const v = [
                  parseInt(h.slice(1, 3), 16) / 255,
                  parseInt(h.slice(3, 5), 16) / 255,
                  parseInt(h.slice(5, 7), 16) / 255,
                  fill.a,
                ];
                if (layer.editor?.properties.fill)
                  store.run('修改填充颜色', [
                    store.valueCommand(layer.editor.properties.fill.id, v),
                  ]);
                else
                  patch({ fill: { r: v[0]!, g: v[1]!, b: v[2]!, a: v[3]! } });
              }}
            />
          )}
        </Section>
        {layer.type === 'text' && (
          <Section title="文字">
            <TextField
              label="文字内容"
              multiline
              value={layer.text}
              onCommit={(text) => patch({ text })}
            />
            <NumberField
              revision={layer}
              time={view.time}
              onPreview={(fontSize) => {
                const property = layer.editor?.properties.fontSize;
                if (property)
                  store.setPropertyPreview({
                    id: property.id,
                    property: {
                      ...property,
                      baseValue: fontSize,
                      keyframes: [],
                    },
                  });
                else store.setLayerPreview({ ...layer, fontSize });
              }}
              onCancel={() => store.setPropertyPreview(undefined)}
              label="字号"
              value={
                layer.editor?.properties.fontSize
                  ? (evaluateProperty(
                      layer.editor.properties.fontSize,
                      view.time,
                    ) as number)
                  : layer.fontSize
              }
              min={1}
              max={1000}
              onCommit={(fontSize) =>
                layer.editor?.properties.fontSize
                  ? store.run('修改字号', [
                      store.valueCommand(
                        layer.editor.properties.fontSize.id,
                        fontSize,
                      ),
                    ])
                  : patch({ fontSize })
              }
              onError={error}
            />
            <TextField
              label="字体"
              value={layer.fontFamily}
              onCommit={(fontFamily) => patch({ fontFamily })}
            />
          </Section>
        )}
        <Section title="几何与样式">
          <AppearanceControls
            store={store}
            layer={layer}
            compositionId={c.id}
          />
        </Section>
        <Section
          title="三维与摄像机"
          open={layer.type === 'camera' || !!layer.editor?.is3D}
        >
          <ThreeDControls store={store} layer={layer} />
        </Section>
        <Section title="层级与时间" open={false}>
          <StructureControls store={store} layer={layer} />
        </Section>
        <Section title="效果与遮罩" open={false}>
          <CompositingControls
            store={store}
            layer={layer}
            compositionId={c.id}
          />
        </Section>
        <details className="semantic-fields">
          <summary>语义信息</summary>
          <TextField
            label="语义角色"
            value={layer.semantic?.semanticRole ?? ''}
            onCommit={(semanticRole) => semantic({ semanticRole })}
          />
          <TextField
            label="视觉角色"
            value={layer.semantic?.visualRole ?? ''}
            onCommit={(visualRole) => semantic({ visualRole })}
          />
          <NumberField
            revision={layer}
            time={view.time}
            step={0.01}
            onPreview={(importance) =>
              store.setLayerPreview({
                ...layer,
                semantic: { ...layer.semantic, importance },
              })
            }
            onCancel={() => store.setLayerPreview()}
            label="重要程度"
            value={layer.semantic?.importance ?? 0.5}
            min={0}
            max={1}
            onCommit={(importance) => semantic({ importance })}
            onError={error}
          />
          <TextField
            label="标签"
            value={layer.semantic?.tags?.join(', ') ?? ''}
            onCommit={(tags) =>
              semantic({
                tags: tags
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
          />
        </details>
      </div>
    </aside>
  );
}
