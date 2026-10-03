import type { EffectKind, Effect, Mask, Layer } from './project-model';
import { createProperty } from './project-model';
import { newId } from './core-types';
import { effectDefinitions } from './effect-definitions';
export { effectDefinitions } from './effect-definitions';
export function createEffect(kind: EffectKind): Effect {
  return {
    id: newId(),
    kind,
    enabled: true,
    parameters: Object.fromEntries(
      Object.entries(effectDefinitions[kind].parameters).map(([key, spec]) => [
        key,
        createProperty(spec.value),
      ]),
    ),
  };
}
export function createMask(layer: Layer, kind: Mask['kind']): Mask {
  const x = layer.width / 2,
    y = layer.height / 2;
  return {
    id: newId(),
    kind,
    mode: 'add',
    enabled: true,
    path: createProperty([
      -x,
      -y,
      -x,
      -y,
      -x,
      -y,
      x,
      -y,
      x,
      -y,
      x,
      -y,
      x,
      y,
      x,
      y,
      x,
      y,
      -x,
      y,
      -x,
      y,
      -x,
      y,
    ]),
    opacity: createProperty(1),
    feather: createProperty(0),
    expansion: createProperty(0),
  };
}
