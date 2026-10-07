import { features } from '../../shared/feature-catalog';
import type {
  ContributionPoint,
  FeatureRegistry,
  ContextValues,
} from '../../shared/feature-registry';
import { CommandRegistry } from './command-registry';
import { buildEditorActions } from './editor-actions';
import { contextKeys } from './context-keys';
import type { EditorStore } from '../editor-store';
import type { FocusContext } from './shortcuts';
import type { MenuItem } from './primitives';
export function editorCommands(
  store: EditorStore,
  ui: Partial<Record<string, () => void>> = {},
  focus: () => FocusContext = () => 'global',
) {
  return new CommandRegistry(() => buildEditorActions(store, ui, focus));
}
export function contributionItems(
  point: ContributionPoint,
  registry: CommandRegistry,
  context: ContextValues,
  featureRegistry: FeatureRegistry = features,
): MenuItem[] {
  return featureRegistry
    .contributions(point, context)
    .filter(
      (f) =>
        !f.parentId ||
        !featureRegistry
          .contributions(point, context)
          .some((parent) => parent.id === f.parentId),
    )
    .flatMap((f) => {
      const binding = registry.entry(f.commandId);
      if (!binding) return [];
      const children = featureRegistry
        .all()
        .filter((c) => c.parentId === f.id)
        .flatMap((c) => {
          const entry = registry.entry(c.commandId);
          return entry ? [{ ...entry, label: c.title }] : [];
        });
      return [
        {
          ...binding,
          label: f.id === 'toggle-3d' ? binding.label : f.title,
          shortcut: f.shortcut ?? binding.shortcut,
          ...(children.length ? { children } : {}),
        },
      ];
    });
}
export function editorContributions(
  store: EditorStore,
  point: ContributionPoint,
  focus: FocusContext = 'global',
) {
  return contributionItems(
    point,
    editorCommands(store, {}, () => focus),
    contextKeys(store.getSnapshot(), focus),
  );
}
