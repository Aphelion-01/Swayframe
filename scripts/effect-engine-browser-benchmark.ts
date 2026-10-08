import {
  createDefaultProject,
  createLayer,
  createProperty,
} from '../src/core/project-model';
import type { Layer, Project } from '../src/core/project-model';
import {
  radialGradientDefinition,
  gradientPropertyKey,
  radialPixels,
  radialDefaults,
} from '../src/core/radial-gradient';
import { createGeneratorLayer } from '../src/core/generator-layer';
import {
  insertGraphNode,
  deleteGraphNodes,
} from '../src/core/compositing-operations';
import { organicTexturePackage } from '../src/core/effect-examples';
import { trustEffect } from '../src/core/effect-trust';
import { loadProject, saveProject } from '../src/core/project-io';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { Canvas2DRenderer } from '../src/renderers/canvas2d';
import { exportCurrentFrame } from '../src/renderers/png-export';
import { effectsToGraph } from '../src/core/compositing-migration';
import { createEffect } from '../src/core/effect-model';
import { CommandSystem, transaction } from '../src/core/command-system';
import { graphCommand } from '../src/core/compositing-commands';
const results = document.querySelector('pre')!,
  button = document.querySelector('button')!;
button.addEventListener('click', async () => {
  button.disabled = true;
  results.textContent = '运行中';
  const checks: Record<string, unknown> = {};
  const equal = (a: Uint8ClampedArray, b: Uint8ClampedArray) =>
    a.length === b.length && a.every((v, i) => v === b[i]);
  const base = createDefaultProject(),
    composition = {
      ...base.compositions[0]!,
      width: 192,
      height: 108,
      duration: 2,
      fps: 24,
    };
  const project = (layer: Layer): Project => ({
    ...base,
    compositions: [{ ...composition, layers: [layer] }],
  });
  const render = (p: Project, time = 0) => {
    const c = document.createElement('canvas'),
      renderer = new Canvas2DRenderer();
    renderer.render(
      createRenderSnapshot(p.compositions[0]!, time, [], undefined, p),
      c,
      1,
      false,
    );
    renderer.assertNoEffectErrors();
    renderer.dispose();
    return c;
  };
  const pixels = (c: HTMLCanvasElement) =>
    c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  try {
    const layer = createLayer('rectangle', {
        width: 192,
        height: 108,
        position: { x: 96, y: 54 },
      }),
      fill = {
        ...layer,
        editor: {
          ...layer.editor!,
          gradient: 'radial' as const,
          properties: {
            ...layer.editor!.properties,
            ...Object.fromEntries(
              radialGradientDefinition.parameters.map((p) => [
                gradientPropertyKey(p.id),
                createProperty(p.defaultValue),
              ]),
            ),
          },
        },
      };
    const generator = createGeneratorLayer(composition, 'radialGradient'),
      graph = {
        ...layer,
        editor: {
          ...layer.editor!,
          graph: insertGraphNode(layer.editor!.graph!, 'radialGradient').graph,
        },
      };
    const a = pixels(render(project(fill))),
      b = pixels(render(project(generator))),
      c = pixels(render(project(graph)));
    checks.radialFillGeneratorGraphPixelsEqual = equal(a, b) && equal(b, c);
    const blurLayer = createLayer('rectangle', {
      width: 72,
      height: 52,
      position: { x: 96, y: 54 },
    });
    const defaultBlur = createEffect('gaussianBlur'),
      blur = {
        ...defaultBlur,
        parameters: {
          ...defaultBlur.parameters,
          radius: { ...defaultBlur.parameters.radius!, baseValue: 6 },
        },
      };
    const legacy = {
        ...blurLayer,
        editor: {
          ...blurLayer.editor!,
          graph: effectsToGraph(blurLayer.id, [blur]),
        },
      },
      graphBlur = {
        ...blurLayer,
        editor: {
          ...blurLayer.editor!,
          graph: (() => {
            const g = insertGraphNode(
              blurLayer.editor!.graph!,
              'gaussianBlur',
            ).graph;
            return {
              ...g,
              nodes: g.nodes.map((n) =>
                n.type === 'gaussianBlur'
                  ? {
                      ...n,
                      params: {
                        ...n.params,
                        radius: { ...n.params.radius!, baseValue: 6 },
                      },
                    }
                  : n,
              ),
            };
          })(),
        },
      };
    checks.blurInspectorGraphPixelsEqual = equal(
      pixels(render(project(legacy))),
      pixels(render(project(graphBlur))),
    );
    const blurHost = new CommandSystem(project(blurLayer)),
      original = pixels(render(blurHost.getSnapshot()));
    blurHost.executeTransaction(
      transaction('添加模糊', 'human', [
        graphCommand(blurHost.getSnapshot(), blurLayer.id, legacy.editor.graph),
      ]),
    );
    const blurred = pixels(render(blurHost.getSnapshot()));
    checks.nonzeroBlurChangesPixels = !equal(original, blurred);
    blurHost.undo();
    checks.blurUndoRestoresPixels = equal(
      original,
      pixels(render(blurHost.getSnapshot())),
    );
    blurHost.redo();
    checks.blurRedoRestoresPixels = equal(
      blurred,
      pixels(render(blurHost.getSnapshot())),
    );
    const pkg = organicTexturePackage();
    trustEffect(pkg.contentHash);
    const custom = createGeneratorLayer(composition, pkg),
      customProject = project(custom),
      frame = render(customProject, 0.75);
    document.querySelector('#preview')!.replaceChildren(frame);
    const blob = await exportCurrentFrame(customProject, composition.id, 0.75),
      image = await createImageBitmap(blob),
      decoded = document.createElement('canvas');
    decoded.width = image.width;
    decoded.height = image.height;
    decoded.getContext('2d')!.drawImage(image, 0, 0);
    image.close();
    checks.previewExportPixelsEqual = equal(pixels(frame), pixels(decoded));
    checks.pngBytes = blob.size;
    checks.reloadPixelsEqual = equal(
      pixels(frame),
      pixels(render(loadProject(saveProject(customProject)), 0.75)),
    );
    checks.timeChangesPixels = !equal(
      pixels(render(customProject, 0)),
      pixels(frame),
    );
    const n = custom.editor!.graph!.nodes.find((n) => n.effectPackage)!,
      density = n.params.density!;
    const animated = {
      ...custom,
      editor: {
        ...custom.editor!,
        graph: {
          ...custom.editor!.graph!,
          nodes: custom.editor!.graph!.nodes.map((node) =>
            node.id === n.id
              ? {
                  ...node,
                  params: {
                    ...node.params,
                    density: {
                      ...density,
                      keyframes: [
                        {
                          id: crypto.randomUUID(),
                          time: 0,
                          value: 4,
                          interpolation: { type: 'linear' as const },
                        },
                        {
                          id: crypto.randomUUID(),
                          time: 1,
                          value: 25,
                          interpolation: { type: 'linear' as const },
                        },
                      ],
                    },
                  },
                }
              : node,
          ),
        },
      },
    };
    checks.keyframesChangePixels = !equal(
      pixels(render(project(animated), 0)),
      pixels(render(project(animated), 1)),
    );
    const removed = {
      ...custom,
      editor: {
        ...custom.editor!,
        graph: deleteGraphNodes(custom.editor!.graph!, [n.id]),
      },
    };
    checks.removalRenders = !!render(project(removed));
    const disabled = {
      ...custom,
      editor: {
        ...custom.editor!,
        graph: {
          ...custom.editor!.graph!,
          nodes: custom.editor!.graph!.nodes.map((node) =>
            node.id === n.id ? { ...node, enabled: false } : node,
          ),
        },
      },
    };
    checks.disabledBypassRenders = !!render(project(disabled));
    const missing = {
      ...custom,
      editor: {
        ...custom.editor!,
        graph: {
          ...custom.editor!.graph!,
          nodes: custom.editor!.graph!.nodes.map((node) =>
            node.id === n.id ? { ...node, effectPackage: undefined } : node,
          ),
        },
      },
    };
    const loadedMissing = loadProject(saveProject(project(missing)));
    checks.missingNodePreserved =
      loadedMissing.compositions[0]!.layers[0]!.editor!.graph!.nodes.some(
        (node) => node.id === n.id,
      );
    try {
      await exportCurrentFrame(loadedMissing, composition.id, 0);
      checks.missingEffectBlocksExport = false;
    } catch (e) {
      checks.missingEffectBlocksExport =
        e instanceof Error && e.message.includes('导出停止');
    }
    const start = performance.now();
    radialPixels(1920, 1080, radialDefaults());
    checks.radial1080Milliseconds = Number(
      (performance.now() - start).toFixed(2),
    );
    checks.pass = Object.values(checks).every(
      (v) => typeof v !== 'boolean' || v,
    );
  } catch (e) {
    checks.pass = false;
    checks.error = e instanceof Error ? e.stack : String(e);
  }
  results.textContent = JSON.stringify(checks, null, 2);
  button.disabled = false;
});
