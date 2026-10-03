import { expect, it } from 'vitest';
import { newId } from '../src/core/core-types';
import { createGraph, createNode } from '../src/core/compositing-registry';
import type { NodeBackend } from '../src/core/compositing-registry';
import { compileGraph, executeGraph } from '../src/core/compositing-compiler';
import {
  insertGraphNode,
  patchGraphNode,
} from '../src/core/compositing-operations';
const backend: NodeBackend<number> = {
  source: () => 4,
  transparent: () => 0,
  effect: (i, _k, p) => i * 2 ** Number(p.exposure ?? 0),
  solid: () => 1,
  transform: (i) => i,
  mask: () => 1,
  merge: (a, b) => a + b,
};
it('编译只遍历输出依赖，拓扑不依赖节点数组排列；参数统一按时间求值', () => {
  const base = createGraph(newId()),
    { graph, node } = insertGraphNode(base, 'exposure');
  const animated = {
    ...graph,
    nodes: [...graph.nodes, createNode('solid')]
      .map((n) =>
        n.id === node.id
          ? {
              ...n,
              params: {
                exposure: {
                  ...n.params.exposure!,
                  keyframes: [
                    {
                      id: newId(),
                      time: 0,
                      value: 0,
                      interpolation: { type: 'linear' as const },
                    },
                    {
                      id: newId(),
                      time: 1,
                      value: 2,
                      interpolation: { type: 'linear' as const },
                    },
                  ],
                },
              },
            }
          : n,
      )
      .reverse(),
  };
  const plan = compileGraph(animated);
  expect(plan.nodes.map((n) => n.node.type)).toEqual([
    'source',
    'exposure',
    'output',
  ]);
  expect(executeGraph(plan, 0.5, backend).output).toBe(8);
  expect(
    executeGraph(
      compileGraph(patchGraphNode(animated, node.id, { enabled: false })),
      1,
      backend,
    ).output,
  ).toBe(4);
});
it('无效图与节点 evaluator 失败可回退，断线形成诊断不会崩溃', () => {
  const { graph, node } = insertGraphNode(createGraph(newId()), 'exposure');
  const result = executeGraph(compileGraph(graph), 0, {
    ...backend,
    effect: () => {
      throw new Error('渲染故障');
    },
  });
  expect(result.output).toBe(4);
  expect(result.diagnostics[0]?.nodeId).toBe(node.id);
  expect(
    executeGraph(compileGraph({ ...graph, edges: [] }), 0, backend).diagnostics
      .length,
  ).toBeGreaterThan(0);
  const invalid = {
    ...graph,
    edges: [
      ...graph.edges,
      {
        id: newId(),
        from: { nodeId: node.id, portId: 'out' },
        to: { nodeId: node.id, portId: 'in' },
      },
    ],
  };
  expect(executeGraph(compileGraph(invalid), 0, backend).output).toBe(4);
});
