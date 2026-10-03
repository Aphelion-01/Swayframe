import { it, expect } from 'vitest';
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import { loadProject, saveProject } from '../src/core/project-io';
import {
  command,
  CommandSystem,
  transaction,
} from '../src/core/command-system';
import { newId } from '../src/core/core-types';
it('migrates 0.3 without changing IDs or embedded assets and rejects newer version', () => {
  const p = createDefaultProject();
  expect(loadProject(JSON.stringify({ ...p, schemaVersion: '0.3.0' }))).toEqual(
    p,
  );
  expect(() => loadProject('{"schemaVersion":"99.0.0"}')).toThrow('更新版本');
});
it('linked references round-trip without binaries, relink keeps shared layer IDs and undoes once', () => {
  const p = createDefaultProject(),
    c = activeComposition(p),
    system = new CommandSystem(p);
  const asset = {
    id: newId(),
    name: '中文 🌙.png',
    mimeType: 'image/png',
    dataUrl: 'swayframe-asset://local/' + 'a'.repeat(64),
    source: {
      kind: 'linked' as const,
      path: '/tmp/中文 空格/🌙.png',
      metadata: { width: 100, height: 100, size: 1000, modifiedAt: 1 },
    },
  };
  const layers = [
    createLayer('image', { assetId: asset.id }),
    createLayer('image', { assetId: asset.id }),
  ];
  system.executeTransaction(
    transaction('import', 'human', [
      command({ type: 'asset.add', asset }),
      ...layers.map((layer) =>
        command({ type: 'layer.create', compositionId: c.id, layer }),
      ),
    ]),
  );
  const before = system.getSnapshot();
  const replacement = {
    ...asset,
    source: { ...asset.source, path: '/tmp/new.png' },
    dataUrl: 'swayframe-asset://local/' + 'b'.repeat(64),
  };
  system.executeTransaction(
    transaction('relink', 'human', [
      command({ type: 'asset.replace', asset: replacement }),
    ]),
  );
  expect(
    loadProject(saveProject(system.getSnapshot())).compositions[0]!.layers,
  ).toEqual(layers);
  expect(saveProject(system.getSnapshot())).not.toContain('base64');
  system.undo();
  expect(system.getSnapshot()).toEqual(before);
});
