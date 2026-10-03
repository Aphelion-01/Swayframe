import { describe, expect, it } from 'vitest';
import {
  createDefaultProject,
  createLayer,
  createComposition,
} from '../src/core/project-model';

describe('Project Model', () => {
  it('创建任务书规定的合成并持久化稳定 ID', () => {
    const project = createDefaultProject();
    expect(project.schemaVersion).toBe('0.5.0');
    expect(project.compositions[0]).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 5,
    });
    expect(project.activeCompositionId).toBe(project.compositions[0]?.id);
    expect(JSON.parse(JSON.stringify(project))).toEqual(project);
    expect(createDefaultProject().id).not.toBe(project.id);
  });
  it('四类图层具有统一 Transform 与不同的稳定 Property ID', () => {
    const layers = ['rectangle', 'ellipse', 'text', 'image'].map((kind) =>
      createLayer(kind as 'rectangle' | 'ellipse' | 'text' | 'image', {
        assetId: crypto.randomUUID(),
      }),
    );
    const ids = layers.flatMap((layer) => [
      layer.id,
      ...Object.values(layer.transform).map((p) => p.id),
    ]);
    expect(new Set(ids).size).toBe(20);
    for (const layer of layers)
      expect(layer.transform.opacity.baseValue).toBe(1);
  });
  it('拒绝无效合成及没有 assetId 的 Image', () => {
    expect(() => createComposition({ width: 0 })).toThrow();
    expect(() => createComposition({ fps: Infinity })).toThrow();
    expect(() => createLayer('image')).toThrow('素材编号');
  });
});
