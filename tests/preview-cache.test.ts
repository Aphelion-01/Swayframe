// @vitest-environment jsdom
import { expect, it, vi, afterEach } from 'vitest';
import { PreviewFrameCache } from '../src/ui/preview-frame-cache';
import { createDefaultProject } from '../src/core/project-model';
afterEach(() => vi.restoreAllMocks());
it('bitmap cache retains real rendered frames only, evicts by recency and invalidates on scene changes', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  const cache = new PreviewFrameCache(),
    project = createDefaultProject(),
    source = document.createElement('canvas');
  source.width = 100;
  source.height = 100;
  cache.prepare(project);
  for (let i = 0; i < 16; i++) cache.put(String(i), i / 30, source);
  cache.get('0');
  cache.put('16', 16 / 30, source);
  expect(cache.get('1')).toBeUndefined();
  expect(cache.get('0')).toBeDefined();
  expect(cache.times()).toHaveLength(16);
  cache.prepare(project);
  expect(cache.times()).toHaveLength(16);
  cache.prepare({ ...project });
  expect(cache.times()).toEqual([]);
});
it('memory budget rejects an oversized frame and missing canvas context never reports a cached frame', () => {
  const cache = new PreviewFrameCache(),
    source = document.createElement('canvas');
  source.width = 8192;
  source.height = 8192;
  cache.put('big', 0, source);
  expect(cache.times()).toEqual([]);
  source.width = 100;
  source.height = 100;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  cache.put('missing', 0, source);
  expect(cache.times()).toEqual([]);
});
