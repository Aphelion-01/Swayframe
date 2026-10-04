import type { Project } from './project-model';

/** Exact structural comparison with only GraphNode display fields and layer accent excluded.
 * Identity short-circuits unchanged branches. Called on committed revisions,
 * never on transient pointer previews. Unknown/new fields invalidate by default.
 */
export function sameVisualProject(before: Project, after: Project): boolean {
  function same(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (
      a === null ||
      b === null ||
      typeof a !== 'object' ||
      typeof b !== 'object'
    )
      return false;
    if (Array.isArray(a) || Array.isArray(b))
      return (
        Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((value, i) => same(value, b[i]))
      );
    const left = a as Record<string, unknown>,
      right = b as Record<string, unknown>;
    const node =
      'params' in left &&
      'inputs' in left &&
      'outputs' in left &&
      'enabled' in left;
    const layer = 'transform' in left && 'type' in left && 'width' in left;
    if (layer) {
      const visualUI = (record: Record<string, unknown>) => {
        const ui = record.ui;
        return ui && typeof ui === 'object'
          ? Object.fromEntries(
              Object.entries(ui).filter(([key]) => key !== 'accentColorId'),
            )
          : {};
      };
      if (!same(visualUI(left), visualUI(right))) return false;
    }
    const keys = (record: Record<string, unknown>) =>
      Object.keys(record).filter(
        (key) =>
          !(layer && key === 'ui') &&
          (!node || !['position', 'name', 'metadata'].includes(key)),
      );
    const first = keys(left),
      second = keys(right);
    return (
      first.length === second.length &&
      first.every(
        (key) => Object.hasOwn(right, key) && same(left[key], right[key]),
      )
    );
  }
  return same(before, after);
}
