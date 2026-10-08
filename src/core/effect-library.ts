import { validateEffect } from './programmable-effect';
import type { EffectPackage } from './programmable-effect';
import type { EffectPresetStorage } from './effect-presets';
/** Packages are immutable and keyed by exact hash. Updating a library never rewrites Scene. */
export class UserEffectLibrary {
  constructor(private readonly storage: EffectPresetStorage) {}
  all(): EffectPackage[] {
    const raw = this.storage.getItem('swayframe.effect-library.v1');
    if (!raw) return [];
    if (raw.length > 4194304) throw Error('效果库超出4MB上限');
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list) || list.length > 100)
      throw Error('效果库结构损坏，请先导出备份后修复');
    return list.map(validateEffect);
  }
  save(raw: unknown) {
    const p = validateEffect(raw),
      current = this.all();
    if (current.some((v) => v.contentHash === p.contentHash)) return p;
    if (current.some((v) => v.id === p.id && v.version === p.version))
      throw Error('同一ID和版本已有不同内容，请提升版本号');
    if (current.length >= 100) throw Error('效果库最多100项');
    const next = JSON.stringify([...current, p]);
    if (next.length > 4194304) throw Error('效果库超出4MB上限');
    this.storage.setItem('swayframe.effect-library.v1', next);
    return p;
  }
  remove(hash: string) {
    this.storage.setItem(
      'swayframe.effect-library.v1',
      JSON.stringify(this.all().filter((p) => p.contentHash !== hash)),
    );
  }
}
