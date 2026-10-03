import { expect, it } from 'vitest';
import { mergePixels } from '../src/core/compositing-pixels';
import { createLayer } from '../src/core/project-model';
import { createNode } from '../src/core/compositing-registry';
import type { NodeBackend } from '../src/core/compositing-registry';
import {
  addGraphNode,
  connectPorts,
  disconnectEdge,
  patchGraphNode,
} from '../src/core/compositing-operations';
import { compileGraph, executeGraph } from '../src/core/compositing-compiler';
it('A 在 B 上，Mask 仅限制前景；覆盖/叠底/滤色/相加真实 RGBA 正确', () => {
  const a = new Uint8ClampedArray([255, 0, 0, 128]),
    b = new Uint8ClampedArray([0, 0, 255, 255]);
  expect([...mergePixels(a, b)]).toEqual([128, 0, 127, 255]);
  expect([...mergePixels(a, b, new Uint8ClampedArray(4))]).toEqual([...b]);
  const x = new Uint8ClampedArray([128, 128, 128, 255]);
  expect(mergePixels(x, x, undefined, 1, 1)[0]).toBe(64);
  expect(mergePixels(x, x, undefined, 1, 2)[0]).toBe(192);
  expect(mergePixels(x, x, undefined, 1, 3)[0]).toBe(255);
});
it('Source+Solid 多输入拓扑、遮罩与禁用 Merge 走背景旁路', () => {
  const l = createLayer('solid'),
    solid = createNode('solid'),
    merge = createNode('merge'),
    mask = createNode('mask');
  let g = l.editor!.graph!;
  const source = g.nodes[0]!;
  g = disconnectEdge(g, g.edges[0]!.id);
  for (const n of [solid, merge, mask]) g = addGraphNode(g, n);
  for (const [from, fp, to, tp] of [
    [solid.id, 'out', merge.id, 'a'],
    [source.id, 'out', merge.id, 'b'],
    [mask.id, 'mask', merge.id, 'mask'],
    [merge.id, 'out', g.outputNodeId, 'in'],
  ])
    g = connectPorts(
      g,
      { nodeId: from!, portId: fp! },
      { nodeId: to!, portId: tp! },
    );
  const backend: NodeBackend<number> = {
    source: () => 10,
    solid: () => 3,
    mask: () => 0.5,
    transparent: () => 0,
    effect: (x) => x,
    transform: (x) => x,
    merge: (a, b, m) => a * (m ?? 1) + b,
  };
  const plan = compileGraph(g);
  expect(plan.valid).toBe(true);
  expect(executeGraph(plan, 0, backend).output).toBe(11.5);
  expect(
    executeGraph(
      compileGraph(patchGraphNode(g, merge.id, { enabled: false })),
      0,
      backend,
    ).output,
  ).toBe(10);
});
