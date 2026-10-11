// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { previewEffectScale } from '../src/renderers/preview-quality';
import { CanvasGraphBackend } from '../src/renderers/compositing-graph';
import { createProgrammableNode } from '../src/core/compositing-registry';
import { GraphExecutionCache } from '../src/core/compositing-cache';
import { organicTexturePackage } from '../src/core/effect-examples';
import { insertGraphNode } from '../src/core/compositing-operations';
import { createLayer, createComposition } from '../src/core/project-model';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { compileEffect, sealEffect } from '../src/core/programmable-effect';
import { trustEffect } from '../src/core/effect-trust';
import { renderCompositingGraph } from '../src/renderers/compositing-graph';
afterEach(() => vi.restoreAllMocks());
const pkg = organicTexturePackage();
function layer() {
  const l = createLayer('rectangle', { width: 1920, height: 1080 });
  return {
    ...l,
    editor: {
      ...l.editor!,
      graph: insertGraphNode(l.editor!.graph!, createProgrammableNode(pkg))
        .graph,
    },
  };
}
it('bounds interactive work, restores full quality when stopped, leaves ordinary scenes full quality', () => {
  const c = { ...createComposition(), layers: [layer()] };
  const snapshot = createRenderSnapshot(c, 0, []);
  expect(previewEffectScale(snapshot, true)).toBe(0.25);
  expect(previewEffectScale(snapshot, false)).toBe(1);
  expect(
    previewEffectScale(
      createRenderSnapshot({ ...c, layers: [createLayer('rectangle')] }, 0, []),
      true,
    ),
  ).toBe(1);
  expect(
    previewEffectScale(
      createRenderSnapshot(
        { ...c, layers: Array.from({ length: 4 }, layer) },
        0,
        [],
      ),
      true,
    ),
  ).toBe(0.125);
});
it('keeps logical width/height/aspect uniforms stable under sampling', () => {
  const { contentHash: _hash, ...source } = pkg;
  void _hash;
  const p = sealEffect({
    ...source,
    id: 'logicalDimensions',
    program: {
      instructions: [
        { op: 'width' },
        { op: 'height' },
        { op: 'divide', args: [0, 1] },
        { op: 'constant', value: 0.25 },
        { op: 'multiply', args: [2, 3] },
        { op: 'constant', value: 1 },
      ],
      rgba: [4, 4, 4, 5],
    },
  });
  const c = compileEffect(p);
  expect(
    c.render(
      {},
      {
        width: 2,
        height: 2,
        logicalWidth: 1920,
        logicalHeight: 1080,
        time: 0,
        frame: 0,
      },
    )[0],
  ).toBe(113);
  expect(() =>
    c.render({}, { width: 2, height: 2, logicalWidth: NaN, time: 0, frame: 0 }),
  ).toThrow();
});
it('isolates reduced samples from full graph cache, and retains full-size budget checks', () => {
  trustEffect(pkg.contentHash);
  const sizes: number[][] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement) {
      return {
        drawImage: vi.fn(),
        createImageData: (w: number, h: number) => {
          sizes.push([w, h]);
          return { data: new Uint8ClampedArray(w * h * 4) };
        },
        putImageData: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
    },
  );
  const l = layer(),
    source = document.createElement('canvas');
  source.width = 1920;
  source.height = 1080;
  const cache = new GraphExecutionCache<HTMLCanvasElement>();
  renderCompositingGraph(source, l, 0, 0, cache, 'source', 30, 0.25);
  renderCompositingGraph(source, l, 0, 0, cache, 'source', 30, 1);
  expect(sizes).toContainEqual([480, 270]);
  expect(sizes).toContainEqual([1920, 1080]);
  const over = new CanvasGraphBackend(
    {} as HTMLCanvasElement,
    { ...l, width: 8192, height: 8192 },
    0,
    30,
    1 / 16,
  );
  expect(() =>
    over.programmable(pkg, {}, { width: 1, height: 1, time: 0, frame: 0 }),
  ).toThrow('预算');
});
