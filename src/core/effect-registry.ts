import { visualCapabilities, nativeEffectKind } from './visual-capabilities';
import type { EffectKind } from './project-model';
import type { AnimValue } from './core-types';
export interface EffectBackend<T> {
  effect(
    input: T,
    kind: EffectKind,
    params: Readonly<Record<string, AnimValue>>,
  ): T;
}
export const effectCategories = {
  Color: '颜色',
  Blur: '模糊',
  Distort: '扭曲',
  Generate: '生成',
  Stylize: '风格化',
  Utility: '工具',
} as const;
export interface EffectDefinition {
  id: string;
  name: string;
  category: keyof typeof effectCategories;
  parameters: Readonly<
    Record<string, { label: string; value: number; min: number; max: number }>
  >;
  supportedLayerTypes: readonly string[];
  keywords: readonly string[];
  icon: string;
  render: <T>(
    backend: EffectBackend<T>,
    input: T,
    params: Readonly<Record<string, AnimValue>>,
  ) => T;
}
export class EffectRegistry {
  private readonly items = new Map<string, EffectDefinition>();
  register(def: EffectDefinition) {
    if (this.items.has(def.id)) throw Error('效果重复注册');
    if (
      !def.id ||
      !def.name ||
      !def.category ||
      !def.keywords.length ||
      !def.supportedLayerTypes.length ||
      typeof def.render !== 'function'
    )
      throw Error('效果定义缺失');
    this.items.set(def.id, def);
  }
  all() {
    return [...this.items.values()];
  }
  get(id: string) {
    return this.items.get(id);
  }
  search(query: string, layerType?: string) {
    return this.all().filter(
      (d) =>
        (!layerType || d.supportedLayerTypes.includes(layerType)) &&
        [d.name, d.category, ...d.keywords]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  }
}
export const effectRegistry = new EffectRegistry();
// Compatibility view; canonical metadata lives in VisualCapabilityRegistry.
for (const def of visualCapabilities
  .all()
  .filter((d) => !!nativeEffectKind(d.id))) {
  const kind = nativeEffectKind(def.id)!;
  effectRegistry.register({
    id: def.id,
    name: def.name,
    category: def.group,
    parameters: Object.fromEntries(
      def.parameters.map((p) => [
        p.id,
        {
          label: p.name,
          value: Number(p.defaultValue),
          min: p.min ?? -10000,
          max: p.max ?? 10000,
        },
      ]),
    ),
    supportedLayerTypes: ['shape', 'text', 'image', 'solid', 'precomp'],
    keywords: [...def.keywords, 'effect'],
    icon: kind === 'gaussianBlur' ? 'blur' : 'node',
    render: (backend, input, params) => backend.effect(input, kind, params),
  });
}
