// @vitest-environment jsdom
import { expect, it, vi, afterEach } from 'vitest';
import { createLayer } from '../src/core/project-model';
import { CanvasGraphBackend } from '../src/renderers/compositing-graph';
import { compileGraph, executeGraph } from '../src/core/compositing-compiler';
import { insertGraphNode } from '../src/core/compositing-operations';
import { surface } from '../src/renderers/layer-compositing';
afterEach(() => vi.restoreAllMocks());
it('节点使用实际颜色像素处理，模糊传入 Canvas filter，变换复用局部矩阵', () => {
  const pixels = new Uint8ClampedArray([80, 20, 10, 128]),
    filters: string[] = [],
    matrix: number[][] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        drawImage: vi.fn(),
        getImageData: () => ({ data: pixels }),
        putImageData: vi.fn(),
        translate: vi.fn(),
        transform: (...args: number[]) => matrix.push(args),
        set filter(v: string) {
          filters.push(v);
        },
      }) as unknown as CanvasRenderingContext2D,
  );
  const layer = createLayer('solid'),
    source = surface(1, 1),
    backend = new CanvasGraphBackend(source, layer, 0);
  const { graph, node } = insertGraphNode(layer.editor!.graph!, 'exposure');
  const g = {
    ...graph,
    nodes: graph.nodes.map((n) =>
      n.id === node.id
        ? {
            ...n,
            params: { exposure: { ...n.params.exposure!, baseValue: 1 } },
          }
        : n,
    ),
  };
  executeGraph(compileGraph(g), 0, backend);
  expect([...pixels]).toEqual([160, 40, 20, 128]);
  backend.effect(source, 'gaussianBlur', { radius: 30 });
  expect(filters).toContain('blur(30px)');
  backend.transform(source, {
    position: { x: 10, y: 20 },
    scale: { x: 2, y: 3 },
    rotation: 0,
    anchor: { x: 0, y: 0 },
  });
  expect(matrix[0]).toEqual([2, 0, -0, 3, 10, 20]);
});
