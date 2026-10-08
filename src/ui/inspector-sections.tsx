import { editorCommands } from './workspace/feature-contributions';
import { PivotSelector } from './PivotSelector';
import { AnimatedField } from './AnimatedField';
import { Section } from './workspace/primitives';
import { ThreeDControls } from './ThreeDControls';
import { StructureControls } from './StructureControls';
import { CompositingControls } from './CompositingControls';
import { AppearanceControls } from './AppearanceControls';
import { colorValue } from '../renderers/draw-content';
import { displayName } from './labels';

import { evaluateProperty } from '../core/animation-engine';

import type { LayerPatch } from '../core/command-system';

import type { SemanticMetadata } from '../core/project-model';
import { NumberField, TextField } from './fields';
import type { EditorStore } from './editor-store';

import type { Layer, Composition } from '../core/project-model';
import type { EditorView } from './editor-store';
import type { ComponentType } from 'react';
export interface InspectorSectionContext {
  store: EditorStore;
  layer: Layer;
  c: Composition;
  view: EditorView;
  patch: (value: LayerPatch) => unknown;
  error: (message: string) => void;
  t: Layer['transform'];
  semantic: (value: Partial<SemanticMetadata>) => unknown;
  fill?: ReturnType<typeof colorValue>;
  hex: string;
}
export interface InspectorSectionDefinition {
  id: string;
  title: string;
  order: number;
  component: ComponentType<InspectorSectionContext>;
  appliesTo: (layer: Layer) => boolean;
}
const sections = new Map<string, InspectorSectionDefinition>();
export function registerInspectorSection(def: InspectorSectionDefinition) {
  if (sections.has(def.id)) throw Error('重复属性分区');
  sections.set(def.id, def);
}
export const inspectorSections = (layer: Layer) =>
  [...sections.values()]
    .filter((s) => s.appliesTo(layer))
    .sort((a, b) => a.order - b.order);

function SectionName({ layer, patch }: InspectorSectionContext) {
  return (
    <TextField
      label="图层名称"
      value={displayName(layer.name)}
      onCommit={(name) => patch({ name })}
    />
  );
}
registerInspectorSection({
  id: 'name',
  title: '图层名称',
  order: 0,
  component: SectionName,
  appliesTo: () => true,
});

function SectionTransform({ store, layer, t }: InspectorSectionContext) {
  if (layer.type === 'camera')
    return (
      <Section title="运动路径">
        <button
          aria-pressed={store.getSnapshot().showMotionPaths}
          onClick={() => editorCommands(store).execute('motion-paths')}
        >
          运动路径 {store.getSnapshot().showMotionPaths ? '已显示' : '已隐藏'}
        </button>
      </Section>
    );
  return (
    <Section title="变换">
      <button
        aria-pressed={store.getSnapshot().showMotionPaths}
        onClick={() => editorCommands(store).execute('motion-paths')}
      >
        运动路径 {store.getSnapshot().showMotionPaths ? '已显示' : '已隐藏'}
      </button>
      <PivotSelector store={store} disabled={!!layer.editor?.is3D} />
      <AnimatedField
        key={`${t.position.id}-${!!layer.editor?.is3D}`}
        store={store}
        property={t.position}
        label="位置"
        defaultLinked={!layer.editor?.is3D}
      />
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
  );
}
registerInspectorSection({
  id: 'transform',
  title: '变换',
  order: 100,
  component: SectionTransform,
  appliesTo: () => true,
});

function SectionLock({ layer, patch }: InspectorSectionContext) {
  return (
    <label className="checkbox-field">
      <input
        aria-label="锁定图层"
        type="checkbox"
        checked={layer.locked}
        onChange={(event) => patch({ locked: event.target.checked })}
      />
      锁定图层
    </label>
  );
}
registerInspectorSection({
  id: 'lock',
  title: '锁定图层',
  order: 200,
  component: SectionLock,
  appliesTo: () => true,
});

function SectionAppearance({
  store,
  layer,
  patch,
  error,
  fill,
  hex,
}: InspectorSectionContext) {
  return (
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
            else patch({ fill: { r: v[0]!, g: v[1]!, b: v[2]!, a: v[3]! } });
          }}
        />
      )}
    </Section>
  );
}
registerInspectorSection({
  id: 'appearance',
  title: '外观',
  order: 300,
  component: SectionAppearance,
  appliesTo: (l) => 'fill' in l,
});

function SectionText({
  store,
  layer,
  view,
  patch,
  error,
}: InspectorSectionContext) {
  return (
    layer.type === 'text' && (
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
    )
  );
}
registerInspectorSection({
  id: 'text',
  title: '文字',
  order: 400,
  component: SectionText,
  appliesTo: (l) => l.type === 'text',
});

function SectionGeometry({ store, layer, c }: InspectorSectionContext) {
  return (
    <Section title="几何与样式">
      <AppearanceControls store={store} layer={layer} compositionId={c.id} />
    </Section>
  );
}
registerInspectorSection({
  id: 'geometry',
  title: '几何与样式',
  order: 500,
  component: SectionGeometry,
  appliesTo: (l) =>
    !!l.editor &&
    l.type !== 'camera' &&
    l.type !== 'null' &&
    l.type !== 'model',
});

function SectionThreeD({ store, layer }: InspectorSectionContext) {
  return (
    <Section
      title="三维与摄像机"
      open={layer.type === 'camera' || !!layer.editor?.is3D}
    >
      <ThreeDControls store={store} layer={layer} />
    </Section>
  );
}
registerInspectorSection({
  id: '3d',
  title: '三维与摄像机',
  order: 600,
  component: SectionThreeD,
  appliesTo: (l) => l.type === 'camera' || !!l.editor?.is3D,
});

function SectionStructure({ store, layer }: InspectorSectionContext) {
  return (
    <Section title="父子级" open>
      <StructureControls store={store} layer={layer} mode="structure" />
    </Section>
  );
}
registerInspectorSection({
  id: 'structure',
  title: '父子级',
  order: 700,
  component: SectionStructure,
  appliesTo: () => true,
});

function SectionTime({ store, layer }: InspectorSectionContext) {
  return (
    <Section title="图层时间" open={false}>
      <StructureControls store={store} layer={layer} mode="time" />
    </Section>
  );
}
registerInspectorSection({
  id: 'time',
  title: '图层时间',
  order: 800,
  component: SectionTime,
  appliesTo: () => true,
});

function SectionEffects({ store, layer, c }: InspectorSectionContext) {
  return (
    <Section title="效果与遮罩" open>
      <CompositingControls store={store} layer={layer} compositionId={c.id} />
    </Section>
  );
}
registerInspectorSection({
  id: 'effects',
  title: '效果与遮罩',
  order: 900,
  component: SectionEffects,
  appliesTo: (l) =>
    !!l.editor &&
    l.type !== 'camera' &&
    l.type !== 'null' &&
    l.type !== 'model',
});

function SectionSemantic({
  store,
  layer,
  view,
  error,
  semantic,
}: InspectorSectionContext) {
  return (
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
  );
}
registerInspectorSection({
  id: 'semantic',
  title: '语义信息',
  order: 1000,
  component: SectionSemantic,
  appliesTo: () => true,
});
