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
export const orientationDescriptions: Record<TransformOrientation, string> = {
  global: '沿合成 X/Y 轴移动',
  local: '沿对象自身 X/Y 轴移动',
  parent: '沿父级 X/Y 轴移动',
  view: '沿屏幕 X/Y 轴移动',
};
export const pivotDescriptions: Record<TransformPivotMode, string> = {
  anchor: '围绕对象锚点旋转 / 缩放',
  'object-center': '围绕对象几何中心旋转 / 缩放',
  'bounds-center': '围绕包围框中心旋转 / 缩放',
  'selection-center': '围绕所选对象中心旋转 / 缩放',
  'individual-origins': '每个对象围绕自身中心旋转 / 缩放',
  custom: '围绕自定义支点旋转 / 缩放，可拖动画布十字标记',
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
