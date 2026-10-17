import { z } from 'zod';
import { newId } from './core-types';
import type { AnimValue } from './core-types';
import { parameterError, visualCapabilities } from './visual-capabilities';
import type {
  VisualCapabilityPreset,
  VisualCapabilityDefinition,
} from './visual-capabilities';
const value = z.union([
  z.number().finite(),
  z.object({ x: z.number().finite(), y: z.number().finite() }).strict(),
  z.array(z.number().finite()).max(160),
]);
const schema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    capability: z
      .object({
        id: z.string().max(80),
        version: z.string().max(40),
        contentHash: z.string().max(64).optional(),
      })
      .strict(),
    values: z.record(z.string().max(100), value),
  })
  .strict();
export interface EffectPresetStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export class EffectPresetLibrary {
  constructor(private readonly storage: EffectPresetStorage) {}
  all(): VisualCapabilityPreset[] {
    const raw = this.storage.getItem('swayframe.effect-presets.v1');
    if (!raw) return [];
    try {
      return z.array(schema).max(100).parse(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  save(
    name: string,
    id: string,
    values: Readonly<Record<string, AnimValue>>,
    definition?: VisualCapabilityDefinition,
  ): VisualCapabilityPreset {
    const d = definition ?? visualCapabilities.get(id);
    if (!d) throw Error('效果定义缺失');
    for (const p of d.parameters) {
      const v = values[p.id];
      if (v === undefined) throw Error('预设参数缺失');
      const error = parameterError(p, v);
      if (error) throw Error(error);
    }
    const preset = schema.parse({
      id: newId(),
      name: name.trim(),
      capability: {
        id: d.id,
        version: d.version,
        ...(d.contentHash ? { contentHash: d.contentHash } : {}),
      },
      values,
    });
    const raw = this.storage.getItem('swayframe.effect-presets.v1');
    const current = raw ? z.array(schema).max(100).parse(JSON.parse(raw)) : [];
    if (current.length >= 100) throw Error('预设库最多100项');
    this.storage.setItem(
      'swayframe.effect-presets.v1',
      JSON.stringify([...current, preset]),
    );
    return preset;
  }
}
