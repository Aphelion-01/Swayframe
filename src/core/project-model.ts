import { accentAt } from './layer-accent';
import type { LayerAccentId } from './layer-accent';
import { createGraph } from './compositing-registry';
import type { CompositingGraph } from './compositing-graph';
import { newId } from './core-types';
import type { AnimValue, Color, ID, Seconds, Vec2 } from './core-types';

export type Interpolation =
  | { readonly type: 'linear' }
  | { readonly type: 'hold' }
  | { readonly type: 'bezier'; readonly out: Vec2; readonly in: Vec2 }
  | {
      readonly type: 'spring';
      readonly stiffness: number;
      readonly damping: number;
      readonly mass: number;
    };
export interface Keyframe<T> {
  readonly id: ID;
  readonly time: Seconds;
  readonly value: T;
  readonly interpolation: Interpolation;
  readonly incoming?: Vec2;
  readonly outgoing?: Vec2;
  readonly spatialIncoming?: Vec2 | readonly number[];
  readonly spatialOutgoing?: Vec2 | readonly number[];
}
export interface Property<T> {
  readonly id: ID;
  readonly baseValue: T;
  readonly keyframes: readonly Keyframe<T>[];
}
export interface Transform {
  readonly position: Property<Vec2>;
  readonly scale: Property<Vec2>;
  readonly rotation: Property<number>;
  readonly opacity: Property<number>;
}
export type TransformKey = keyof Transform;
export const transformKeys: readonly TransformKey[] = [
  'position',
  'scale',
  'rotation',
  'opacity',
];
export interface SemanticMetadata {
  readonly semanticRole?: string;
  readonly visualRole?: string;
  readonly importance?: number;
  readonly tags?: readonly string[];
}
export interface LayerBase {
  readonly id: ID;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly transform: Transform;
  readonly editor?: LayerEditor;
  readonly semantic?: SemanticMetadata;
  readonly ui?: { readonly accentColorId?: LayerAccentId };
  readonly width: number;
  readonly height: number;
}
export interface ShapeLayer extends LayerBase {
  readonly type: 'shape';
  readonly shapeKind: 'rectangle' | 'ellipse' | 'polygon' | 'star' | 'path';
  readonly fill: Color;
}
export interface TextLayer extends LayerBase {
  readonly type: 'text';
  readonly text: string;
  readonly fontSize: number;
  readonly fontFamily: string;
  readonly fill: Color;
}
export interface ImageLayer extends LayerBase {
  readonly type: 'image';
  readonly assetId: ID;
}
export interface ModelLayer extends LayerBase {
  readonly type: 'model';
  readonly assetId: ID;
}
export interface UtilityLayer extends LayerBase {
  readonly type: 'solid' | 'null' | 'precomp' | 'camera';
  readonly compositionId?: ID;
}
export type Layer =
  ShapeLayer | TextLayer | ImageLayer | ModelLayer | UtilityLayer;
export type LayerKind =
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'star'
  | 'path'
  | 'text'
  | 'image'
  | 'model'
  | 'solid'
  | 'null'
  | 'precomp'
  | 'camera';
