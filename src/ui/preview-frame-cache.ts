import type { Project } from '../core/project-model';
/** UI-only bitmap cache. Never claims that an unrendered frame is ready. */
export class PreviewFrameCache {
  constructor(private readonly budget = 256 * 1024 * 1024) {}
  private project?: Project;
  private entries = new Map<
    string,
    { canvas: HTMLCanvasElement; time: number }
  >();
  private bytes = 0;
  prepare(project: Project) {
    if (this.project !== project) {
      this.project = project;
      this.clear();
    }
  }
  clear() {
    this.entries.clear();
    this.bytes = 0;
  }
  get(key: string) {
    const found = this.entries.get(key);
    if (found) {
      this.entries.delete(key);
      this.entries.set(key, found);
    }
    return found?.canvas;
  }
  put(key: string, time: number, source: HTMLCanvasElement) {
    const size = source.width * source.height * 4;
    if (size > Math.min(this.budget, 64 * 1024 * 1024)) return;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d');
    if (!context?.drawImage) return;
    context.drawImage(source, 0, 0);
    const old = this.entries.get(key);
    if (old) this.bytes -= old.canvas.width * old.canvas.height * 4;
    this.entries.set(key, { canvas, time });
    this.bytes += size;
    while (this.bytes > this.budget) {
      const first = this.entries.keys().next().value!;
      const v = this.entries.get(first)!;
      this.bytes -= v.canvas.width * v.canvas.height * 4;
      this.entries.delete(first);
    }
  }
  times() {
    return [...new Set([...this.entries.values()].map((e) => e.time))];
  }
}
