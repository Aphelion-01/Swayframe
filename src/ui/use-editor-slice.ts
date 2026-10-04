import { useMemo, useSyncExternalStore } from 'react';
import type { EditorStore, EditorView } from './editor-store';
/** Subscribe only to fields actually displayed by a panel. */
export function useEditorSlice<K extends keyof EditorView>(
  store: EditorStore,
  keys: readonly K[],
): Pick<EditorView, K> {
  const signature = keys.join('|');
  const getSnapshot = useMemo(() => {
    let previous: Pick<EditorView, K> | undefined;
    return () => {
      const view = store.getSnapshot();
      if (previous && keys.every((key) => previous![key] === view[key]))
        return previous;
      previous = Object.fromEntries(
        keys.map((key) => [key, view[key]]),
      ) as Pick<EditorView, K>;
      return previous;
    };
  }, [store, signature]);
  return useSyncExternalStore(store.subscribe, getSnapshot);
}
