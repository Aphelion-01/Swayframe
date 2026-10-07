import { useLayoutEffect, useRef } from 'react';
import type { EditorStore } from '../editor-store';
import type { CommandBinding } from './command-registry';
const scopes = new WeakMap<
  EditorStore,
  Map<object, () => readonly CommandBinding[]>
>();
/** Context owns instance targets; commands own execution, not feature metadata or shell. */
export function useCommandScope(
  store: EditorStore,
  bindings: readonly CommandBinding[] | (() => readonly CommandBinding[]),
) {
  const ref = useRef(bindings);
  ref.current = bindings;
  useLayoutEffect(() => {
    const key = {},
      entries = scopes.get(store) ?? new Map();
    entries.set(key, () =>
      typeof ref.current === 'function' ? ref.current() : ref.current,
    );
    scopes.set(store, entries);
    return () => {
      entries.delete(key);
    };
  }, [store]);
}
export function scopedCommands(
  store: EditorStore,
  focus: import('./shortcuts').FocusContext,
) {
  return [...(scopes.get(store)?.values() ?? [])]
    .flatMap((resolve) => resolve())
    .filter((b) => !b.contexts || b.contexts.includes(focus));
}
