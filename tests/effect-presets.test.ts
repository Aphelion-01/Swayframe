import { expect, it } from 'vitest';
import { EffectPresetLibrary } from '../src/core/effect-presets';
it('pins saved native preset version and values separately from Scene instances', () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
  const library = new EffectPresetLibrary(storage);
  const original = { radius: 12 };
  library.save('柔和', 'gaussianBlur', original);
  original.radius = 24;
  expect(new EffectPresetLibrary(storage).all()[0]).toMatchObject({
    capability: { id: 'gaussianBlur', version: '1.0.0' },
    values: { radius: 12 },
  });
  expect(() => library.save('无效', 'gaussianBlur', { radius: -1 })).toThrow(
    '范围',
  );
});
