import type { Project, Property } from './project-model';
import { findProperty } from './project-model';
import type { AnimValue } from './core-types';
/** Copy only the property container path; keep unrelated layers/assets by reference. */
function atPath(
  value: unknown,
  path: readonly string[],
  replacement: unknown,
): unknown {
  if (!path.length) return replacement;
  const key = path[0]!,
    rest = path.slice(1);
  if (Array.isArray(value)) {
    const copy = [...value];
    copy[Number(key)] = atPath(copy[Number(key)], rest, replacement);
    return copy;
  }
  const object = value as Record<string, unknown>;
  return { ...object, [key]: atPath(object[key], rest, replacement) };
}
export function projectWithPropertyPreviews(
  project: Project,
  properties: readonly Property<AnimValue>[],
): Project {
  let result = project;
  for (const property of properties) {
    const location = findProperty(project, property.id);
    result = {
      ...result,
      compositions: result.compositions.map((c) =>
        c.id === location.composition.id
          ? {
              ...c,
              layers: c.layers.map((l) =>
                l.id === location.layer.id
                  ? (atPath(l, location.key.split('.'), property) as typeof l)
                  : l,
              ),
            }
          : c,
      ),
    };
  }
  return result;
}
