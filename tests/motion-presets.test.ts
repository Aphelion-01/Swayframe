import { it, expect } from 'vitest';
import {
  MotionPresetLibrary,
  builtinMotionPresets,
  parseMotionLibrary,
  serializeMotionLibrary,
} from '../src/core/motion-presets';
import { evaluateMotionCurve } from '../src/core/motion-curve';
it('内置完整曲线族各有名称，Back Out 真正超过终值再回落', () => {
  expect(builtinMotionPresets).toHaveLength(29);
  expect(new Set(builtinMotionPresets.map((p) => p.id)).size).toBe(29);
  const back = builtinMotionPresets.find((p) => p.id === 'builtin:back-out')!;
  expect(evaluateMotionCurve(back.curve, 0.7)).toBeGreaterThan(1);
  expect(evaluateMotionCurve(back.curve, 1)).toBe(1);
});
it('自定义曲线库跨实例持久化；改名、复制、收藏、最近、删除完整且不包含工程', () => {
  let saved: string | null = null;
  const storage = {
      read: () => saved,
      write: (v: string) => {
        saved = v;
      },
    },
    a = new MotionPresetLibrary(storage);
  const p = a.saveMotionPreset(
    '柔和标题',
    { type: 'cubic-bezier', x1: 0.2, y1: -0.3, x2: 0.7, y2: 1.2 },
    { tags: ['soft'], intensity: 0.4 },
  );
  a.rename(p.id, '新名称');
  a.favorite(p.id);
  a.recordRecent(p.id);
  const copy = a.duplicate(p.id);
  const b = new MotionPresetLibrary(storage);
  expect(b.getPreset(p.id).name).toBe('新名称');
  expect(b.getSnapshot().favorites).toContain(p.id);
  expect(b.getSnapshot().recent).toEqual([p.id]);
  expect(b.getPreset(copy.id).curve).toEqual(p.curve);
  expect(parseMotionLibrary(serializeMotionLibrary(b.getSnapshot()))).toEqual(
    b.getSnapshot(),
  );
  b.delete(p.id);
  expect(b.getSnapshot().favorites).toEqual([]);
  expect(b.getSnapshot().custom).toHaveLength(1);
  expect(() => parseMotionLibrary('{bad')).toThrow();
  expect(() => b.saveMotionPreset('', { type: 'linear' })).toThrow();
});
it('存储失败不假称保存成功、不覆盖内存中的旧库', () => {
  const a = new MotionPresetLibrary({
      read: () => null,
      write: () => {
        throw new Error('满');
      },
    }),
    before = a.getSnapshot();
  expect(() => a.saveMotionPreset('曲线', { type: 'linear' })).toThrow('满');
  expect(a.getSnapshot()).toBe(before);
});
