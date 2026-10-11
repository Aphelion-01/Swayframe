import type { EffectPresetStorage } from './effect-presets';
/** Local runtime trust never belongs to Scene or portable effect packages. Storage is injected by the shell. */
const trusted = new Set<string>();
let storage: EffectPresetStorage | undefined;
export const isEffectTrusted = (hash: string) => trusted.has(hash);
export const trustEffect = (hash: string) => {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw Error('效果哈希无效');
  trusted.add(hash);
};
export const revokeEffectTrust = (hash: string) => {
  trusted.delete(hash);
  storage?.setItem('swayframe.effect-trust.v1', JSON.stringify([...trusted]));
};
export function configureEffectTrust(adapter: EffectPresetStorage) {
  if (storage === adapter) return;
  storage = adapter;
  try {
    const raw = storage.getItem('swayframe.effect-trust.v1');
    if (raw && raw.length < 100000) {
      const hashes: unknown = JSON.parse(raw);
      if (Array.isArray(hashes))
        for (const hash of hashes)
          if (typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash))
            trusted.add(hash);
    }
  } catch {
    /* Corrupt trust never grants permission. */
  }
}
export function rememberEffectTrust(hash: string): boolean {
  trustEffect(hash);
  try {
    storage?.setItem('swayframe.effect-trust.v1', JSON.stringify([...trusted]));
    return true;
  } catch {
    return false;
  }
}
