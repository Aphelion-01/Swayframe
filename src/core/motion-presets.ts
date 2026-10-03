import { z } from 'zod';
import { deepFreeze, newId } from './core-types';
import { motionCurveSchema } from './motion-curve';
import type { MotionCurve } from './motion-curve';
export const motionPresetSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(80),
    curve: motionCurveSchema,
    category: z.string().min(1).max(60),
    createdAt: z.number().finite().nonnegative(),
    tags: z.array(z.string().max(40)).max(30).optional(),
    intensity: z.number().min(0).max(1).optional(),
  })
  .strict();
export type MotionPreset = z.infer<typeof motionPresetSchema>;
const b = (x1: number, y1: number, x2: number, y2: number): MotionCurve => ({
  type: 'cubic-bezier',
  x1,
  y1,
  x2,
  y2,
});
const reverse = (c: MotionCurve): MotionCurve =>
  c.type === 'linear' ? c : b(1 - c.x2, 1 - c.y2, 1 - c.x1, 1 - c.y1);
const preset = (
  id: string,
  name: string,
  curve: MotionCurve,
  category = '基础',
  tags: readonly string[] = ['smooth'],
): MotionPreset => ({
  id: `builtin:${id}`,
  name,
  curve,
  category,
  createdAt: 0,
  tags: [...tags],
  intensity: 0.5,
});
/** Original approximations derived from endpoint slopes; no third-party preset data. */
const families: [string, string, MotionCurve, MotionCurve][] = [
  ['sine', '正弦', b(0.36, 0, 0.72, 0.56), b(0.37, 0, 0.63, 1)],
  ['quad', '二次', b(0.4, 0, 0.74, 0.48), b(0.44, 0, 0.56, 1)],
  ['cubic', '三次', b(0.4, 0, 0.8, 0.4), b(0.63, 0, 0.37, 1)],
  ['quart', '四次', b(0.48, 0, 0.85, 0.4), b(0.74, 0, 0.26, 1)],
  ['quint', '五次', b(0.52, 0, 0.88, 0.4), b(0.81, 0, 0.19, 1)],
  ['expo', '指数', b(0.6, 0, 0.91, 0.376), b(0.87, 0, 0.13, 1)],
  ['back', '回弹', b(0.34, -0.48, 0.69, -0.2), b(0.65, -0.65, 0.35, 1.65)],
];
export const builtinMotionPresets: readonly MotionPreset[] = deepFreeze([
  preset('linear', 'Linear · 线性', { type: 'linear' }),
  preset('ease-in', 'Ease In · 缓入', b(0.42, 0, 1, 1)),
  preset('ease-out', 'Ease Out · 缓出', b(0, 0, 0.58, 1)),
  preset('ease-in-out', 'Ease In-Out · 缓入缓出', b(0.42, 0, 0.58, 1)),
  ...families.flatMap(([id, name, input, both]) => [
    preset(
      `${id}-in`,
      `${id[0]!.toUpperCase() + id.slice(1)} In · ${name}缓入`,
      input,
      name,
    ),
    preset(
      `${id}-out`,
      `${id[0]!.toUpperCase() + id.slice(1)} Out · ${name}缓出`,
      reverse(input),
      name,
    ),
    preset(
      `${id}-in-out`,
      `${id[0]!.toUpperCase() + id.slice(1)} In-Out · ${name}双侧`,
      both,
      name,
    ),
  ]),
  preset('fast-out', 'Fast Out · 快速出场', b(0.08, 0.72, 0.24, 1), '风格', [
    'energetic',
  ]),
  preset('smooth', 'Smooth · 柔和', b(0.32, 0, 0.68, 1), '风格', [
    'soft',
    'smooth',
  ]),
  preset('cinematic', 'Cinematic · 电影感', b(0.62, 0, 0.22, 1), '风格', [
    'cinematic',
    'dramatic',
  ]),
  preset('ui-snappy', 'UI Snappy · 敏捷', b(0.16, 0.85, 0.3, 1.14), '风格', [
    'ui',
    'snappy',
  ]),
]);
const librarySchema = z
  .object({
    version: z.literal(1),
    custom: z.array(motionPresetSchema).max(200),
    favorites: z.array(z.string().max(100)).max(500),
    recent: z.array(z.string().max(100)).max(50),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.custom.map((p) => p.id)).size === v.custom.length &&
      v.custom.every((p) => !p.id.startsWith('builtin:')),
    '自定义预设 ID 无效',
  );
