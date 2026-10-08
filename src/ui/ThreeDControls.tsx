import { editorCommands } from './workspace/feature-contributions';
import type { Layer } from '../core/project-model';
import { activeComposition } from '../core/project-model';
import { evaluateProperty } from '../core/animation-engine';
import { command } from '../core/command-system';
import { AnimatedField } from './AnimatedField';
import { NumberField } from './fields';
import type { EditorStore } from './editor-store';
export function ThreeDControls({
  store,
  layer,
}: {
  store: EditorStore;
  layer: Layer;
}) {
  const view = store.getSnapshot(),
    c = activeComposition(view.project),
    editor = layer.editor;
  if (!editor) return null;
  return (
    <>
      <div className="section-label">三维平面与摄像机</div>
      {(editor.is3D || layer.type === 'camera') && (
        <div className="segmented" role="group" aria-label="三维操控手柄模式">
          <button
            title="显示 XYZ 直线手柄，沿轴移动图层"
            aria-pressed={
              (view.spatialGizmoMode ?? 'translate') === 'translate'
            }
            onClick={() => editorCommands(store).execute('spatial-translate')}
          >
            移动手柄
          </button>
          <button
            title="显示 XYZ 旋转圆环，拖动绕对应轴旋转"
            aria-pressed={view.spatialGizmoMode === 'rotate'}
            onClick={() => editorCommands(store).execute('spatial-rotate')}
          >
            旋转手柄
          </button>
        </div>
      )}
      {layer.type !== 'camera' && layer.type !== 'model' && (
        <label className="checkbox-field">
          <input
            type="checkbox"
            aria-label="启用三维图层"
            checked={editor.is3D}
            onChange={(e) =>
              store.run('切换三维图层', [
                command({
                  type: 'layer.replace',
                  compositionId: c.id,
                  layer: {
                    ...layer,
                    editor: { ...editor, is3D: e.target.checked },
                  },
                }),
              ])
            }
          />
          三维图层
        </label>
      )}
      {layer.type === 'camera' ? (
        <>
          <AnimatedField
            store={store}
            property={editor.properties.cameraPosition!}
            label="摄像机位置"
            defaultLinked={false}
          />
          <AnimatedField
            store={store}
            property={editor.properties.cameraRotation!}
            label="摄像机旋转"
            defaultLinked={false}
          />
          <AnimatedField
            store={store}
            property={editor.properties.cameraZoom!}
            label="摄像机焦距"
            min={1}
            max={100000}
          />
          <NumberField
            revision={editor.properties.cameraZoom}
            time={view.time}
            onPreview={(v) => {
              const property = editor.properties.cameraZoom!;
              store.setPropertyPreview({
                id: property.id,
                property: {
                  ...property,
                  baseValue: c.height / (2 * Math.tan((v * Math.PI) / 360)),
                  keyframes: [],
                },
              });
            }}
            onCancel={() => store.setPropertyPreview(undefined)}
            label="摄像机视角（°）"
            value={
              (2 *
                Math.atan(
                  c.height /
                    (2 *
                      (evaluateProperty(
                        editor.properties.cameraZoom!,
                        view.time,
                      ) as number)),
                ) *
                180) /
              Math.PI
            }
            min={1}
            max={170}
            onCommit={(v) =>
              store.run('修改摄像机视角', [
                store.valueCommand(
                  editor.properties.cameraZoom!.id,
                  c.height / (2 * Math.tan((v * Math.PI) / 360)),
                ),
              ])
            }
            onError={(m) => store.setStatus(m, true)}
          />
          <button
            aria-pressed={view.showCameraFrustum}
            onClick={() => editorCommands(store).execute('camera-frustum')}
          >
            拍摄范围 {view.showCameraFrustum ? '已显示' : '已隐藏'}
          </button>
          <label className="checkbox-field">
            <input
              type="checkbox"
              aria-label="摄像机景深"
              checked={
                evaluateProperty(
                  editor.properties.cameraDepthOfField!,
                  view.time,
                ) === 1
              }
              onChange={(e) =>
                store.run('切换摄像机景深', [
                  store.valueCommand(
                    editor.properties.cameraDepthOfField!.id,
                    e.target.checked ? 1 : 0,
                  ),
                ])
              }
            />
            景深（按图层深度近似）
          </label>
          <AnimatedField
            store={store}
            property={editor.properties.cameraFocusDistance!}
            label="对焦距离"
            min={1}
            max={1000000}
          />
          <AnimatedField
            store={store}
            property={editor.properties.cameraAperture!}
            label="光圈 f/"
            min={0.1}
            max={128}
          />
          <AnimatedField
            store={store}
            property={editor.properties.cameraExposure!}
            label="曝光 EV"
            min={-10}
            max={10}
          />
          <p className="inspector-note">
            最上层可见摄像机生效。默认朝正 Z 方向；Z 增大表示向前移动。
          </p>
        </>
      ) : (
        editor.is3D && (
          <>
            <AnimatedField
              store={store}
              property={editor.properties.position3D!}
              label="三维位置"
              defaultLinked={false}
            />
            <AnimatedField
              store={store}
              property={editor.properties.rotation3D!}
              label="三维旋转"
              defaultLinked={false}
            />
            <AnimatedField
              store={store}
              property={editor.properties.scale3D!}
              label="三维缩放"
              linkMode="ratio"
            />
            <AnimatedField
              store={store}
              property={editor.properties.anchor3D!}
              label="三维锚点"
            />
            <p className="inspector-note">
              {layer.type === 'model' &&
                '静态模型保留几何和材质颜色；纹理、骨骼动画暂不支持。'}
              三维位置为相对二维位置的偏移；以合成中心为世界原点。通过 Z 深度和
              Y 旋转制作视差与卡片翻转。
            </p>
          </>
        )
      )}
    </>
  );
}
