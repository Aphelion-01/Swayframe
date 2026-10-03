import { newId } from './core-types';
import type { AnimValue, Vec2 } from './core-types';
import { createProperty } from './project-model';
import type { EffectKind } from './project-model';
import { effectDefinitions } from './effect-definitions';
import type {
  CompositingGraph,
  GraphNode,
  GraphPort,
} from './compositing-graph';
export interface NodeParameter {
  readonly label: string;
  readonly value: AnimValue;
  readonly min?: number;
  readonly max?: number;
  readonly color?: boolean;
}
export interface NodeBackend<T> {
  source(): T;
  transparent(): T;
  effect(
    input: T,
    kind: EffectKind,
    params: Readonly<Record<string, AnimValue>>,
  ): T;
  solid(params: Readonly<Record<string, AnimValue>>): T;
  transform(input: T, params: Readonly<Record<string, AnimValue>>): T;
  mask(params: Readonly<Record<string, AnimValue>>): T;
  merge(
    a: T,
    b: T,
    mask: T | undefined,
    params: Readonly<Record<string, AnimValue>>,
  ): T;
}
export interface NodeContext<T> {
  readonly inputs: Readonly<Record<string, T>>;
  readonly params: Readonly<Record<string, AnimValue>>;
  readonly backend: NodeBackend<T>;
}
export interface NodeDefinition {
  readonly type: string;
  readonly title: string;
  readonly category: '输入' | '输出' | '颜色' | '空间' | '合成' | '工具';
  readonly inputs: readonly GraphPort[];
  readonly outputs: readonly GraphPort[];
  readonly params: Readonly<Record<string, NodeParameter>>;
  readonly protected?: boolean;
  readonly effectKind?: EffectKind;
  readonly evaluate: <T>(context: NodeContext<T>) => T;
}
const registry = new Map<string, NodeDefinition>();
export function registerNode(definition: NodeDefinition): void {
  if (registry.has(definition.type)) throw new Error('节点类型已注册');
  registry.set(definition.type, definition);
}
export const nodeDefinition = (type: string) => registry.get(type);
export const nodeDefinitions = () => [...registry.values()];
const imageIn: GraphPort = {
  id: 'in',
  name: '图像',
  type: 'Image',
  required: true,
};
const imageOut: GraphPort = { id: 'out', name: '图像', type: 'Image' };
registerNode({
  type: 'source',
  title: '源图像',
  category: '输入',
  inputs: [],
  outputs: [imageOut],
  params: {},
  protected: true,
  evaluate: ({ backend }) => backend.source(),
});
registerNode({
  type: 'output',
  title: '输出',
  category: '输出',
  inputs: [imageIn],
  outputs: [],
  params: {},
  protected: true,
  evaluate: ({ inputs, backend }) => inputs.in ?? backend.transparent(),
});
registerNode({
  type: 'passthrough',
  title: '直通',
  category: '工具',
  inputs: [imageIn],
  outputs: [imageOut],
  params: {},
  evaluate: ({ inputs, backend }) => inputs.in ?? backend.transparent(),
});
registerNode({
  type: 'solid',
  title: '纯色',
  category: '输入',
  inputs: [],
  outputs: [imageOut],
  params: {
    color: {
      label: '颜色',
      value: [0.18, 0.42, 1, 1],
      min: 0,
      max: 1,
      color: true,
    },
  },
  evaluate: ({ params, backend }) => backend.solid(params),
});
registerNode({
  type: 'transform',
  title: '变换',
  category: '空间',
  inputs: [imageIn],
  outputs: [imageOut],
  params: {
    position: { label: '位置', value: { x: 0, y: 0 } },
    scale: { label: '缩放', value: { x: 1, y: 1 } },
    rotation: { label: '旋转', value: 0 },
    anchor: { label: '锚点', value: { x: 0, y: 0 } },
  },
  evaluate: ({ params, inputs, backend }) =>
    backend.transform(inputs.in ?? backend.transparent(), params),
});
registerNode({
  type: 'mask',
  title: '遮罩',
  category: '合成',
  inputs: [],
  outputs: [{ id: 'mask', name: '遮罩', type: 'Mask' }],
  params: {
    position: { label: '位置', value: { x: 0, y: 0 } },
    size: { label: '尺寸', value: { x: 200, y: 200 }, min: 0, max: 16384 },
    shape: { label: '形状（0矩形 / 1椭圆）', value: 0, min: 0, max: 1 },
    opacity: { label: '透明度', value: 1, min: 0, max: 1 },
    feather: { label: '羽化', value: 0, min: 0, max: 200 },
  },
  evaluate: ({ params, backend }) => backend.mask(params),
});
registerNode({
  type: 'merge',
  title: '合并',
  category: '合成',
  inputs: [
    { ...imageIn, id: 'a', name: 'A 前景' },
    { ...imageIn, id: 'b', name: 'B 背景' },
    { id: 'mask', name: '遮罩', type: 'Mask' },
  ],
  outputs: [imageOut],
  params: {
    mode: {
      label: '模式（0覆盖 / 1叠底 / 2滤色 / 3相加）',
      value: 0,
      min: 0,
      max: 3,
    },
    opacity: { label: '前景透明度', value: 1, min: 0, max: 1 },
  },
  evaluate: ({ params, inputs, backend }) =>
    backend.merge(
      inputs.a ?? backend.transparent(),
      inputs.b ?? backend.transparent(),
      inputs.mask,
      params,
    ),
});
for (const [kind, def] of Object.entries(effectDefinitions))
  registerNode({
    type: kind,
    title: def.label,
    category: ['gaussianBlur', 'dropShadow', 'glow'].includes(kind)
      ? '空间'
      : '颜色',
    inputs: [imageIn],
    outputs: [imageOut],
    params: Object.fromEntries(
      Object.entries(def.parameters).map(([k, p]) => [k, p]),
    ),
    effectKind: kind as EffectKind,
    evaluate: ({ params, inputs, backend }) =>
      backend.effect(
        inputs.in ?? backend.transparent(),
        kind as EffectKind,
        params,
      ),
  });
