import {
  compileEffect,
  assertEffectContext,
} from '../core/programmable-effect';
import type { EffectPackage, EffectContext } from '../core/programmable-effect';
import { isEffectTrusted } from '../core/effect-trust';
import { radialPixels } from '../core/radial-gradient';
import type { GraphExecutionCache } from '../core/compositing-cache';
import { mergePixels } from '../core/compositing-pixels';
import type { AnimValue, Vec2 } from '../core/core-types';
import type { EffectKind, Layer, Property } from '../core/project-model';
import type { NodeBackend } from '../core/compositing-registry';
import { compileGraph, executeGraph } from '../core/compositing-compiler';
import { transform2D } from '../core/matrix2d';
import { applyEffects, surface } from './layer-compositing';
export class CanvasGraphBackend implements NodeBackend<HTMLCanvasElement> {
  constructor(
    readonly content: HTMLCanvasElement,
    readonly layer: Layer,
    readonly padding: number,
    readonly fps = 30,
  ) {}
  get cacheKey() {
    return [this.layer.width, this.layer.height, this.padding, this.fps].join(
      ':',
    );
  }
  capability(id: string, params: Readonly<Record<string, AnimValue>>) {
    if (id !== 'radialGradient') throw Error('未知视觉能力');
    const out = this.transparent(),
      ctx = out.getContext('2d')!;
    const w = Math.ceil(this.layer.width),
      h = Math.ceil(this.layer.height),
      pixels = ctx.createImageData(w, h);
    pixels.data.set(radialPixels(w, h, params));
    ctx.putImageData(pixels, this.padding, this.padding);
    return out;
  }
  programmable(
    effect: EffectPackage,
    params: Readonly<Record<string, AnimValue>>,
    context: EffectContext,
    input?: HTMLCanvasElement,
  ) {
    if (!isEffectTrusted(effect.contentHash))
      throw Error('自定义效果尚未信任，请在效果属性中确认启用');
    const width = Math.ceil(this.layer.width),
      height = Math.ceil(this.layer.height),
      runtimeContext = {
        ...context,
        width,
        height,
        frame: Math.round(context.time * this.fps),
      };
    assertEffectContext(effect, runtimeContext);
    const out = this.transparent(),
      ctx = out.getContext('2d')!;
    const source = input
      ?.getContext('2d')!
      .getImageData(this.padding, this.padding, width, height).data;
    const data = compileEffect(effect).render(params, runtimeContext, source);
    const pixels = ctx.createImageData(width, height);
    pixels.data.set(data);
    ctx.putImageData(pixels, this.padding, this.padding);
    return out;
  }
  source() {
    return this.content;
  }
  transparent() {
    return surface(this.content.width, this.content.height);
  }
  effect(
    input: HTMLCanvasElement,
    kind: EffectKind,
    params: Readonly<Record<string, AnimValue>>,
  ) {
    const parameters = Object.fromEntries(
      Object.entries(params).map(([k, v]) => [
        k,
        {
          id: k,
          baseValue: Number(v),
          keyframes: [],
        } satisfies Property<number>,
      ]),
    );
    return applyEffects(
      input,
      {
        ...this.layer,
        editor: {
          ...this.layer.editor!,
          graph: undefined,
          effects: [{ id: kind, kind, enabled: true, parameters }],
        },
      },
      0,
    );
  }
  solid(params: Readonly<Record<string, AnimValue>>) {
    const out = this.transparent(),
      ctx = out.getContext('2d')!,
      c = params.color as readonly number[];
    ctx.fillStyle = `rgba(${c[0]! * 255},${c[1]! * 255},${c[2]! * 255},${c[3]})`;
    ctx.fillRect(
      this.padding,
      this.padding,
      this.layer.width,
      this.layer.height,
    );
    return out;
  }
  transform(
    input: HTMLCanvasElement,
    params: Readonly<Record<string, AnimValue>>,
  ) {
    const out = this.transparent(),
      ctx = out.getContext('2d')!;
    const center = {
      x: this.layer.width / 2 + this.padding,
      y: this.layer.height / 2 + this.padding,
    };
    ctx.translate(center.x, center.y);
    ctx.transform(
      ...transform2D(
        params.position as Vec2,
        params.scale as Vec2,
        Number(params.rotation),
        params.anchor as Vec2,
      ),
    );
    ctx.translate(-center.x, -center.y);
    ctx.drawImage(input, 0, 0);
    return out;
  }
  mask(params: Readonly<Record<string, AnimValue>>): HTMLCanvasElement {
    const out = this.transparent(),
      ctx = out.getContext('2d')!,
      p = params.position as Vec2,
      size = params.size as Vec2;
    const x = this.layer.width / 2 + this.padding + p.x,
      y = this.layer.height / 2 + this.padding + p.y;
    ctx.fillStyle = 'white';
    ctx.globalAlpha = Number(params.opacity);
    ctx.filter = `blur(${Number(params.feather)}px)`;
    if (Number(params.shape) >= 0.5) {
      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        Math.max(0, size.x / 2),
        Math.max(0, size.y / 2),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else ctx.fillRect(x - size.x / 2, y - size.y / 2, size.x, size.y);
    return out;
  }
  merge(
    a: HTMLCanvasElement,
    b: HTMLCanvasElement,
    mask: HTMLCanvasElement | undefined,
    params: Readonly<Record<string, AnimValue>>,
  ): HTMLCanvasElement {
    const out = this.transparent(),
      ctx = out.getContext('2d')!,
      width = out.width,
      height = out.height;
    const ap = a.getContext('2d')!.getImageData(0, 0, width, height),
      bp = b.getContext('2d')!.getImageData(0, 0, width, height),
      mp = mask?.getContext('2d')!.getImageData(0, 0, width, height);
    const pixels = ctx.createImageData(width, height);
    pixels.data.set(
      mergePixels(
        ap.data,
        bp.data,
        mp?.data,
        Number(params.opacity),
        Number(params.mode),
      ),
    );
    ctx.putImageData(pixels, 0, 0);
    return out;
  }
}
export function renderCompositingGraph(
  content: HTMLCanvasElement,
  layer: Layer,
  time: number,
  padding: number,
  cache?: GraphExecutionCache<HTMLCanvasElement>,
  sourceKey = '',
  fps = 30,
) {
  const graph = layer.editor?.graph;
  return graph
    ? executeGraph(
        compileGraph(graph),
        time,
        new CanvasGraphBackend(content, layer, padding, fps),
        cache,
        sourceKey,
      )
    : { output: applyEffects(content, layer, time), diagnostics: [] };
}
