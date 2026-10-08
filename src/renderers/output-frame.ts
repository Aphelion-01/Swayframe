import type { Composition, Project } from '../core/project-model';
import { createRenderSnapshot } from '../core/renderer-core';
import {
  outputRect,
  validateOutputSettings,
  type OutputSettings,
} from '../core/output-settings';
import { Canvas2DRenderer } from './canvas2d';
import { surface } from './layer-compositing';
export class OutputFrameRenderer {
  private renderer = new Canvas2DRenderer();
  private original: HTMLCanvasElement;
  readonly canvas: HTMLCanvasElement;
  constructor(
    private project: Project,
    private c: Composition,
    private settings: OutputSettings,
  ) {
    validateOutputSettings(settings);
    this.original = surface(c.width, c.height);
    this.canvas = surface(settings.width, settings.height);
  }
  async init() {
    await document.fonts?.ready;
    await this.renderer.syncAssets(this.project.assets);
  }
  draw(time: number) {
    const s = this.settings;
    this.renderer.render(
      createRenderSnapshot(this.c, time, [], undefined, this.project),
      this.original,
      1,
      false,
      1,
      s.transparent,
    );
    const ctx = this.canvas.getContext('2d')!,
      rect = outputRect(this.c.width, this.c.height, s);
    ctx.clearRect(0, 0, s.width, s.height);
    if (!s.transparent) {
      ctx.fillStyle = s.background;
      ctx.fillRect(0, 0, s.width, s.height);
    }
    ctx.drawImage(this.original, rect.x, rect.y, rect.width, rect.height);
    return this.canvas;
  }
  dispose() {
    this.renderer.dispose();
    this.original.width = 1;
    this.canvas.width = 1;
  }
}
