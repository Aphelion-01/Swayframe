// @vitest-environment jsdom
import { expect, it } from 'vitest';
import {
  FeatureRegistry,
  type FeatureDefinition,
} from '../src/shared/feature-registry';
import { features } from '../src/shared/feature-catalog';
import { CommandRegistry } from '../src/ui/workspace/command-registry';
import {
  contributionItems,
  editorCommands,
} from '../src/ui/workspace/feature-contributions';
import { EffectRegistry } from '../src/core/effect-registry';
import { GraphNodeRegistry } from '../src/core/compositing-registry';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import { newId } from '../src/core/core-types';
import { motionSegments } from '../src/core/motion-curve';

const mockFeature = (
  id: string,
  domain: FeatureDefinition['domain'],
  canonical: FeatureDefinition['placement']['canonical'],
): FeatureDefinition => ({
  id,
  commandId: id,
  title: id,
  description: `模拟扩展 ${id}`,
  domain,
  objectTypes: ['Layer'],
  tasks: ['Process'],
  frequency: 'F4',
  contexts: ['LayerSelection'],
  placement: { canonical },
  when: ['hasLayerSelection'],
  keywords: ['future'],
});
it('205 future capabilities stay searchable/contextual without adding permanent controls; registry contributions execute without Shell edits', () => {
  const registry = new FeatureRegistry();
  features.all().forEach((f) => registry.register(f));
  const before = ['toolbar.global', 'toolbar.canvas', 'timeline.header'].map(
    (p) =>
      registry
        .all()
        .filter((f) =>
          [f.placement.canonical, ...(f.placement.secondary ?? [])].includes(
            p as never,
          ),
        ).length,
  );
  const future = [
    ...Array.from({ length: 100 }, (_, i) =>
      mockFeature(`effect-future-${i}`, 'INSPECTOR', 'panel.inspector.effects'),
    ),
    ...Array.from({ length: 50 }, (_, i) =>
      mockFeature(`node-future-${i}`, 'COMPOSITING', 'context.node'),
    ),
    ...Array.from({ length: 20 }, (_, i) =>
      mockFeature(`motion-future-${i}`, 'MOTION', 'commandPalette'),
    ),
    ...Array.from({ length: 20 }, (_, i) =>
      mockFeature(`ai-future-${i}`, 'ASSISTANT', 'assistant.actions'),
    ),
    ...Array.from({ length: 15 }, (_, i) =>
      mockFeature(`spatial-future-${i}`, 'CANVAS', 'commandPalette'),
    ),
  ];
  future.forEach((f) => registry.register(f));
  expect(
    registry
      .search('future', { LayerSelection: true, hasLayerSelection: true })
      .filter((f) => future.some((x) => x.id === f.id)),
  ).toHaveLength(205);
  registry.validatePermanentBudgets();
  expect(
    ['toolbar.global', 'toolbar.canvas', 'timeline.header'].map(
      (p) =>
        registry
          .all()
          .filter((f) =>
            [f.placement.canonical, ...(f.placement.secondary ?? [])].includes(
              p as never,
            ),
          ).length,
    ),
  ).toEqual(before);
  let executed = '';
  const commands = new CommandRegistry(() =>
    future.map((f) => ({
      id: f.id,
      label: f.title,
      action: () => {
        executed = f.id;
      },
    })),
  );
  expect(
    contributionItems(
      'assistant.actions',
      commands,
      { hasLayerSelection: false },
      registry,
    ),
  ).toEqual([]);
  const entries = contributionItems(
    'assistant.actions',
    commands,
    { hasLayerSelection: true },
    registry,
  );
  expect(entries).toHaveLength(20);
  entries[0]!.action();
  expect(executed).toBe('ai-future-0');
  expect(() =>
    registry.register({
      ...mockFeature('rare-permanent', 'APPLICATION', 'menu.file'),
      placement: { canonical: 'menu.file', secondary: ['toolbar.global'] },
    }),
  ).toThrow('低频');
  registry.register({
    ...mockFeature('extra-permanent', 'APPLICATION', 'toolbar.global'),
    frequency: 'F2',
  });
  expect(() => registry.validatePermanentBudgets()).toThrow('预算');
});
it('100 effects and 50 nodes register parameters/renderers/search without extending menus', () => {
  const effects = new EffectRegistry(),
    nodes = new GraphNodeRegistry();
  for (let i = 0; i < 100; i++)
    effects.register({
      id: `chromatic-${i}`,
      name: `色差 ${i}`,
      category: 'Distort',
      parameters: { amount: { label: '强度', value: 1, min: 0, max: 10 } },
      supportedLayerTypes: ['shape'],
      keywords: ['chromatic'],
      icon: 'node',
      render: (_backend, input) => input,
    });
  for (let i = 0; i < 50; i++)
    nodes.register({
      type: `optical-${i}`,
      title: `光流 ${i}`,
      category: '工具',
      inputs: [],
      outputs: [],
      params: {},
      icon: 'node',
      searchKeywords: ['optical flow'],
      evaluate: ({ backend }) => backend.transparent(),
    });
  expect(effects.search('chromatic', 'shape')).toHaveLength(100);
  expect(effects.search('chromatic', 'camera')).toHaveLength(0);
  expect(nodes.search('optical flow')).toHaveLength(50);
  expect(
    effects
      .get('chromatic-0')!
      .render({ effect: (input) => input }, 'frame', {}),
  ).toBe('frame');
  expect(() => effects.register(effects.get('chromatic-0')!)).toThrow('重复');
  expect(() => nodes.register(nodes.get('optical-0')!)).toThrow('已注册');
});
it('fresh menu entries and palette command share one transaction and undo; stale selection cannot edit a removed target', () => {
  const store = new EditorStore(createDefaultProject()),
    commands = editorCommands(store);
  commands.execute('create-rectangle');
  const layer = activeComposition(store.getSnapshot().project).layers[0]!;
  store.select(layer.id);
  const before = store.getSnapshot().project;
  const entry = commands.entry('duplicate')!;
  entry.action();
  expect(activeComposition(store.getSnapshot().project).layers).toHaveLength(2);
  commands.execute('undo');
  expect(store.getSnapshot().project).toEqual(before);
  store.select(null);
  const cleared = store.getSnapshot().project;
  entry.action();
  expect(store.getSnapshot().project).toEqual(cleared);
});
it('single keyframe easing copy/paste uses its adjacent interval and remains undoable', () => {
  const project = createDefaultProject(),
    raw = createLayer('rectangle');
  const property = {
    ...raw.transform.position,
    keyframes: [0, 1, 2].map((time) => ({
      id: newId(),
      time,
      value: { x: time * 100, y: 0 },
      interpolation: { type: 'linear' as const },
    })),
  };
  const layer = { ...raw, transform: { ...raw.transform, position: property } };
  const store = new EditorStore({
    ...project,
    compositions: project.compositions.map((c) => ({ ...c, layers: [layer] })),
  });
  store.select(layer.id);
  store.selectFrames([
    { propertyId: property.id, keyframeId: property.keyframes[0]!.id },
  ]);
  const commands = editorCommands(store);
  commands.execute('ease-out');
  commands.execute('copy-easing');
  const curve = store.motionCurveClipboard.read();
  expect(curve?.type).toBe('cubic-bezier');
  store.selectFrames([
    { propertyId: property.id, keyframeId: property.keyframes[1]!.id },
  ]);
  const before = store.getSnapshot().project;
  expect(commands.execute('paste-easing')).toBe(true);
  const current = activeComposition(store.getSnapshot().project).layers[0]!
    .transform.position;
  expect(motionSegments(current)[1]!.curve).toEqual(curve);
  commands.execute('undo');
  expect(store.getSnapshot().project).toEqual(before);
});
