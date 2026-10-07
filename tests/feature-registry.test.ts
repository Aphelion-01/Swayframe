import { describe, expect, it } from 'vitest';
import {
  FeatureRegistry,
  type FeatureDefinition,
} from '../src/shared/feature-registry';
import { features } from '../src/shared/feature-catalog';
import { contextKeys } from '../src/ui/workspace/context-keys';
import { createDefaultProject } from '../src/core/project-model';
import { EditorStore } from '../src/ui/editor-store';
import {
  editorCommands,
  editorContributions,
} from '../src/ui/workspace/feature-contributions';
import { applicationMenus } from '../src/shared/application-menu';
const definition: FeatureDefinition = {
  id: 'test',
  title: '测试',
  description: '测试功能',
  domain: 'SCENE',
  objectTypes: ['Layer'],
  tasks: ['Organize'],
  frequency: 'F3',
  contexts: ['LayerSelection'],
  commandId: 'test',
  placement: { canonical: 'context.layer' },
  when: ['hasLayerSelection'],
};
describe('feature placement contract', () => {
  it('rejects duplicate IDs, unknown placement, missing metadata, classification and low-frequency permanent UI', () => {
    const r = new FeatureRegistry();
    r.register(definition);
    expect(() => r.register(definition)).toThrow('重复');
    for (const patch of [
      { domain: 'OTHER' },
      { commandId: '' },
      { when: ['unknown'] },
      { contexts: [] },
      { placement: { canonical: 'unknown' } },
      {
        placement: { canonical: 'context.layer', secondary: ['context.layer'] },
      },
      { frequency: 'F5', placement: { canonical: 'toolbar.global' } },
    ])
      expect(() =>
        new FeatureRegistry().register({
          ...definition,
          ...patch,
        } as FeatureDefinition),
      ).toThrow();
    expect(() => r.validateCommands(new Set())).toThrow('未绑定');
  });
  it('derives contexts from real selection and hides irrelevant keyframe contributions', () => {
    const store = new EditorStore(createDefaultProject());
    const before = contextKeys(store.getSnapshot());
    expect(before.hasLayerSelection).toBe(false);
    expect(
      features
        .contributions('context.keyframe', before)
        .some((f) => f.id === 'ease-out'),
    ).toBe(false);
    expect(editorContributions(store, 'context.layer')).toEqual([]);
  });
  it('all actionable features bind to commands and aliases search by task/domain/object', () => {
    const store = new EditorStore(createDefaultProject());
    const ui = Object.fromEntries(
      applicationMenus.flatMap((g) =>
        g.items
          .filter(([id]) =>
            [
              'create-image',
              'new',
              'open',
              'save',
              'save-as',
              'new-composition',
              'composition-settings',
              'import',
              'export',
              'settings',
              'help',
              'shortcuts',
              'palette',
              'about',
            ].includes(id),
          )
          .map(([id]) => [id, () => {}]),
      ),
    );
    const commands = editorCommands(store, { ...ui, 'create-image': () => {} });
    features.validateCommands(new Set(commands.definitions().map((c) => c.id)));
    for (const [query, id] of [
      ['blur', 'effect-gaussianBlur'],
      ['parent', 'parent-select'],
      ['nest', 'precompose'],
      ['speed', 'graph'],
      ['curve', 'motion-curve'],
    ])
      expect(
        features.search(query!, { Global: true }).some((f) => f.id === id),
      ).toBe(true);
  });
});
