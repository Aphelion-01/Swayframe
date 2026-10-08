import { validateEffect, effectDefinition } from './programmable-effect';
import type { EffectPackage, EffectContext } from './programmable-effect';
import { visualCapabilities, parameterError } from './visual-capabilities';
import { radialGradientDefinition } from './radial-gradient';
import { newId } from './core-types';
import type { AnimValue, Vec2 } from './core-types';
import { createProperty } from './project-model';
import type { EffectKind } from './project-model';
import { effectRegistry } from './effect-registry';
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
  readonly cacheKey?: string;
  capability?(id: string, params: Readonly<Record<string, AnimValue>>): T;
  programmable?(
    effect: EffectPackage,
    params: Readonly<Record<string, AnimValue>>,
    context: EffectContext,
    input?: T,
  ): T;
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
  readonly time?: number;
}
export interface NodeDefinition {
  readonly type: string;
  readonly title: string;
  readonly category: '输入' | '输出' | '颜色' | '空间' | '合成' | '工具';
  readonly inputs: readonly GraphPort[];
  readonly outputs: readonly GraphPort[];
  readonly params: Readonly<Record<string, NodeParameter>>;
  readonly icon?: string;
  readonly searchKeywords?: readonly string[];
  readonly protected?: boolean;
  readonly effectKind?: EffectKind;
  readonly usesTime?: boolean;
  readonly evaluate: <T>(context: NodeContext<T>) => T;
}
export class GraphNodeRegistry {
  private readonly items = new Map<string, NodeDefinition>();
  register(definition: NodeDefinition): void {
    if (
      !definition.type ||
      !definition.title ||
      !definition.category ||
      typeof definition.evaluate !== 'function'
    )
      throw Error('节点定义缺失');
    if (this.items.has(definition.type)) throw new Error('节点类型已注册');
    this.items.set(definition.type, {
      ...definition,
      icon: definition.icon ?? 'node',
      searchKeywords: definition.searchKeywords ?? [
        definition.type,
        definition.title,
        definition.category,
      ],
    });
  }
  get(type: string) {
    return this.items.get(type);
  }
  all() {
    return [...this.items.values()];
  }
  search(query: string) {
    return this.all().filter(
      (d) =>
        !d.protected &&
        [d.title, d.type, d.category, ...(d.searchKeywords ?? [])]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  }
}
export const graphNodeRegistry = new GraphNodeRegistry();
export const registerNode = (definition: NodeDefinition) => {
  graphNodeRegistry.register(definition);
  // Adapt existing graph-native processing without copying its renderer or ports.
  if (['solid', 'transform', 'mask', 'merge'].includes(definition.type))
    visualCapabilities.register({
      id: definition.type,
      version: '1.0.0',
      name: definition.title,
      description: definition.title,
      category:
        definition.type === 'merge'
          ? 'compositor'
          : definition.inputs.length
            ? 'filter'
            : 'generator',
      group: definition.type === 'solid' ? 'Generate' : 'Utility',
      inputs: definition.inputs,
      outputs: definition.outputs,
      parameters: Object.entries(definition.params).map(([id, p]) => ({
        id,
        name: p.label,
        type: p.color
          ? 'color'
          : typeof p.value === 'number'
            ? 'float'
            : Array.isArray(p.value)
              ? 'vec3'
              : 'vec2',
        defaultValue: p.value,
        min: p.min,
        max: p.max,
        animatable: true,
      })),
      implementation: { kind: 'native', entryPoint: definition.type },
      capabilities: {
        animatable: true,
        realtime: true,
        deterministic: true,
        usesTime: false,
      },
      keywords: [definition.type, definition.title],
    });
};
export const nodeDefinition = (type: string) => graphNodeRegistry.get(type);
export const nodeDefinitions = () => graphNodeRegistry.all();
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
for (const def of effectRegistry.all())
  registerNode({
    type: def.id,
    title: def.name,
    icon: def.icon,
    searchKeywords: def.keywords,
    category: ['Blur', 'Stylize'].includes(def.category) ? '空间' : '颜色',
    inputs: [imageIn],
    outputs: [imageOut],
    params: Object.fromEntries(
      Object.entries(def.parameters).map(([k, p]) => [k, p]),
    ),
    effectKind: def.id as EffectKind,
    evaluate: ({ params, inputs, backend }) =>
      def.render(backend, inputs.in ?? backend.transparent(), params),
  });
registerNode({
  type: radialGradientDefinition.id,
  title: radialGradientDefinition.name,
  category: '输入',
  inputs: [],
  outputs: radialGradientDefinition.outputs,
  params: Object.fromEntries(
    radialGradientDefinition.parameters.map((p) => [
      p.id,
      {
        label: p.name,
        value: p.defaultValue,
        min: p.min,
        max: p.max,
        color: p.type === 'color',
      },
    ]),
  ),
  evaluate: ({ params, backend }) => {
    if (!backend.capability) throw Error('渲染器不支持径向渐变');
    return backend.capability('radialGradient', params);
  },
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
const programmableDefinitions = new WeakMap<EffectPackage, NodeDefinition>();
export function nodeDefinitionFor(node: GraphNode): NodeDefinition | undefined {
  if (!node.type.startsWith('fx.')) return nodeDefinition(node.type);
  if (!node.effectPackage) return undefined;
  const hit = programmableDefinitions.get(node.effectPackage);
  if (hit) return hit;
  try {
    const p = validateEffect(node.effectPackage);
    if (node.type !== 'fx.' + p.contentHash) return undefined;
    const d = effectDefinition(p),
      def: NodeDefinition = {
        type: node.type,
        title: p.name,
        category: p.category === 'generator' ? '输入' : '空间',
        inputs: p.inputs,
        outputs: p.outputs,
        usesTime: d.capabilities.usesTime,
        params: Object.fromEntries(
          p.parameters.map((s) => [
            s.id,
            {
              label: s.name,
              value: s.defaultValue,
              min: s.min,
              max: s.max,
              color: s.type === 'color',
            },
          ]),
        ),
        evaluate: ({ params, inputs, backend, time = 0 }) => {
          if (!backend.programmable) throw Error('渲染器不支持声明式效果');
          return backend.programmable(
            p,
            params,
            { time, frame: 0, width: 0, height: 0 },
            inputs.in,
          );
        },
      };
    programmableDefinitions.set(node.effectPackage, def);
    return def;
  } catch {
    return undefined;
  }
}
export function createProgrammableNode(effect: EffectPackage): GraphNode {
  const p = validateEffect(effect);
  return {
    id: newId(),
    type: 'fx.' + p.contentHash,
    name: p.name,
    position: { x: 180, y: 50 },
    inputs: p.inputs,
    outputs: p.outputs,
    params: Object.fromEntries(
      p.parameters.map((s) => [
        s.id,
        createProperty(structuredClone(s.defaultValue)),
      ]),
    ),
    enabled: true,
    effectPackage: p,
  };
}
export function validateNode(node: GraphNode): string[] {
  const def = nodeDefinitionFor(node);
  // Preserve unavailable packages in project files; compilation provides diagnostics and bypass.
  if (node.type.startsWith('fx.') && !def) return [];

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
      const typed = (
        node.effectPackage?.parameters ??
        visualCapabilities.get(node.type)?.parameters
      )?.find((p) => p.id === key);
      if (typed) {
        const error = parameterError(typed, v);
        if (error) errors.push(`节点参数无效：${key}`);
        continue;
      }
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
