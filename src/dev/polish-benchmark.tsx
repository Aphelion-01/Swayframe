/** Opt-in development page; never imported by the editor entry point. */
import { Profiler } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { App } from '../ui/App';
import { EditorStore } from '../ui/editor-store';
import { Canvas2DRenderer } from '../renderers/canvas2d';
import { createDefaultProject, createLayer } from '../core/project-model';
import type { Project, Layer } from '../core/project-model';
import { newId } from '../core/core-types';
import {
  insertGraphNode,
  patchGraphNode,
} from '../core/compositing-operations';
import { command } from '../core/command-system';
import { loadProject, saveProject } from '../core/project-io';
import '../ui/base.css';

function fixture(kind: string): Project {
  const count =
    kind === 'BENCH-A'
      ? 50
      : kind === 'BENCH-B'
        ? 100
        : kind === 'BENCH-D'
          ? 3
          : 1;
  const keys = kind === 'BENCH-A' ? 4 : kind === 'BENCH-B' ? 10 : 0;
  const p = createDefaultProject();
  const layers: Layer[] = Array.from({ length: count }, (_, i) => {
    let layer = createLayer('rectangle', {
      position: { x: 160 + (i % 10) * 170, y: 140 + Math.floor(i / 10) * 85 },
      width: kind === 'BENCH-D' ? 960 : 110,
      height: kind === 'BENCH-D' ? 540 : 60,
    });
    layer = {
      ...layer,
      transform: {
        ...layer.transform,
        position: {
          ...layer.transform.position,
          keyframes: Array.from({ length: keys }, (_, k) => ({
            id: newId(),
            time: (k * 4) / Math.max(1, keys - 1),
            value: {
              x: layer.transform.position.baseValue.x + k * 10,
              y: layer.transform.position.baseValue.y,
            },
            interpolation: { type: 'linear' as const },
          })),
        },
      },
    };
    let graph = layer.editor!.graph!;
    const types =
      kind === 'BENCH-C'
        ? Array.from({ length: 18 }, () => 'exposure')
        : kind === 'BENCH-D'
          ? ['gaussianBlur', 'exposure', 'gaussianBlur', 'hueSaturation']
          : [];
    for (const type of types) {
      const inserted = insertGraphNode(graph, type);
      graph = inserted.graph;
      if (type === 'gaussianBlur')
        graph = {
          ...graph,
          nodes: graph.nodes.map((n) =>
            n.id === inserted.node.id
              ? {
                  ...n,
                  params: {
                    ...n.params,
                    radius: { ...n.params.radius!, baseValue: 8 },
                  },
                }
              : n,
          ),
        };
    }
    return { ...layer, editor: { ...layer.editor!, graph } };
  });
  return {
    ...p,
    name: kind,
    compositions: p.compositions.map((c) => ({
      ...c,
      width: 1920,
      height: 1080,
      duration: 5,
      layers,
    })),
  };
}
const raf = () =>
  new Promise<number>((resolve) => requestAnimationFrame(resolve));