export type MotionLibraryState = z.infer<typeof librarySchema>;
export interface MotionPresetStorage {
  read(): string | null;
  write(value: string): void;
}
export function serializeMotionLibrary(state: MotionLibraryState): string {
  return JSON.stringify(librarySchema.parse(state));
}
export function parseMotionLibrary(text: string): MotionLibraryState {
  if (text.length > 1_000_000) throw new Error('曲线库文件过大');
  return librarySchema.parse(JSON.parse(text));
}
export class MotionPresetLibrary {
  #state: MotionLibraryState;
  #listeners = new Set<() => void>();
  constructor(private readonly storage?: MotionPresetStorage) {
    const text = storage?.read();
    this.#state = deepFreeze(
      text
        ? parseMotionLibrary(text)
        : { version: 1, custom: [], favorites: [], recent: [] },
    );
  }
  getSnapshot = () => this.#state;
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  #commit(next: MotionLibraryState) {
    const encoded = serializeMotionLibrary(next);
    this.storage?.write(encoded);
    this.#state = deepFreeze(next);
    for (const listener of this.#listeners) listener();
  }
  getPreset(id: string): MotionPreset {
    const p = [...builtinMotionPresets, ...this.#state.custom].find(
      (p) => p.id === id,
    );
    if (!p) throw new Error('预设不存在');
    return p;
  }
  saveMotionPreset(
    name: string,
    curve: MotionCurve,
    metadata: Partial<
      Pick<MotionPreset, 'category' | 'tags' | 'intensity'>
    > = {},
  ): MotionPreset {
    const p = motionPresetSchema.parse({
      id: newId(),
      name,
      curve,
      createdAt: Date.now(),
      category: '自定义',
      ...metadata,
    });
    this.#commit({ ...this.#state, custom: [...this.#state.custom, p] });
    return p;
  }
  rename(id: string, name: string) {
    const p = this.getPreset(id);
    if (id.startsWith('builtin:')) throw new Error('内置预设请先创建副本');
    const updated = motionPresetSchema.parse({ ...p, name });
    this.#commit({
      ...this.#state,
      custom: this.#state.custom.map((v) => (v.id === id ? updated : v)),
    });
  }
  delete(id: string) {
    this.getPreset(id);
    if (id.startsWith('builtin:')) throw new Error('不能删除内置预设');
    this.#commit({
      ...this.#state,
      custom: this.#state.custom.filter((p) => p.id !== id),
      favorites: this.#state.favorites.filter((v) => v !== id),
      recent: this.#state.recent.filter((v) => v !== id),
    });
  }
  favorite(id: string) {
    this.getPreset(id);
    this.#commit({
      ...this.#state,
      favorites: this.#state.favorites.includes(id)
        ? this.#state.favorites.filter((v) => v !== id)
        : [...this.#state.favorites, id],
    });
  }
  duplicate(id: string) {
    const p = this.getPreset(id);
    return this.saveMotionPreset(`${p.name.slice(0, 70)} 副本`, p.curve, {
      category: p.category,
      tags: p.tags,
      intensity: p.intensity,
    });
  }
  recordRecent(id: string) {
    this.getPreset(id);
    this.#commit({
      ...this.#state,
      recent: [id, ...this.#state.recent.filter((v) => v !== id)].slice(0, 50),
    });
  }
}
