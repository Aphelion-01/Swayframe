import type {
  Interpolation,
  LayerKind,
  TransformKey,
} from '../core/project-model';

export const layerKindLabels: Record<LayerKind, string> = {
  rectangle: '矩形',
  ellipse: '椭圆',
  text: '文字',
  image: '图片',
  polygon: '多边形',
  star: '星形',
  path: '路径',
  solid: '纯色',
  null: '空对象',
  precomp: '预合成',
  camera: '摄像机',
};
export const transformLabels: Record<TransformKey, string> = {
  position: '位置',
  scale: '缩放',
  rotation: '旋转',
  opacity: '透明度',
};
export const interpolationLabels: Record<Interpolation['type'], string> = {
  linear: '线性',
  hold: '保持',
  bezier: '贝塞尔曲线',
  spring: '弹簧',
};
// Display previous built-in defaults in Chinese without rewriting loaded projects.
const legacyDefaults: Record<string, string> = {
  'Untitled Motion': '未命名工程',
  'Composition 01': '合成 01',
  Rectangle: '矩形',
  Ellipse: '椭圆',
  Text: '文字',
  Image: '图片',
  'Blue entrance': '蓝色方块入场',
};
export const displayName = (name: string): string =>
  legacyDefaults[name] ?? name;
