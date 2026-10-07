// @vitest-environment jsdom
import { Profiler } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Timeline } from '../src/ui/Timeline';
import { EditorStore } from '../src/ui/editor-store';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { newId } from '../src/core/core-types';

it('100层/500与1000帧：连续scrub和200次拖动保持关键帧DOM，预览零Scene写入，释放一笔事务', () => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  const results = [];
  for (const keyCount of [500, 1000]) {
    localStorage.clear();
    const p = createDefaultProject();
    const layers = Array.from({ length: 100 }, (_, i) => {
      const l = createLayer('rectangle', { name: `压力测试 ${i}` });
      return {
        ...l,
        transform: {
          ...l.transform,
          position: {
            ...l.transform.position,
            keyframes: Array.from({ length: keyCount / 100 }, (_, k) => ({
              id: newId(),
              time: k / 2,
              value: { x: k * 10, y: i },
              interpolation: { type: 'linear' as const },
            })),
          },
        },
      };
    });
    const store = new EditorStore({
      ...p,
      compositions: p.compositions.map((c) => ({ ...c, duration: 5, layers })),
    });
    store.setPropertyFilter('animated');
    const durations: number[] = [];
    const start = performance.now();
    const rendered = render(
      <Profiler
        id="timeline"
        onRender={(_id, _phase, duration) => durations.push(duration)}
      >
        <Timeline store={store} />
      </Profiler>,
    );
    const mountMs = performance.now() - start,
      mountRenderMs = durations[0];
    const keys = [...document.querySelectorAll('[data-frame]')];
    expect(keys).toHaveLength(keyCount);
    const before = store.getSnapshot().project;
    durations.length = 0;
    for (let i = 0; i < 120; i++) act(() => store.setTime(0.101 + i / 60));
    const scrubRenders = [...durations];
    expect([...document.querySelectorAll('[data-frame]')]).toEqual(keys);
    const key = keys[0]!;
    vi.spyOn(key.parentElement!, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 28,
      x: 0,
      y: 0,
      right: 1000,
      bottom: 28,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(key, { button: 0, clientX: 0 });
    durations.length = 0;
    for (let i = 0; i < 200; i++)
      fireEvent.pointerMove(window, { clientX: 20 + i / 10 });
    const dragRenders = [...durations];
    expect(store.getSnapshot().project).toBe(before);
    expect(store.commands.undoStack).toHaveLength(0);
    fireEvent.pointerUp(window, { clientX: 40 });
    expect(store.commands.undoStack).toHaveLength(1);
    const metrics = (samples: number[]) => {
      const sorted = [...samples].sort((a, b) => a - b);
      return {
        commits: samples.length,
        meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
        p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      };
    };
    results.push({
      environment:
        'Vitest jsdom React Profiler; development build; excludes browser paint/Canvas',
      layers: 100,
      keyframes: keyCount,
      mountMs,
      mountRenderMs,
      scrub: metrics(scrubRenders),
      drag: metrics(dragRenders),
      keyframeDOMPreserved: true,
      previewSceneWrites: 0,
      dragUndoSteps: 1,
    });
    rendered.unmount();
    cleanup();
  }
  mkdirSync('outputs/timeline-ux', { recursive: true });
  writeFileSync(
    'outputs/timeline-ux/performance.json',
    JSON.stringify(results, null, 2),
  );
});