export interface ModelGeometry {
  readonly vertices: readonly number[];
  readonly colors: readonly number[];
  readonly format: string;
}
export interface Asset {
  readonly mesh?: ModelGeometry;
  readonly id: ID;
  readonly name: string;
  readonly mimeType: string;
  readonly dataUrl: string;
  readonly source?: {
    readonly kind: 'linked';
    readonly path: string;
    readonly metadata: {
      readonly width: number;
      readonly height: number;
      readonly size: number;
      readonly modifiedAt: number;
    };
  };
}
export interface Composition {
  readonly id: ID;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly duration: Seconds;
  readonly layers: readonly Layer[];
  readonly backgroundColor?: Color;
}
export interface Project {
  readonly schemaVersion: '0.7.0';
  readonly id: ID;
  readonly name: string;
  readonly compositions: readonly Composition[];
  readonly activeCompositionId: ID;
  readonly assets: readonly Asset[];
}
export const createProperty = <T>(baseValue: T): Property<T> => ({
  id: newId(),
  baseValue,
  keyframes: [],
});
export function createComposition(
  options: Partial<
    Pick<Composition, 'name' | 'width' | 'height' | 'fps' | 'duration'>
  > = {},
): Composition {
  const composition: Composition = {
    id: newId(),
    name: '合成 01',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
    layers: [],
    ...options,
  };
  for (const value of [
    composition.width,
    composition.height,
    composition.fps,
    composition.duration,
  ]) {
    if (!Number.isFinite(value) || value <= 0)
      throw new Error('合成尺寸、帧率和时长必须为正数');
  }
  return composition;
}
export function createDefaultProject(
  composition = createComposition(),
): Project {
  return {
    schemaVersion: '0.7.0',
    id: newId(),
    name: '未命名工程',
    compositions: [composition],
    activeCompositionId: composition.id,
    assets: [],
  };
}
function createLegacyLayer(
  kind: LayerKind,
  options: {
    name?: string;
    position?: Vec2;
    assetId?: ID;
    width?: number;
    height?: number;
    compositionId?: ID;
  } = {},
): Layer {
  const base: LayerBase = {
    id: newId(),
    name:
      options.name ??
      {
        rectangle: '矩形',
        ellipse: '椭圆',
        text: '文字',
        image: '图片',
        model: '三维模型',
        polygon: '多边形',
        star: '星形',
        path: '路径',
        solid: '纯色',
        null: '空对象',
        precomp: '预合成',
        camera: '摄像机',
      }[kind],
    visible: true,
    locked: false,
    width: options.width ?? (kind === 'text' ? 480 : 240),
    height: options.height ?? (kind === 'text' ? 90 : 240),
    transform: {
      position: createProperty(options.position ?? { x: 960, y: 540 }),
      scale: createProperty({ x: 1, y: 1 }),
      rotation: createProperty(0),
      opacity: createProperty(1),
    },
  };
  const fill: Color = { r: 0.18, g: 0.42, b: 1, a: 1 };
  if (['rectangle', 'ellipse', 'polygon', 'star', 'path'].includes(kind))
    return {
      ...base,
      type: 'shape',
      shapeKind: kind as ShapeLayer['shapeKind'],
      fill,
    };
  if (kind === 'text')
    return {
      ...base,
      type: 'text',
      text: '请输入文本',
      fontSize: 60,
      fontFamily: 'sans-serif',
      fill,
    };
  if (['solid', 'null', 'precomp', 'camera'].includes(kind))
    return {
      ...base,
      type: kind as UtilityLayer['type'],
      ...(options.compositionId
        ? { compositionId: options.compositionId }
        : {}),
    };
  if (!options.assetId) throw new Error('图片图层必须引用素材编号');
  return {
    ...base,
    type: kind === 'model' ? 'model' : 'image',
    assetId: options.assetId,
  };
}
let nextLayerAccent = 0;
export function createLayer(
  kind: LayerKind,
  options: Parameters<typeof createLegacyLayer>[1] = {},
): Layer {
  const layer = createLegacyLayer(kind, options);
  return {
    ...layer,
    editor: createLayerEditor(layer),
    ui: { accentColorId: accentAt(nextLayerAccent++) },
  };
}
export function activeComposition(project: Project): Composition {
  const composition = project.compositions.find(
    (c) => c.id === project.activeCompositionId,
  );
  if (!composition) throw new Error('活动 合成不存在');
  return composition;
}
export const blendModes = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'add',
  'darken',
  'lighten',
] as const;
export type BlendMode = (typeof blendModes)[number];
export const effectKinds = [
  'brightnessContrast',
  'exposure',
  'hueSaturation',
  'temperature',
  'tint',
  'levels',
  'gaussianBlur',
  'dropShadow',
  'glow',
  'tintFill',
] as const;
export type EffectKind = (typeof effectKinds)[number];
export interface Effect {
  readonly id: ID;
  readonly kind: EffectKind;
  readonly enabled: boolean;
  readonly parameters: Readonly<Record<string, Property<number>>>;
}
export interface Mask {
  readonly id: ID;
  readonly kind: 'rectangle' | 'ellipse' | 'path';
  readonly mode: 'add' | 'subtract' | 'intersect';
  readonly enabled: boolean;
  readonly path: Property<readonly number[]>;
  readonly opacity: Property<number>;
  readonly feather: Property<number>;
  readonly expansion: Property<number>;
}
export interface LayerEditor {
  readonly graph?: CompositingGraph;
  readonly properties: Readonly<Record<string, Property<AnimValue>>>;
  readonly parentId: ID | null;
  readonly inPoint: number;
  readonly outPoint: number;
  readonly startTime: number;
  readonly blendMode: BlendMode;
  readonly is3D: boolean;
  readonly pathClosed: boolean;
  readonly gradient: 'none' | 'linear' | 'radial';
  readonly textAlign: 'left' | 'center' | 'right';
  readonly strokeJoin: 'round' | 'bevel' | 'miter';
  readonly strokeCap: 'round' | 'butt' | 'square';
  readonly masks: readonly Mask[];
  readonly effects?: readonly Effect[];
}
export function createLayerEditor(layer: Layer): LayerEditor {
  const fill = 'fill' in layer ? layer.fill : { r: 0.18, g: 0.42, b: 1, a: 1 };
  return {
    parentId: null,
    inPoint: 0,
    outPoint: 3600,
    startTime: 0,
    blendMode: 'normal',
    is3D: layer.type === 'model' || layer.type === 'camera',
    pathClosed: true,
    gradient: 'none',
    textAlign: 'left',
    strokeJoin: 'round',
    strokeCap: 'round',
    masks: [],
    graph: createGraph(layer.id),
    properties: {
      anchor: createProperty({ x: 0, y: 0 }),
      fill: createProperty([fill.r, fill.g, fill.b, fill.a]),
      stroke: createProperty([1, 1, 1, 1]),
      strokeWidth: createProperty(0),
      gradientEnd: createProperty([0.8, 0.1, 0.6, 1]),
      sides: createProperty(5),
      innerRadius: createProperty(0.45),
      path: createProperty([
        -120, -120, -120, -120, -120, -120, 120, -120, 120, -120, 120, -120,
        120, 120, 120, 120, 120, 120, -120, 120, -120, 120, -120, 120,
      ]),
      fontSize: createProperty(layer.type === 'text' ? layer.fontSize : 60),
      fontWeight: createProperty(400),
      tracking: createProperty(0),
      fontItalic: createProperty(0),
      textUnderline: createProperty(0),
      textAnimatorEnabled: createProperty(0),
      textRangeStart: createProperty(0),
      textRangeEnd: createProperty(100),
      textRangeOffset: createProperty(0),
      textAnimatorOpacity: createProperty(0),
      textAnimatorX: createProperty(0),
      textAnimatorY: createProperty(40),
      textAnimatorScale: createProperty(100),
      textAnimatorRotation: createProperty(0),
      lineHeight: createProperty(1.2),
      position3D: createProperty([0, 0, 0]),
      rotation3D: createProperty([0, 0, 0]),
      scale3D: createProperty([1, 1, 1]),
      anchor3D: createProperty([0, 0, 0]),
      cameraPosition: createProperty([0, 0, -1000]),
      cameraRotation: createProperty([0, 0, 0]),
      cameraZoom: createProperty(1000),
      cameraDepthOfField: createProperty(0),
      cameraFocusDistance: createProperty(1000),
      cameraAperture: createProperty(2.8),
      cameraExposure: createProperty(0),
    },
  };
}
export interface PropertyEntry {
  readonly key: string;
  readonly property: Property<AnimValue>;
}
export function layerProperties(layer: Layer): PropertyEntry[] {
  const result: PropertyEntry[] = [];
  const visit = (value: unknown, key: string) => {
    if (!value || typeof value !== 'object') return;
    if ('id' in value && 'baseValue' in value && 'keyframes' in value) {
      result.push({ key, property: value as Property<AnimValue> });
      return;
    }
    for (const [name, child] of Object.entries(value))
      visit(child, key ? key + '.' + name : name);
  };
  visit(layer, '');
  return result;
}
export function replaceProperty<T>(
  value: T,
  id: ID,
  property: Property<AnimValue>,
): T {
  if (!value || typeof value !== 'object') return value;
  if ('id' in value && 'baseValue' in value && value.id === id)
    return property as T;
  if (Array.isArray(value))
    return value.map((v) => replaceProperty(v, id, property)) as T;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      replaceProperty(v, id, property),
    ]),
  ) as T;
}
export function findProperty(
  project: Project,
  id: ID,
): {
  composition: Composition;
  layer: Layer;
  key: string;
  property: Property<AnimValue>;
} {
  for (const composition of project.compositions)
    for (const layer of composition.layers) {
      const entry = layerProperties(layer).find((p) => p.property.id === id);
      if (entry) return { composition, layer, ...entry };
    }
  throw new Error('属性不存在');
}
