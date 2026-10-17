import type { EditorStore } from './editor-store';
const choices = new WeakMap<EditorStore, 'legacy-v1' | 'core-v2'>();
export const agentRuntimeChoice = (store: EditorStore) =>
  choices.get(store) ?? 'legacy-v1';
export function chooseAgentRuntime(
  store: EditorStore,
  choice: 'legacy-v1' | 'core-v2',
) {
  choices.set(store, choice);
}
export function assertLegacyRuntime(store: EditorStore) {
  if (agentRuntimeChoice(store) !== 'legacy-v1')
    throw Error('当前工程已明确选择Agent Core V2；不会同时执行Legacy V1');
}
