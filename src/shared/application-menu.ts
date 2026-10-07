import { features, menuPoints } from './feature-catalog';
import type { ApplicationActionId as SeedActionId } from './application-menu-seed';
export type ApplicationActionId = SeedActionId;
/** Native and renderer menus consume the same local feature contributions. */
export const applicationMenus = Object.entries(menuPoints).map(
  ([label, point]) => ({
    label,
    items: features
      .all()
      .filter(
        (f) =>
          !f.parentId &&
          (f.placement.canonical === point ||
            f.placement.secondary?.includes(point)),
      )
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
      .map(
        (f) =>
          [
            f.commandId as ApplicationActionId,
            f.title,
            ...(f.shortcut ? [f.shortcut] : []),
          ] as [ApplicationActionId, string, ...string[]],
      ),
  }),
);
export function menuChildren(id: string) {
  return features
    .all()
    .filter((f) => f.parentId === id)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}