export function createNode(
  type: string,
  position: Vec2 = { x: 0, y: 0 },
): GraphNode {
  const def = nodeDefinition(type);
  if (!def) throw new Error(`未知节点类型：${type}`);
  return {
    id: newId(),
    type,
    name: def.title,
    position,
    inputs: structuredClone(def.inputs),
    outputs: structuredClone(def.outputs),
    params: Object.fromEntries(
      Object.entries(def.params).map(([k, p]) => [
        k,
        createProperty(structuredClone(p.value)),
      ]),
    ),
    enabled: true,
  };
}
export function createGraph(layerId: string): CompositingGraph {
  const source = createNode('source', { x: 40, y: 50 }),
    output = createNode('output', { x: 320, y: 50 });
  return {
    id: newId(),
    version: 1,
    owner: { type: 'layer', id: layerId },
    nodes: [source, output],
    edges: [
      {
        id: newId(),
        from: { nodeId: source.id, portId: 'out' },
        to: { nodeId: output.id, portId: 'in' },
      },
    ],
    outputNodeId: output.id,
  };
}
export function validateNode(node: GraphNode): string[] {
  const def = nodeDefinition(node.type);
  if (!def) return [`未知节点类型：${node.type}`];
  const errors: string[] = [];
  if (
    JSON.stringify(node.inputs) !== JSON.stringify(def.inputs) ||
    JSON.stringify(node.outputs) !== JSON.stringify(def.outputs)
  )
    errors.push('端口定义与注册表不一致');
  if (
    Object.keys(node.params).sort().join() !==
    Object.keys(def.params).sort().join()
  )
    errors.push('节点参数不完整');
  for (const [key, p] of Object.entries(node.params)) {
    const spec = def.params[key];
    if (!spec) continue;
    for (const v of [p.baseValue, ...p.keyframes.map((k) => k.value)]) {
      const values =
        typeof v === 'number' ? [v] : Array.isArray(v) ? v : Object.values(v);
      const same =
        typeof spec.value === 'number'
          ? typeof v === 'number'
          : Array.isArray(spec.value)
            ? Array.isArray(v) && v.length === spec.value.length
            : typeof v === 'object' && !Array.isArray(v);
      if (
        !same ||
        values.some(
          (n) =>
            !Number.isFinite(n) ||
            (spec.min !== undefined && n < spec.min) ||
            (spec.max !== undefined && n > spec.max),
        )
      )
        errors.push(`节点参数无效：${key}`);
    }
  }
  return errors;
}
