import { expect, it } from 'vitest';
import { UserEffectLibrary } from '../src/core/effect-library';
import { EffectForgeWorkspace } from '../src/core/effect-forge';
import {
  organicTextureSource,
  organicTexturePackage,
} from '../src/core/effect-examples';
import { createGeneratorLayer } from '../src/core/generator-layer';
import {
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import { saveProject, loadProject } from '../src/core/project-io';
import { compileEffect, sealEffect } from '../src/core/programmable-effect';
import { duplicateGraphNodes } from '../src/core/compositing-operations';
function storage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}
it('persists exact versions without modifying embedded project packages', () => {
  const s = storage(),
    library = new UserEffectLibrary(s),
    p = organicTexturePackage();
  library.save(p);
  const project = createDefaultProject(),
    c = activeComposition(project),
    layer = createGeneratorLayer(c, p),
    next = { ...project, compositions: [{ ...c, layers: [layer] }] };
  const serialized = saveProject(next);
  library.save(
    sealEffect({ ...organicTextureSource(), version: '1.1.0', name: '新版本' }),
  );
  const loaded = loadProject(serialized),
    embedded = loaded.compositions[0]!.layers[0]!.editor!.graph!.nodes.find(
      (n) => n.effectPackage,
    )!.effectPackage!;
  expect(embedded.contentHash).toBe(p.contentHash);
  expect(new UserEffectLibrary(s).all()).toHaveLength(2);
  const ctx = { width: 8, height: 8, time: 1, frame: 30 };
  expect(compileEffect(embedded).render({}, ctx)).toEqual(
    compileEffect(p).render({}, ctx),
  );
  expect(() =>
    library.save(sealEffect({ ...organicTextureSource(), name: '静默替换' })),
  ).toThrow('版本');
  library.remove(p.contentHash);
  expect(new UserEffectLibrary(s).all()).toHaveLength(1);
  expect(compileEffect(embedded).render({}, ctx)).toHaveLength(256);
  const graph = layer.editor!.graph!,
    id = graph.nodes.find((n) => n.effectPackage)!.id;
  expect(duplicateGraphNodes(graph, [id]).ids).toHaveLength(1);
});
it('enforces draft validate compile preview evaluate accept and resets state after edits', () => {
  const w = new EffectForgeWorkspace(),
    d = w.create(organicTextureSource());
  expect(() => w.ready(d.id)).toThrow();
  w.validate(d.id);
  w.compile(d.id);
  const preview = w.preview(d.id, {}, 0);
  expect(preview.preview?.pixels.length).toBe(192 * 108 * 4);
  expect(() => w.accept(d.id)).toThrow();
  w.evaluate(d.id, '颜色和纹理符合要求');
  expect(w.accept(d.id).state).toBe('accepted');
  w.update(d.id, { ...organicTextureSource(), version: '1.0.1' });
  expect(w.get(d.id).preview).toBeUndefined();
  expect(() => w.ready(d.id)).toThrow();
  w.discard(d.id);
  expect(w.all()).toHaveLength(0);
});
it('never overwrites corrupt user libraries', () => {
  const s = storage();
  s.setItem('swayframe.effect-library.v1', 'broken');
  expect(() =>
    new UserEffectLibrary(s).save(organicTexturePackage()),
  ).toThrow();
  expect(s.getItem('swayframe.effect-library.v1')).toBe('broken');
});
