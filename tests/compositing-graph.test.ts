import { expect, it } from 'vitest';
import { newId } from '../src/core/core-types';
import { connectGraph, validateGraph } from '../src/core/compositing-graph';
import type {
  CompositingGraph,
  GraphNode,
} from '../src/core/compositing-graph';
function fixture(): CompositingGraph {
  const source: GraphNode = {
    id: newId(),
    type: 'source',
    name: '源',
    position: { x: 0, y: 0 },
    inputs: [],
    outputs: [{ id: 'image', name: '图像', type: 'Image' }],
    params: {},
    enabled: true,
  };
  const output: GraphNode = {
    ...source,
    id: newId(),
    type: 'output',
    inputs: [{ id: 'image', name: '图像', type: 'Image', required: true }],
    outputs: [],
  };
  const pass: GraphNode = {
    ...source,
    id: newId(),
    type: 'passthrough',
    inputs: [{ id: 'in', name: '图像', type: 'Image', required: true }],
  };
  return {
    id: newId(),
    version: 1,
    owner: { type: 'layer', id: newId() },
    nodes: [source, pass, output],
    edges: [],
    outputNodeId: output.id,
  };
}
it('连接校验方向、类型、容量、自连、环与必需输入', () => {
  let g = fixture();
  const [s, p, o] = g.nodes;
  const edge = (from: string, fp: string, to: string, tp: string) => ({
    id: newId(),
    from: { nodeId: from, portId: fp },
    to: { nodeId: to, portId: tp },
  });
  expect(validateGraph(g)).toEqual([]);
  expect(validateGraph(g, true).length).toBe(2);
  g = connectGraph(g, edge(s!.id, 'image', p!.id, 'in'));
  expect(() => connectGraph(g, edge(s!.id, 'image', p!.id, 'in'))).toThrow(
    '一个',
  );
  expect(() => connectGraph(g, edge(p!.id, 'image', p!.id, 'in'))).toThrow(
    '自连接',
  );
  expect(() => connectGraph(g, edge(o!.id, 'image', s!.id, 'image'))).toThrow(
    '方向',
  );
  expect(() =>
    connectGraph(
      {
        ...g,
        nodes: g.nodes.map((n) =>
          n.id === o!.id
            ? { ...n, inputs: [{ id: 'image', name: '遮罩', type: 'Mask' }] }
            : n,
        ),
      },
      edge(p!.id, 'image', o!.id, 'image'),
    ),
  ).toThrow('类型');
  const p2 = { ...p!, id: newId() };
  g = { ...g, nodes: [...g.nodes, p2] };
  g = connectGraph(g, edge(p!.id, 'image', p2.id, 'in'));
  expect(() =>
    connectGraph({ ...g, edges: [] }, edge(p!.id, 'image', p2.id, 'in')),
  ).not.toThrow();
  expect(() =>
    connectGraph(
      { ...g, edges: g.edges.slice(1) },
      edge(p2.id, 'image', p!.id, 'in'),
    ),
  ).toThrow('循环');
});

import {
  createGraph,
  createNode,
  nodeDefinitions,
  registerNode,
  validateNode,
} from '../src/core/compositing-registry';
it('注册表提供所有可执行节点、标准属性与受保护起点终点', () => {
  const g = createGraph(newId());
  expect(validateGraph(g, true)).toEqual([]);
  for (const def of nodeDefinitions())
    expect(validateNode(createNode(def.type))).toEqual([]);
  const blur = createNode('gaussianBlur');
  expect(blur.params.radius?.keyframes).toEqual([]);
  expect(
    validateNode({
      ...blur,
      params: { radius: { ...blur.params.radius!, baseValue: -1 } },
    }),
  ).toContain('节点参数无效：radius');
  expect(() => createNode('unknown')).toThrow('未知');
  const pass = nodeDefinitions().find((d) => d.type === 'passthrough')!;
  registerNode({ ...pass, type: 'test-extension', title: '测试扩展' });
  expect(createNode('test-extension').name).toBe('测试扩展');
});
