import { expect, it, vi } from 'vitest';
import { createLayer } from '../src/core/project-model';
import {
  insertGraphNode,
  patchGraphNode,
} from '../src/core/compositing-operations';
import { GraphExecutionCache } from '../src/core/compositing-cache';
import { compileGraph, executeGraph } from '../src/core/compositing-compiler';
import { compositingSourceKey } from '../src/renderers/compositing-source-key';
import type { NodeBackend } from '../src/core/compositing-registry';
it('移动节点/改名不计算像素；参数仅使自身及下游失效，源变化全部失效', () => {
  const l = createLayer('solid'),
    a = insertGraphNode(l.editor!.graph!, 'exposure'),
    b = insertGraphNode(a.graph, 'gaussianBlur');
  const effect = vi.fn(
    (input: number, _kind: string, params: Readonly<Record<string, unknown>>) =>
      input + Number(params.radius ?? params.exposure ?? 0),
  );
  const backend: NodeBackend<number> = {
      source: () => 10,
      transparent: () => 0,
      effect,
      solid: () => 1,
      transform: (x) => x,
      mask: () => 1,
      merge: (a, b) => a + b,
    },
    cache = new GraphExecutionCache<number>();
  executeGraph(compileGraph(b.graph), 0, backend, cache, 'source-1');
  expect(effect).toHaveBeenCalledTimes(2);
  const moved = patchGraphNode(b.graph, b.node.id, {
    position: { x: 500, y: 100 },
    name: '新名称',
  });
  executeGraph(compileGraph(moved), 0, backend, cache, 'source-1');
  expect(effect).toHaveBeenCalledTimes(2);
  const changed = {
    ...moved,
    nodes: moved.nodes.map((n) =>
      n.id === b.node.id
        ? { ...n, params: { radius: { ...n.params.radius!, baseValue: 30 } } }
        : n,
    ),
  };
  executeGraph(compileGraph(changed), 0, backend, cache, 'source-1');
  expect(effect).toHaveBeenCalledTimes(3);
  executeGraph(compileGraph(changed), 0, backend, cache, 'source-2');
  expect(effect).toHaveBeenCalledTimes(5);
  expect(
    compositingSourceKey(
      { ...l, editor: { ...l.editor!, graph: moved } },
      0,
      1,
      128,
    ),
  ).toBe(
    compositingSourceKey(
      { ...l, editor: { ...l.editor!, graph: changed } },
      0,
      1,
      128,
    ),
  );
});
it('缓存共享表面只计一次容量，删除节点清理，超限逐出且保留渲染版本', () => {
  const cache = new GraphExecutionCache<Uint8Array>(2, 4, (v) => v.byteLength),
    shared = new Uint8Array(4);
  const revision = cache.revision('a', 'key');
  cache.put('a', 'key', shared);
  cache.put('b', 'key', shared);
  expect(cache.bytes).toBe(4);
  cache.put('c', 'key', new Uint8Array(4));
  expect(cache.count).toBe(1);
  expect(cache.revision('a', 'key')).toBe(revision);
  cache.retain(new Set(['c']));
  expect(cache.get('a', 'key')).toBeUndefined();
  cache.clear();
  expect(cache.bytes).toBe(0);
});
it('evaluator 故障恢复后下游重新求值，不读取失败回退的缓存', () => {
  const l = createLayer('solid'),
    a = insertGraphNode(l.editor!.graph!, 'exposure'),
    b = insertGraphNode(a.graph, 'gaussianBlur'),
    cache = new GraphExecutionCache<number>();
  let broken = true;
  const backend: NodeBackend<number> = {
    source: () => 5,
    transparent: () => 0,
    effect: (x, kind) => {
      if (kind === 'exposure' && broken) throw new Error('暂时故障');
      return x * 2;
    },
    solid: () => 1,
    transform: (x) => x,
    mask: () => 1,
    merge: (a, b) => a + b,
  };
  expect(
    executeGraph(compileGraph(b.graph), 0, backend, cache, '1').output,
  ).toBe(10);
  broken = false;
  expect(
    executeGraph(compileGraph(b.graph), 0, backend, cache, '1').output,
  ).toBe(20);
});
