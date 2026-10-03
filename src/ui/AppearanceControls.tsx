import { useState } from 'react';
import type { Layer, LayerEditor, Property } from '../core/project-model';
import { command } from '../core/command-system';
import { AnimatedField } from './AnimatedField';
import { PathEditor } from './PathEditor';
import { NumberField } from './fields';
import type { EditorStore } from './editor-store';
export function AppearanceControls({
  store,
  layer,
  compositionId,
}: {
  store: EditorStore;
  layer: Layer;
  compositionId: string;
}) {
  const [pathOpen, setPathOpen] = useState(false),
    editor = layer.editor;
  if (!editor) return null;
  const settings = (patch: Partial<LayerEditor>) =>
    store.run('修改外观', [
      command({
        type: 'layer.replace',
        compositionId,
        layer: { ...layer, editor: { ...editor, ...patch } },
      }),
    ]);
  const dimension = (key: 'width' | 'height', value: number) =>
    store.run('修改尺寸', [
      command({
        type: 'layer.replace',
        compositionId,
        layer: { ...layer, [key]: value },
      }),
    ]);
  return (
    <>
      <div className="section-label">几何与锚点</div>
      <div className="field-grid">
        {(['width', 'height'] as const).map((key) => (
          <NumberField
            key={key}
            label={key === 'width' ? '图层宽度' : '图层高度'}
            value={layer[key]}
            min={1}
            max={16384}
            onCommit={(n) => dimension(key, n)}
            onError={(m) => store.setStatus(m, true)}
          />
        ))}
      </div>
      <AnimatedField
        store={store}
        property={editor.properties.anchor!}
        label="锚点"
      />
      {layer.type === 'shape' && (
        <>
          <div className="section-label">形状样式</div>
          <AnimatedField
            store={store}
            property={editor.properties.stroke!}
            label="描边颜色"
            color
          />
          <AnimatedField
            store={store}
            property={editor.properties.strokeWidth!}
            label="描边宽度"
            min={0}
            max={1000}
          />
          <label className="field">
            渐变
            <select
              aria-label="填充渐变"
              value={editor.gradient}
              onChange={(e) =>
                settings({
                  gradient: e.target.value as LayerEditor['gradient'],
                })
              }
            >
              <option value="none">纯色</option>
              <option value="linear">线性渐变</option>
              <option value="radial">径向渐变</option>
            </select>
          </label>
          {editor.gradient !== 'none' && (
            <AnimatedField
              store={store}
              property={editor.properties.gradientEnd!}
              label="渐变末色"
              color
            />
          )}
          <div className="field-grid">
            {(['strokeJoin', 'strokeCap'] as const).map((key) => (
              <label className="field" key={key}>
                {key === 'strokeJoin' ? '连接' : '端点'}
                <select
                  aria-label={key === 'strokeJoin' ? '描边连接' : '描边端点'}
                  value={editor[key]}
                  onChange={(e) => settings({ [key]: e.target.value })}
                >
                  {(key === 'strokeJoin'
                    ? ['round', 'bevel', 'miter']
                    : ['round', 'butt', 'square']
                  ).map((k) => (
                    <option key={k} value={k}>
                      {
                        {
                          round: '圆角',
                          bevel: '斜角',
                          miter: '尖角',
                          butt: '平头',
                          square: '方头',
                        }[k]
                      }
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {(layer.shapeKind === 'polygon' || layer.shapeKind === 'star') && (
            <AnimatedField
              store={store}
              property={editor.properties.sides!}
              label="边数"
              min={3}
              max={100}
            />
          )}
          {layer.shapeKind === 'star' && (
            <AnimatedField
              store={store}
              property={editor.properties.innerRadius!}
              label="星形内半径"
              min={0.01}
              max={1}
            />
          )}
          {layer.shapeKind === 'path' && (
            <>
              <button onClick={() => setPathOpen(true)}>编辑贝塞尔路径</button>
              <label className="checkbox-field">
                <input
                  aria-label="闭合路径"
                  type="checkbox"
                  checked={editor.pathClosed}
                  onChange={(e) => settings({ pathClosed: e.target.checked })}
                />
                闭合路径
              </label>
            </>
          )}
        </>
      )}
      {layer.type === 'text' && (
        <>
          <AnimatedField
            store={store}
            property={editor.properties.fontWeight!}
            label="字重"
            min={100}
            max={900}
          />
          <AnimatedField
            store={store}
            property={editor.properties.tracking!}
            label="字距"
            min={-100}
            max={1000}
          />
          <AnimatedField
            store={store}
            property={editor.properties.lineHeight!}
            label="行距"
            min={0.1}
            max={10}
          />
          <label className="field">
            对齐
            <select
              aria-label="文字对齐"
              value={editor.textAlign}
              onChange={(e) =>
                settings({
                  textAlign: e.target.value as LayerEditor['textAlign'],
                })
              }
            >
              <option value="left">左对齐</option>
              <option value="center">居中</option>
              <option value="right">右对齐</option>
            </select>
          </label>
        </>
      )}
      {pathOpen && (
        <PathEditor
          store={store}
          property={editor.properties.path as Property<readonly number[]>}
          onClose={() => setPathOpen(false)}
        />
      )}
    </>
  );
}
