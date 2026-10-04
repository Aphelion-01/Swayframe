import { Icon } from './workspace/icons';
import type { EditorStore } from './editor-store';
import {
  transformOrientations,
  transformPivotModes,
} from '../core/transform-context';
import type {
  TransformOrientation,
  TransformPivotMode,
} from '../core/transform-context';
export const orientationLabels: Record<TransformOrientation, string> = {
  global: '全局',
  local: '局部',
  parent: '父级',
  view: '视图',
};
export const pivotLabels: Record<TransformPivotMode, string> = {
  anchor: '锚点',
  'object-center': '几何中心',
  'bounds-center': '边界中心',
  'selection-center': '选区中心',
  'individual-origins': '各自中心',
  custom: '自定义',
};
export function TransformControls({
  store,
  disabled = false,
}: {
  store: EditorStore;
  disabled?: boolean;
}) {
  const settings = store.getSnapshot().transformSettings;
  return (
    <div className="transform-controls">
      <label title="变换轴向：全局 / 对象局部 / 父级 / 视图">
        <Icon name="select" />
        <select
          aria-label="变换轴向"
          disabled={disabled}
          value={settings.orientation}
          onChange={(e) =>
            store.setTransformSettings({
              orientation: e.target.value as TransformOrientation,
            })
          }
        >
          {transformOrientations.map((id) => (
            <option key={id} value={id}>
              {orientationLabels[id]}
            </option>
          ))}
        </select>
      </label>
      <label title="变换支点是临时操作设置，不修改图层锚点">
        <Icon name="anchor" />
        <select
          aria-label="变换支点"
          disabled={disabled}
          value={settings.pivotMode}
          onChange={(e) =>
            store.setTransformSettings({
              pivotMode: e.target.value as TransformPivotMode,
            })
          }
        >
          {transformPivotModes.map((id) => (
            <option key={id} value={id}>
              {pivotLabels[id]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
