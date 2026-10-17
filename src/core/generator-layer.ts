import { createLayer } from './project-model';
import type { Composition } from './project-model';
import { createProgrammableNode } from './compositing-registry';
import { insertGraphNode } from './compositing-operations';
import type { EffectPackage } from './programmable-effect';
export function createGeneratorLayer(
  composition: Composition,
  capability: string | EffectPackage,
) {
  const layer = createLayer('solid', {
    position: { x: composition.width / 2, y: composition.height / 2 },
  });
  const inserted = insertGraphNode(
    layer.editor!.graph!,
    typeof capability === 'string'
      ? capability
      : createProgrammableNode(capability),
  );
  return {
    ...layer,
    name: typeof capability === 'string' ? '径向渐变' : capability.name,
    width: composition.width,
    height: composition.height,
    editor: { ...layer.editor!, graph: inserted.graph },
  };
}
