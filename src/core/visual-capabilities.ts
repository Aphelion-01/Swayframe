import { radialGradientDefinition } from './radial-gradient';
import type { AnimValue } from './core-types';
import { deepFreeze, isVec2 } from './core-types';
import { effectDefinitions } from './effect-definitions';
import type { EffectKind, Property } from './project-model';
import type { GraphPort } from './compositing-graph';

export type VisualCategory = 'fill' | 'generator' | 'filter' | 'compositor';
export type ParameterType =
  | 'float'
  | 'integer'
  | 'boolean'
  | 'color'
  | 'vec2'
  | 'vec3'
  | 'enum'
  | 'gradientStops'
  | 'texture';
export interface ParameterDefinition {
  readonly id: string;
  readonly name: string;
  readonly type: ParameterType;
  readonly defaultValue: AnimValue;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly unit?: string;
  readonly animatable: boolean;
  readonly options?: readonly string[];
  readonly uiHints?: {
    readonly multiline?: boolean;
    readonly description?: string;
  };
}
export interface CapabilityReference {
  readonly id: string;
  readonly version: string;
  readonly contentHash?: string;
}
export interface VisualCapabilityDefinition extends CapabilityReference {
  readonly name: string;
  readonly description: string;
  readonly category: VisualCategory;
  readonly group:
    'Blur' | 'Color' | 'Distort' | 'Stylize' | 'Generate' | 'Utility';
  readonly inputs: readonly GraphPort[];
  readonly outputs: readonly GraphPort[];
  readonly parameters: readonly ParameterDefinition[];
  readonly implementation: {
    readonly kind: 'native' | 'declarative';
    readonly entryPoint: string;
  };
  readonly capabilities: {
    readonly animatable: boolean;
    readonly realtime: boolean;
    readonly deterministic: boolean;
    readonly usesTime: boolean;
  };
  readonly keywords: readonly string[];
}
/** Graph nodes are the canonical instances. This protocol also describes an Appearance fill. */
export interface VisualCapabilityInstance {
  readonly id: string;
  readonly capability: CapabilityReference;
  readonly enabled: boolean;
  readonly parameters: Readonly<Record<string, Property<AnimValue>>>;
}
export interface VisualCapabilityPreset {
  readonly id: string;
  readonly name: string;
  readonly capability: CapabilityReference;
  readonly values: Readonly<Record<string, AnimValue>>;
}
export function parameterError(
  spec: ParameterDefinition,
  value: AnimValue,
): string | undefined {
  const values =
    typeof value === 'number'
      ? [value]
      : Array.isArray(value)
        ? value
        : Object.values(value);
  const scalar = ['float', 'integer', 'boolean', 'enum', 'texture'].includes(
    spec.type,
  );
  if (
    scalar
      ? typeof value !== 'number'
      : spec.type === 'vec2'
        ? !isVec2(value)
        : !Array.isArray(value)
  )
    return `${spec.name}类型错误`;
  if (
    values.some(
      (n) =>
        !Number.isFinite(n) ||
        (spec.min !== undefined && n < spec.min) ||
        (spec.max !== undefined && n > spec.max),
    )
  )
    return `${spec.name}超出范围`;
  if (spec.type === 'integer' && !Number.isInteger(value))
    return `${spec.name}必须是整数`;
  if (spec.type === 'boolean' && value !== 0 && value !== 1)
    return `${spec.name}必须为开/关`;
  if (
    spec.type === 'enum' &&
    (typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 0 ||
      value >= (spec.options?.length ?? 0))
  )
    return `${spec.name}选项无效`;
  if (
    spec.type === 'color' &&
    (values.length !== 4 || values.some((n) => n < 0 || n > 1))
  )
    return `${spec.name}颜色无效`;
  if (spec.type === 'vec3' && values.length !== 3)
    return `${spec.name}需要三个分量`;
  if (spec.type === 'gradientStops') {
    if (values.length < 10 || values.length > 160 || values.length % 5 !== 0)
      return '渐变至少两个 Stop，最多32个';
    for (let i = 0; i < values.length; i += 5)
      if (
        values.slice(i, i + 5).some((n) => n < 0 || n > 1) ||
        (i > 0 && values[i]! < values[i - 5]!)
      )
        return '渐变 Stop 必须按位置排序，颜色范围0–1';
  }
  return undefined;
}
export class VisualCapabilityRegistry {
  private readonly items = new Map<string, VisualCapabilityDefinition>();
  register(definition: VisualCapabilityDefinition) {
    const key = definition.id + '@' + definition.version;
    if (this.items.has(key)) throw Error('能力版本重复');
    if (
      !/^[A-Za-z][A-Za-z0-9._-]{0,79}$/.test(definition.id) ||
      !/^\d+\.\d+\.\d+$/.test(definition.version) ||
      !definition.name ||
      new Set(definition.parameters.map((p) => p.id)).size !==
        definition.parameters.length
    )
      throw Error('能力定义无效');
    for (const p of definition.parameters) {
      const error = parameterError(p, p.defaultValue);
      if (error) throw Error(error);
    }
    this.items.set(key, deepFreeze(structuredClone(definition)));
  }
  get(id: string, version = '1.0.0') {
    return this.items.get(id + '@' + version);
  }
  all() {
    return [...this.items.values()];
  }
  search(query: string, category?: VisualCategory) {
    const text = query.trim().toLowerCase();
    return this.all().filter(
      (d) =>
        (!category || category === d.category) &&
        [d.id, d.name, d.description, ...d.keywords]
          .join(' ')
          .toLowerCase()
          .includes(text),
    );
  }
}
export const visualCapabilities = new VisualCapabilityRegistry();
const output: GraphPort = { id: 'out', name: '图像', type: 'Image' };
for (const [id, old] of Object.entries(effectDefinitions)) {
  visualCapabilities.register({
    id,
    name: old.label,
    version: '1.0.0',
    description: old.label,
    category: 'filter',
    group:
      id === 'gaussianBlur'
        ? 'Blur'
        : ['glow', 'dropShadow'].includes(id)
          ? 'Stylize'
          : 'Color',
    inputs: [{ id: 'in', name: '图像', type: 'Image', required: true }],
    outputs: [output],
    parameters: Object.entries(old.parameters).map(([id, p]) => ({
      id,
      name: p.label,
      type: 'float',
      defaultValue: p.value,
      min: p.min,
      max: p.max,
      animatable: true,
    })),
    implementation: { kind: 'native', entryPoint: id },
    capabilities: {
      animatable: true,
      realtime: true,
      deterministic: true,
      usesTime: false,
    },
    keywords: [
      id,
      old.label,
      ...(id === 'gaussianBlur' ? ['blur', '模糊'] : []),
    ],
  });
}
export const nativeEffectKind = (id: string): EffectKind | undefined =>
  id in effectDefinitions ? (id as EffectKind) : undefined;

visualCapabilities.register(radialGradientDefinition);
