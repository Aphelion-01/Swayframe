// @vitest-environment jsdom
import { expect, it, vi, afterEach } from 'vitest';
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import { command } from '../src/core/command-system';
import { EditorStore } from '../src/ui/editor-store';
import { Canvas2DRenderer } from '../src/renderers/canvas2d';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { exportCurrentFrame } from '../src/renderers/png-export';
afterEach(() => vi.restoreAllMocks());
it('FLOW-06 Export Frame与Preview共用真实Renderer：起始/中间/结束同时间绘制调用一致', async () => {
  const store = new EditorStore(createDefaultProject()),
    layer = createLayer('solid', {
      width: 100,
      height: 80,
      position: { x: 200, y: 540 },
    });
  store.run('创建', [
    command({
      type: 'layer.create',
      compositionId: store.getSnapshot().project.activeCompositionId,
      layer,
    }),
  ]);
  store.togglePropertyAnimation(layer.transform.position.id);
  store.setTime(1);
  store.run('动画', [
    store.valueCommand(layer.transform.position.id, { x: 960, y: 540 }),
  ]);
  const calls: unknown[][] = [];
  const context = {
    clearRect: (...args: unknown[]) => calls.push(['clearRect', ...args]),
    fillRect: (...args: unknown[]) => calls.push(['fillRect', ...args]),
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    transform: (...args: unknown[]) => calls.push(['transform', ...args]),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    (callback) =>
      callback(new Blob([JSON.stringify(calls)], { type: 'image/png' })),
  );
  const project = store.getSnapshot().project,
    c = activeComposition(project),
    renderer = new Canvas2DRenderer();
  for (const time of [0, 0.5, 1]) {
    calls.length = 0;
    renderer.render(
      createRenderSnapshot(c, time, [], undefined, project),
      document.createElement('canvas'),
      1,
      false,
    );
    const expected = JSON.stringify(calls);
    calls.length = 0;
    const blob = await exportCurrentFrame(project, c.id, time);
    const actual = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(blob);
    });
    expect(actual).toBe(expected);
  }
  renderer.dispose();
});
