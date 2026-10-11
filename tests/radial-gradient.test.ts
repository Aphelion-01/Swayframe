import { describe, it, expect } from 'vitest';
import {
  gradientColor,
  radialDefaults,
  radialPixels,
} from '../src/core/radial-gradient';
import {
  createGraph,
  createNode,
  validateNode,
} from '../src/core/compositing-registry';
import { insertGraphNode } from '../src/core/compositing-operations';
import { compileGraph } from '../src/core/compositing-compiler';
describe('shared radial gradient', () => {
  it('renders white center blue edge deterministically and transforms center', () => {
    const p = radialDefaults(),
      pixels = radialPixels(101, 101, p);
    expect([
      ...pixels.slice((50 * 101 + 50) * 4, (50 * 101 + 50) * 4 + 4),
    ]).toEqual([255, 255, 255, 255]);
    expect([...pixels.slice(0, 4)]).toEqual([46, 107, 255, 255]);
    expect(radialPixels(101, 101, p)).toEqual(pixels);
    expect(
      radialPixels(101, 101, { ...p, center: { x: 0, y: 0 } }),
    ).not.toEqual(pixels);
  });
  it('uses premultiplied interpolation and validates variable stops', () => {
    expect(gradientColor([0, 1, 0, 0, 0, 1, 0, 0, 1, 1], 0.5)).toEqual([
      0, 0, 1, 0.5,
    ]);
    const node = createNode('radialGradient');
    const stops = node.params.stops!;
    expect(
      validateNode({
        ...node,
        params: {
          ...node.params,
          stops: {
            ...stops,
            baseValue: [0, 1, 1, 1, 1, 0.5, 1, 0, 0, 1, 1, 0, 0, 1, 1],
          },
        },
      }),
    ).toEqual([]);
    expect(
      validateNode({
        ...node,
        params: {
          ...node.params,
          stops: { ...stops, baseValue: [0.9, 1, 1, 1, 1, 0.1, 0, 0, 1, 1] },
        },
      }),
    ).not.toEqual([]);
  });
  it('connects generator output without input image and compiles one graph', () => {
    const inserted = insertGraphNode(createGraph('test'), 'radialGradient');
    const plan = compileGraph(inserted.graph);
    expect(plan.valid).toBe(true);
    expect(plan.nodes.map((n) => n.node.type)).toEqual([
      'radialGradient',
      'output',
    ]);
  });
});