function summary(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    n: samples.length,
    medianMs: sorted[Math.floor(sorted.length / 2)] ?? 0,
    p95Ms:
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ??
      0,
    totalMs: samples.reduce((a, b) => a + b, 0),
  };
}
const mount = document.getElementById('editor')!;
const output = document.getElementById('results')!;
const button = document.getElementById('run') as HTMLButtonElement;
let measured: number[] = [];
const originalRender = Canvas2DRenderer.prototype.render;
Canvas2DRenderer.prototype.render = function (...args) {
  const start = performance.now();
  try {
    return originalRender.apply(this, args);
  } finally {
    measured.push(performance.now() - start);
  }
};
button.onclick = async () => {
  button.disabled = true;
  const results = [];
  try {
    for (const kind of ['BENCH-A', 'BENCH-B', 'BENCH-C', 'BENCH-D']) {
      output.textContent = `正在运行 ${kind}`;
      const p = fixture(kind),
        encoded = saveProject(p),
        loadTimes = [],
        saveTimes = [];
      for (let i = 0; i < 8; i++) {
        let start = performance.now();
        loadProject(encoded);
        loadTimes.push(performance.now() - start);
        start = performance.now();
        saveProject(p);
        saveTimes.push(performance.now() - start);
      }
      const store = new EditorStore(p),
        root = createRoot(mount),
        commits: number[] = [];
      flushSync(() =>
        root.render(
          <Profiler
            id="editor"
            onRender={(_id, _phase, duration) => commits.push(duration)}
          >
            <App store={store} />
          </Profiler>,
        ),
      );
      await raf();
      await raf();
      store.select(p.compositions[0]!.layers[0]!.id);
      await raf();
      // Exercise the actual timeline with every animated track expanded.
      flushSync(() => {
        const tab = [
          ...mount.querySelectorAll<HTMLButtonElement>('button[role="tab"]'),
        ].find(
          (el) =>
            el.textContent === (kind === 'BENCH-C' ? '合成节点' : '时间轴'),
        );
        tab?.click();
      });
      if (kind === 'BENCH-A' || kind === 'BENCH-B') {
        for (const el of mount.querySelectorAll<HTMLButtonElement>(
          '.layer-disclosure[aria-expanded="false"]',
        ))
          flushSync(() => el.click());
        flushSync(() => store.setPropertyFilter('animated'));
      }
      await raf();
      const operations: Record<string, unknown> = {};
      const measure = async (name: string, action: (i: number) => void) => {
        measured = [];
        commits.length = 0;
        const interactions = [],
          frames = [];
        let previous = await raf();
        for (let i = 0; i < 24; i++) {
          const start = performance.now();
          flushSync(() => action(i));
          interactions.push(performance.now() - start);
          const next = await raf();
          frames.push(next - previous);
          previous = next;
        }
        operations[name] = {
          interaction: summary(interactions),
          frame: summary(frames),
          render: summary(measured),
          react: summary(commits),
        };
      };
      await measure('timelineSelection', (i) =>
        store.selectFrames(
          i % 2
            ? []
            : [
                {
                  propertyId:
                    p.compositions[0]!.layers[0]!.transform.position.id,
                  keyframeId:
                    p.compositions[0]!.layers[0]!.transform.position
                      .keyframes[0]?.id ?? 'missing',
                },
              ],
        ),
      );
      await measure('timelineScrub', (i) => store.setTime(i / 30));
      await measure('graphSelection', (i) =>
        store.selectGraphNodes(
          p.compositions[0]!.layers[0]!.id,
          i % 2
            ? []
            : [p.compositions[0]!.layers[0]!.editor!.graph!.nodes[0]!.id],
        ),
      );
      const layerId = p.compositions[0]!.layers[0]!.id;
      store.setTime(0);
      store.beginDrag(layerId, { x: 160, y: 140 });
      await measure('canvasDrag', (i) =>
        store.moveDrag({ x: 160 + i, y: 140 + i }),
      );
      store.cancelDrag();
      await measure('graphLayoutCommit', (i) => {
        const graph =
          store.getSnapshot().project.compositions[0]!.layers[0]!.editor!
            .graph!;
        store.run('基准节点布局', [
          command({
            type: 'graph.replace',
            compositionId: store.getSnapshot().project.activeCompositionId,
            layerId,
            graph: patchGraphNode(graph, graph.nodes[0]!.id, {
              position: { x: i * 2, y: 0 },
            }),
          }),
        ]);
      });
      results.push({
        scenario: kind,
        layers: p.compositions[0]!.layers.length,
        keyframes: p.compositions[0]!.layers.reduce(
          (n, l) => n + l.transform.position.keyframes.length,
          0,
        ),
        nodes: p.compositions[0]!.layers[0]!.editor!.graph!.nodes.length,
        bytes: new TextEncoder().encode(encoded).length,
        load: summary(loadTimes),
        save: summary(saveTimes),
        operations,
      });
      flushSync(() => root.unmount());
    }
    output.textContent = JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        viewport: [innerWidth, innerHeight],
        kind: 'Development React Profiler + actual Canvas2DRenderer; 24 RAF-paced interactions per operation; load/save includes JSON/schema CPU only, excludes native disk/dialog; frame includes display scheduling',
        results,
      },
      null,
      2,
    );
  } catch (error) {
    output.textContent = String(error);
  } finally {
    button.disabled = false;
  }
};
