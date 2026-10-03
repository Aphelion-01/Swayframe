// @vitest-environment jsdom
import { expect, it, vi, afterEach } from 'vitest';
import { Canvas2DRenderer } from '../src/renderers/canvas2d';
import { createLayer, createComposition } from '../src/core/project-model';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { isIdentityGraph } from '../src/core/compositing-compiler';
import { insertGraphNode } from '../src/core/compositing-operations';
afterEach(() => vi.restoreAllMocks());
it('默认 Source→Output 不分配离屏表面；不透明普通图层直接绘制', () => {
  const layer = createLayer('solid'),
    c = { ...createComposition(), layers: [layer] };
  expect(isIdentityGraph(layer.editor!.graph!)).toBe(true);
  expect(
    isIdentityGraph(insertGraphNode(layer.editor!.graph!, 'exposure').graph),
  ).toBe(false);
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    transform: vi.fn(),
  };
  const canvas = document.createElement('canvas');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  const create = vi.spyOn(document, 'createElement');
  const renderer = new Canvas2DRenderer();
  renderer.render(createRenderSnapshot(c, 0, []), canvas);
  expect(ctx.fillRect).toHaveBeenCalledTimes(2); // background and solid content
  expect(create).not.toHaveBeenCalled();
  renderer.dispose();
});
it('半透明与混合模式保留离屏组语义；错误图不能伪装成直通', () => {
  const layer = createLayer('solid');
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    transform: vi.fn(),
    translate: vi.fn(),
    drawImage: vi.fn(),
  };
  const canvas = document.createElement('canvas');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  const create = vi.spyOn(document, 'createElement');
  const renderer = new Canvas2DRenderer();
  const faded = {
    ...layer,
    transform: {
      ...layer.transform,
      opacity: { ...layer.transform.opacity, baseValue: 0.5 },
    },
  };
  renderer.render(
    createRenderSnapshot({ ...createComposition(), layers: [faded] }, 0, []),
    canvas,
  );
  expect(create).toHaveBeenCalledWith('canvas');
  expect(ctx.drawImage).toHaveBeenCalled();
  create.mockClear();
  const blended = {
    ...layer,
    editor: { ...layer.editor!, blendMode: 'multiply' as const },
  };
  renderer.render(
    createRenderSnapshot({ ...createComposition(), layers: [blended] }, 0, []),
    canvas,
  );
  expect(create).toHaveBeenCalledWith('canvas');
  expect(isIdentityGraph({ ...layer.editor!.graph!, edges: [] })).toBe(false);
  renderer.dispose();
});
