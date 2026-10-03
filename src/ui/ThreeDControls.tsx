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
      {layer.type !== 'camera' && (
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
          />
          <AnimatedField
            store={store}
            property={editor.properties.cameraRotation!}
            label="摄像机旋转"
          />
          <AnimatedField
            store={store}
            property={editor.properties.cameraZoom!}
            label="摄像机焦距"
            min={1}
            max={100000}
          />
          <NumberField
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
            />
            <AnimatedField
              store={store}
              property={editor.properties.rotation3D!}
              label="三维旋转"
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
              三维位置为相对二维位置的偏移；以合成中心为世界原点。通过 Z 深度和
              Y 旋转制作视差与卡片翻转。
            </p>
          </>
        )
      )}
    </>
  );
}
