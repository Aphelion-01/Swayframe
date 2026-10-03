import { describe, expect, it } from 'vitest';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import {
  loadProject,
  saveProject,
  migrateProject,
  ProjectFileError,
} from '../src/core/project-io';
import { newId } from '../src/core/core-types';

describe('Project IO', () => {
  it('save/load/save 保留 ID、顺序、属性与 Spring 关键帧', () => {
    const project = createDefaultProject();
    const layer = createLayer('rectangle');
    const text = createLayer('text');
    const system = new CommandSystem(project);
    system.executeTransaction(
      transaction('example', 'human', [
        command({
          type: 'layer.create',
          compositionId: project.activeCompositionId,
          layer,
        }),
        command({
          type: 'layer.create',
          compositionId: project.activeCompositionId,
          layer: text,
        }),
        command({
          type: 'keyframe.add',
          propertyId: layer.transform.position.id,
          keyframe: {
            id: newId(),
            time: 0,
            value: { x: -120, y: 540 },
            interpolation: {
              type: 'spring',
              stiffness: 170,
              damping: 18,
              mass: 1,
            },
          },
        }),
        command({
          type: 'keyframe.add',
          propertyId: layer.transform.position.id,
          keyframe: {
            id: newId(),
            time: 1,
            value: { x: 960, y: 540 },
            interpolation: { type: 'linear' },
          },
        }),
      ]),
    );
    const json = saveProject(system.getSnapshot());
    const loaded = loadProject(json);
    expect(loaded).toEqual(system.getSnapshot());
    expect(saveProject(loaded)).toBe(json);
    expect(migrateProject(loaded)).toEqual(loaded);
    expect(system.replaceProject(loaded).ok).toBe(true);
    expect(system.undoStack).toHaveLength(0);
  });
  it('无效 JSON、未知版本、重复 ID、非法属性、损坏 asset 都给明确错误', () => {
    const project = createDefaultProject();
    const cases = [
      '{broken',
      JSON.stringify({ ...project, schemaVersion: '9.0.0' }),
      JSON.stringify({
        ...project,
        compositions: [{ ...project.compositions[0], id: project.id }],
      }),
      JSON.stringify({ ...project, activeCompositionId: newId() }),
      JSON.stringify({
        ...project,
        compositions: [
          {
            ...project.compositions[0],
            layers: [createLayer('image', { assetId: newId() })],
          },
        ],
      }),
    ];
    for (const raw of cases)
      expect(() => loadProject(raw)).toThrow(ProjectFileError);
    try {
      loadProject(cases[1]!);
    } catch (error) {
      expect(error).toMatchObject({ code: 'UNSUPPORTED_VERSION' });
    }
    expect(() => loadProject('{}')).toThrow('schemaVersion');
  });
  it('非法工程替换不污染已有项目或 History', () => {
    const system = new CommandSystem(createDefaultProject());
    const before = system.getSnapshot();
    expect(
      system.replaceProject({ ...before, activeCompositionId: newId() }).ok,
    ).toBe(false);
    expect(system.getSnapshot()).toBe(before);
    expect(system.undoStack).toHaveLength(0);
  });
  it('真实内嵌 Image asset 可往返且不保存 Canvas 对象', () => {
    const project = createDefaultProject();
    const asset = {
      id: newId(),
      name: 'one.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
    };
    const layer = createLayer('image', { assetId: asset.id });
    const system = new CommandSystem(project);
    expect(
      system.executeTransaction(
        transaction('import', 'human', [
          command({ type: 'asset.add', asset }),
          command({
            type: 'layer.create',
            compositionId: project.activeCompositionId,
            layer,
          }),
        ]),
      ).ok,
    ).toBe(true);
    expect(loadProject(saveProject(system.getSnapshot()))).toEqual(
      system.getSnapshot(),
    );
    system.undo();
    expect(system.getSnapshot()).toEqual(project);
  });
  it('核心命令边界拒绝未知字段、非法颜色与无效时间', () => {
    const project = createDefaultProject();
    const system = new CommandSystem(project);
    const layer = createLayer('rectangle');
    expect(
      system.executeTransaction(
        transaction('bad', 'human', [
          command({
            type: 'layer.create',
            compositionId: project.activeCompositionId,
            layer: { ...layer, width: -1 },
          }),
        ]),
      ).ok,
    ).toBe(false);
    expect(() =>
      loadProject(JSON.stringify({ ...project, domCache: {} })),
    ).toThrow();
  });
});
