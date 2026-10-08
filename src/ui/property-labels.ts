import { nodeDefinition } from '../core/compositing-registry';
import { layerProperties } from '../core/project-model';
import type { Layer, PropertyEntry } from '../core/project-model';
export const propertyNames: Record<string, string> = {
  'transform.position': '位置',
  'transform.scale': '缩放',
  'transform.rotation': '旋转',
  'transform.opacity': '透明度',
  anchor: '锚点',
  fill: '填充',
  stroke: '描边',
  strokeWidth: '描边宽度',
  gradientEnd: '渐变末色',
  sides: '边数',
  innerRadius: '内半径',
  path: '路径',
  fontItalic: '斜体',
  textUnderline: '下划线',
  textAnimatorEnabled: '文本动画开关',
  textRangeStart: '范围起点',
  textRangeEnd: '范围终点',
  textRangeOffset: '范围偏移',
  textAnimatorOpacity: '字符透明度',
  textAnimatorX: '字符水平偏移',
  textAnimatorY: '字符垂直偏移',
  textAnimatorScale: '字符缩放',
  textAnimatorRotation: '字符旋转',
  cameraDepthOfField: '景深',
  cameraFocusDistance: '对焦距离',
  cameraAperture: '光圈 f/',
  cameraExposure: '曝光 EV',
  fontSize: '字号',
  fontWeight: '字重',
  tracking: '字距',
  lineHeight: '行距',
  position3D: '三维位置',
  rotation3D: '三维旋转',
  scale3D: '三维缩放',
  anchor3D: '三维锚点',
  cameraPosition: '摄像机位置',
  cameraRotation: '摄像机旋转',
  cameraZoom: '摄像机焦距',
  opacity: '不透明度',
  feather: '羽化',
  expansion: '扩展',
  amount: '强度',
  brightness: '亮度',
  contrast: '对比度',
  exposure: '曝光',
  hue: '色相',
  saturation: '饱和度',
  lightness: '明度',
  temperature: '色温',
  tint: '色调',
  black: '黑场',
  white: '白场',
  gamma: '伽马',
  radius: '半径',
  x: '偏移 X',
  y: '偏移 Y',
  red: '红色',
  green: '绿色',
  blue: '蓝色',
};
export function propertyLabel(key: string, layer?: Layer): string {
  const parts = key.split('.'),
    name = parts.at(-1)!;
  if (key.includes('.graph.nodes.')) {
    const node = layer?.editor?.graph?.nodes[Number(parts[3])];
    return `${node?.name ?? '节点 ' + (Number(parts[3]) + 1)} · ${nodeDefinition(node?.type ?? '')?.params[name]?.label ?? propertyNames[name] ?? name}`;
  }
  if (key.startsWith('transform.')) return propertyNames[key]!;
  if (key.includes('.masks.'))
    return `遮罩 ${Number(parts[2]) + 1} · ${propertyNames[name] ?? name}`;
  if (key.includes('.effects.'))
    return `效果 ${Number(parts[2]) + 1} · ${propertyNames[name] ?? name}`;
  return propertyNames[name] ?? name;
}
export function visibleProperties(layer: Layer): PropertyEntry[] {
  return layerProperties(layer).filter(({ key, property }) => {
    if (key.startsWith('transform.') && layer.type === 'camera') return false;
    if (key === 'transform.opacity' && layer.type === 'null') return false;
    if (
      key.startsWith('transform.') &&
      layer.editor?.is3D &&
      key !== 'transform.opacity'
    )
      return false;
    if (
      key.endsWith('.anchor') &&
      (layer.editor?.is3D || layer.type === 'camera')
    )
      return false;
    if (
      key.startsWith('transform.') ||
      property.keyframes.length ||
      key.includes('.masks.') ||
      key.includes('.effects.') ||
      key.includes('.graph.nodes.')
    )
      return true;
    const name = key.split('.').at(-1)!;
    if (name.startsWith('text') || name === 'fontItalic')
      return layer.type === 'text';
    if (name === 'anchor') return true;
    if (layer.type === 'camera') return name.startsWith('camera');
    if (name.startsWith('camera')) return false;
    if (name.endsWith('3D')) return !!layer.editor?.is3D;
    if (['fontSize', 'fontWeight', 'tracking', 'lineHeight'].includes(name))
      return layer.type === 'text';
    if (name === 'fill') return ['shape', 'solid', 'text'].includes(layer.type);
    if (layer.type !== 'shape') return false;
    if (name === 'path') return layer.shapeKind === 'path';
    if (name === 'sides')
      return layer.shapeKind === 'polygon' || layer.shapeKind === 'star';
    if (name === 'innerRadius') return layer.shapeKind === 'star';
    if (name === 'gradientEnd')
      return !!layer.editor?.gradient && layer.editor.gradient !== 'none';
    if (name === 'stroke' || name === 'strokeWidth') return true;
    return false;
  });
}
