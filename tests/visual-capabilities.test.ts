import { describe, it, expect } from 'vitest';
import {
  visualCapabilities,
  parameterError,
  VisualCapabilityRegistry,
} from '../src/core/visual-capabilities';
import { effectRegistry } from '../src/core/effect-registry';
import { nodeDefinition } from '../src/core/compositing-registry';
describe('Unified capability metadata', () => {
  it('preserves native generator and multi-input compositor contracts in the unified registry', () => {
    for (const id of ['solid', 'merge']) {
      const capability = visualCapabilities.get(id)!,
        node = nodeDefinition(id)!;
      expect(capability.inputs).toEqual(node.inputs);
      expect(capability.outputs).toEqual(node.outputs);
      expect(capability.parameters.map((p) => p.id)).toEqual(
        Object.keys(node.params),
      );
    }
    expect(visualCapabilities.get('merge')!.category).toBe('compositor');
    expect(visualCapabilities.get('merge')!.inputs).toHaveLength(3);
    expect(visualCapabilities.get('solid')!.category).toBe('generator');
    expect(visualCapabilities.get('solid')!.inputs).toHaveLength(0);
  });
  it('adapts the same native Gaussian Blur definition into Inspector and Graph', () => {
    const d = visualCapabilities.get('gaussianBlur')!;
    expect(d.category).toBe('filter');
    expect(d.inputs).toEqual(nodeDefinition(d.id)!.inputs);
    expect(effectRegistry.get(d.id)!.parameters.radius!.max).toBe(
      d.parameters[0]!.max,
    );
    expect(nodeDefinition(d.id)!.params.radius!.value).toBe(
      d.parameters[0]!.defaultValue,
    );
  });
  it('rejects duplicate versions and invalid typed defaults', () => {
    const r = new VisualCapabilityRegistry(),
      d = visualCapabilities.get('exposure')!;
    r.register(d);
    expect(() => r.register(d)).toThrow('重复');
    expect(
      parameterError(
        {
          id: 'enabled',
          name: '开关',
          type: 'boolean',
          defaultValue: 1,
          animatable: true,
        },
        0.5,
      ),
    ).toMatch('开/关');
    expect(
      parameterError(
        {
          id: 'stops',
          name: '色标',
          type: 'gradientStops',
          defaultValue: [],
          animatable: true,
        },
        [1, 1, 1, 1, 1, 0, 0, 0, 1, 1],
      ),
    ).toMatch('排序');
  });
});
