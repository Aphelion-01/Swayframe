import { expect, it } from 'vitest';
import { ProjectContextEngine } from '../src/agent/context-engine';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
it('budgets selected context, preserves exact selection/time and excludes asset bodies/paths and whole Project', () => {
  const base = createDefaultProject();
  const c = base.compositions[0]!;
  const layers = Array.from({ length: 100 }, (_, i) =>
    createLayer(i === 99 ? 'text' : 'rectangle', { name: 'Layer ' + i }),
  );
  const project = {
    ...base,
    compositions: [{ ...c, layers }],
    assets: [
      {
        id: crypto.randomUUID(),
        name: 'asset.png',
        mimeType: 'image/png',
        dataUrl: 'SECRET_IMAGE_DATA',
        source: {
          kind: 'linked' as const,
          path: '/private/USER_PATH',
          metadata: { width: 100, height: 100, size: 50, modifiedAt: 0 },
        },
      },
    ],
  };
  const engine = new ProjectContextEngine();
  const context = engine.build(
    {
      project,
      selection: [layers[99]!.id],
      time: 0.5,
      propertyId: layers[99]!.transform.position.id,
    },
    4000,
  );
  expect(JSON.stringify(context).length).toBeLessThanOrEqual(4000);
  expect(context.selection).toEqual([layers[99]!.id]);
  expect(context.currentPropertyId).toBe(layers[99]!.transform.position.id);
  expect(context.time).toBe(0.5);
  expect(context.truncated).toBe(true);
  expect(JSON.stringify(context)).not.toContain('SECRET_IMAGE_DATA');
  expect(JSON.stringify(context)).not.toContain('USER_PATH');
  expect(context.composition.layerCount).toBe(100);
});
it('caches frozen summaries and invalidates after actual command/Undo, while following selected parents', () => {
  const base = createDefaultProject();
  const c = base.compositions[0]!;
  const parent = createLayer('rectangle', { name: 'Parent' }),
    child = createLayer('text', { name: 'Child' });
  const layer = { ...child, editor: { ...child.editor!, parentId: parent.id } };
  const commands = new CommandSystem({
    ...base,
    compositions: [{ ...c, layers: [parent, layer] }],
  });
  const engine = new ProjectContextEngine();
  const current = commands.getSnapshot();
  expect(engine.summary(current)).toBe(engine.summary(current));
  const context = engine.build({
    project: current,
    selection: [layer.id],
    time: 0,
  });
  expect(context.dependencies[0]?.id).toBe(parent.id);
  expect(context.selected[0]?.name).toBe('Child');
  commands.executeTransaction(
    transaction('Rename', 'human', [
      command({
        type: 'layer.patch',
        compositionId: c.id,
        layerId: layer.id,
        patch: { name: 'New Child' },
      }),
    ]),
  );
  expect(engine.summary(commands.getSnapshot()).layers[1]?.name).toBe(
    'New Child',
  );
  commands.undo();
  expect(engine.summary(commands.getSnapshot()).layers[1]?.name).toBe('Child');
});
