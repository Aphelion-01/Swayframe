import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { canonicalJSON, contentHash } from '../src/core/content-hash';
import {
  organicTexturePackage,
  organicTextureSource,
} from '../src/core/effect-examples';
import {
  compileEffect,
  sealEffect,
  validateEffect,
} from '../src/core/programmable-effect';
import {
  createGraph,
  createProgrammableNode,
} from '../src/core/compositing-registry';
import { compileGraph, executeGraph } from '../src/core/compositing-compiler';
import { GraphExecutionCache } from '../src/core/compositing-cache';
import type { NodeBackend } from '../src/core/compositing-registry';
import { CanvasGraphBackend } from '../src/renderers/compositing-graph';
import { createLayer } from '../src/core/project-model';
import { trustEffect } from '../src/core/effect-trust';
it('rejects oversized Canvas effect execution before allocating or reading any pixels', () => {
  const pkg = organicTexturePackage();
  trustEffect(pkg.contentHash);
  // No document or Canvas context exists in this test. Budget rejection must precede either.
  const backend = new CanvasGraphBackend(
    {} as HTMLCanvasElement,
    createLayer('rectangle', { width: 8192, height: 8192 }),
    0,
  );
  expect(() =>
    backend.programmable(
      pkg,
      {},
      { width: 1, height: 1, time: 0, frame: 0 },
      {} as HTMLCanvasElement,
    ),
  ).toThrow('预算');
});
it('uses standard SHA256 canonical content hashing', () => {
  for (const v of ['abc', { b: 1, a: [2, '中文'] }, {}])
    expect(contentHash(v)).toBe(
      createHash('sha256').update(canonicalJSON(v)).digest('hex'),
    );
});
it('validates compiles and deterministically renders parameterized animated texture without recompilation', () => {
  const p = organicTexturePackage(),
    c = compileEffect(p),
    ctx = { width: 24, height: 24, time: 0, frame: 0 },
    first = c.render({}, ctx);
  expect(compileEffect(p)).toBe(c);
  expect(c.render({}, ctx)).toEqual(first);
  expect(c.render({}, { ...ctx, time: 1, frame: 30 })).not.toEqual(first);
  expect(c.render({ density: 25 }, ctx)).not.toEqual(first);
  expect(() => c.render({ seed: 1.5 }, ctx)).toThrow();
  expect(() => c.render({}, { ...ctx, width: 10000, height: 10000 })).toThrow(
    '预算',
  );
});
it('rejects malformed code, forward references, unknown bindings, modified hashes and executable JS', () => {
  const source = organicTextureSource();
  expect(() =>
    validateEffect({ ...organicTexturePackage(), name: 'modified' }),
  ).toThrow('哈希');
  expect(() =>
    sealEffect({
      ...source,
      program: {
        ...source.program,
        instructions: [{ op: 'add', args: [0, 1] }],
      },
    }),
  ).toThrow();
  expect(() =>
    sealEffect({
      ...source,
      program: {
        ...source.program,
        instructions: [{ op: 'parameter', parameter: 'missing' }],
      },
    }),
  ).toThrow('绑定');
  expect(() =>
    sealEffect({ ...source, runtime: 'javascript' } as never),
  ).toThrow();
});
it('keeps procedural time in graph cache keys and falls back on missing package', () => {
  const p = organicTexturePackage(),
    node = createProgrammableNode(p),
    g = createGraph(crypto.randomUUID()),
    out = g.nodes[1]!;
  const graph = {
    ...g,
    nodes: [...g.nodes, node],
    edges: [
      {
        id: crypto.randomUUID(),
        from: { nodeId: node.id, portId: 'out' },
        to: { nodeId: out.id, portId: 'in' },
      },
    ],
  };
  const cache = new GraphExecutionCache<Uint8ClampedArray>(64, 100000),
    backend = {
      source: () => new Uint8ClampedArray(0),
      transparent: () => new Uint8ClampedArray(0),
      programmable: (p, params, ctx) =>
        compileEffect(p).render(params, { ...ctx, width: 4, height: 4 }),
    } as NodeBackend<Uint8ClampedArray>;
  const plan = compileGraph(graph),
    a = executeGraph(plan, 0, backend, cache),
    b = executeGraph(plan, 1, backend, cache);
  expect(a.diagnostics).toEqual([]);
  expect(a.output).not.toEqual(b.output);
  const missing = compileGraph({
    ...graph,
    nodes: graph.nodes.map((n) =>
      n.id === node.id ? { ...n, effectPackage: undefined } : n,
    ),
  });
  expect(executeGraph(missing, 0, backend).diagnostics.length).toBeGreaterThan(
    0,
  );
});
it('returns actionable instruction diagnostics for model repair instead of accepting unsafe references', () => {
  const s = organicTextureSource();
  expect(() =>
    sealEffect({
      ...s,
      program: {
        instructions: [
          { op: 'constant', value: 1 },
          { op: 'multiply', args: [0] },
        ],
        rgba: [0, 0, 0, 0],
      },
    }),
  ).toThrow('multiply) 需要2个args');
  expect(() =>
    sealEffect({
      ...s,
      program: {
        instructions: [
          { op: 'constant', value: 1 },
          { op: 'sin', args: [1] },
        ],
        rgba: [0, 0, 0, 0],
      },
    }),
  ).toThrow('禁止自身或向后引用');
});
