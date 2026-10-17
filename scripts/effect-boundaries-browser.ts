import { createDefaultProject, createLayer } from '../src/core/project-model';
import { createProgrammableNode } from '../src/core/compositing-registry';
import { insertGraphNode } from '../src/core/compositing-operations';
import { organicTexturePackage } from '../src/core/effect-examples';
import { trustEffect } from '../src/core/effect-trust';
import { createRenderSnapshot } from '../src/core/renderer-core';
import { Canvas2DRenderer } from '../src/renderers/canvas2d';
import { previewEffectScale } from '../src/renderers/preview-quality';
import { exportCurrentFrame } from '../src/renderers/png-export';
const button = document.querySelector('button')!;
button.addEventListener('click', async () => {
  button.disabled = true;
  const result: Record<string, unknown> = {};
  try {
    const p = createDefaultProject(),
      c = p.compositions[0]!,
      pkg = organicTexturePackage();
    trustEffect(pkg.contentHash);
    const base = createLayer('rectangle', {
      width: 1920,
      height: 1080,
      position: { x: 960, y: 540 },
    });
    const layer = {
      ...base,
      editor: {
        ...base.editor!,
        graph: insertGraphNode(base.editor!.graph!, createProgrammableNode(pkg))
          .graph,
      },
    };
    const project = {
      ...p,
      compositions: [{ ...c, width: 1920, height: 1080, layers: [layer] }],
    };
    const renderer = new Canvas2DRenderer(),
      canvas = document.querySelector('canvas')!;
    const snapshot = createRenderSnapshot(
      project.compositions[0]!,
      0.75,
      [],
      undefined,
      project,
    );
    const effectScale = previewEffectScale(snapshot, true);
    const measurements = [];
    for (let i = 0; i < 10; i++) {
      const input = createRenderSnapshot(
        project.compositions[0]!,
        i / 30,
        [],
        undefined,
        project,
      );
      const t = performance.now();
      renderer.render(input, canvas, 1, false, 1, false, effectScale);
      measurements.push(performance.now() - t);
    }
    renderer.render(snapshot, canvas, 1, false, 1, false, effectScale);
    const start = performance.now();
    renderer.render(snapshot, canvas, 1, false);
    result.fullRestoreMs = performance.now() - start;
    const restored = canvas
      .getContext('2d')!
      .getImageData(0, 0, 1920, 1080).data;
    const isolated = document.createElement('canvas'),
      full = new Canvas2DRenderer();
    full.render(snapshot, isolated, 1, false);
    const expected = isolated
      .getContext('2d')!
      .getImageData(0, 0, 1920, 1080).data;
    result.fullRestoredExactly = restored.every((v, i) => v === expected[i]);
    const exported = await exportCurrentFrame(project, c.id, snapshot.time);
    const bitmap = await createImageBitmap(exported),
      output = document.createElement('canvas');
    output.width = 1920;
    output.height = 1080;
    output.getContext('2d')!.drawImage(bitmap, 0, 0);
    const exportPixels = output
      .getContext('2d')!
      .getImageData(0, 0, 1920, 1080).data;
    result.exportFullPixelsEqual = restored.every(
      (v, i) => v === exportPixels[i],
    );
    result.effectScale = effectScale;
    result.interactiveMs = measurements;
    result.meanInteractiveMs =
      measurements.slice(1).reduce((a, b) => a + b, 0) / 9;
    renderer.assertNoEffectErrors();
    result.success = result.fullRestoredExactly && result.exportFullPixelsEqual;
    full.dispose();
    renderer.dispose();
    bitmap.close();
  } catch (e) {
    result.error = String(e);
    result.success = false;
  }
  document.querySelector('pre')!.textContent = JSON.stringify(result, null, 2);
});
