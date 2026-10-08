// @vitest-environment jsdom
import { expect, it, vi, beforeEach } from 'vitest';
const fake = vi.hoisted(() => ({
  times: [] as number[],
  packets: [] as number[],
  supported: true,
  cancel: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock('../src/renderers/output-frame', () => ({
  OutputFrameRenderer: class {
    canvas = {};
    async init() {}
    draw(time: number) {
      fake.times.push(time);
    }
    dispose() {
      fake.dispose();
    }
  },
}));
vi.mock('mediabunny', () => ({
  canEncodeVideo: async () => fake.supported,
  Quality: class {},
  Mp4OutputFormat: class {},
  MovOutputFormat: class {},
  WebMOutputFormat: class {},
  BufferTarget: class {
    buffer = new ArrayBuffer(12);
  },
  CanvasSource: class {
    async add(time: number) {
      fake.packets.push(time);
    }
    close() {}
  },
  Output: class {
    addVideoTrack() {}
    async start() {}
    async finalize() {}
    async cancel() {
      fake.cancel();
    }
  },
}));
import { exportVideo } from '../src/renderers/video-export';
import {
  activeComposition,
  createDefaultProject,
} from '../src/core/project-model';
import { defaultOutputSettings } from '../src/core/output-settings';
const p = createDefaultProject(),
  c = activeComposition(p),
  settings = {
    ...defaultOutputSettings(c),
    width: 640,
    height: 360,
    format: 'mp4' as const,
    codec: 'avc' as const,
    bitrate: 12,
    bitrateMode: 'variable' as const,
    keyFrameInterval: 2,
  };
beforeEach(() => {
  fake.times = [];
  fake.packets = [];
  fake.supported = true;
  vi.clearAllMocks();
});
it('offline video renders every requested source time with zero-based monotonic output timestamps', async () => {
  const progress = vi.fn(),
    blob = await exportVideo(p, c.id, 1, 1.5, settings, progress);
  expect(blob.type).toBe('video/mp4');
  expect(fake.times).toHaveLength(15);
  expect(fake.times[0]).toBe(1);
  expect(fake.times.at(-1)).toBeCloseTo(1 + 14 / 30);
  expect(fake.packets).toEqual(Array.from({ length: 15 }, (_, i) => i / 30));
  expect(progress).toHaveBeenLastCalledWith(15, 15);
  expect(fake.dispose).toHaveBeenCalledOnce();
});
it('unsupported devices and invalid settings fail clearly before allocating a renderer', async () => {
  fake.supported = false;
  await expect(exportVideo(p, c.id, 0, 1, settings, vi.fn())).rejects.toThrow(
    '不支持',
  );
  await expect(
    exportVideo(p, c.id, 0, 1, { ...settings, width: 641 }, vi.fn()),
  ).rejects.toThrow('偶数');
  await expect(
    exportVideo(p, c.id, 0, 1, { ...settings, fps: 0 }, vi.fn()),
  ).rejects.toThrow('帧率');
  expect(fake.times).toHaveLength(0);
});
it('cancellation stops encoding, releases resources and never returns a partial media file', async () => {
  const controller = new AbortController();
  await expect(
    exportVideo(
      p,
      c.id,
      0,
      1,
      settings,
      () => controller.abort(),
      controller.signal,
    ),
  ).rejects.toThrow('取消');
  expect(fake.times).toHaveLength(1);
  expect(fake.cancel).toHaveBeenCalledOnce();
  expect(fake.dispose).toHaveBeenCalledOnce();
});
