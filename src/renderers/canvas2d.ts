import { GraphExecutionCache } from '../core/compositing-cache';
import { isIdentityGraph } from '../core/compositing-compiler';
import { compositingSourceKey } from './compositing-source-key';
import { renderCompositingGraph } from './compositing-graph';
import { layerEffects } from '../core/compositing-migration';
import { drawPerspectivePlane } from './perspective-plane';
import { applyMasks, layerPadding, surface } from './layer-compositing';
import { drawContent, cssColor } from './draw-content';
import { transformHandles } from '../core/transform-geometry';
import type { ID } from '../core/core-types';
import { createRenderSnapshot } from '../core/renderer-core';
import type { Asset, Layer, Project } from '../core/project-model';
import type { RendererAdapter, RenderSnapshot } from '../core/renderer-core';

export { cssColor } from './draw-content';
export async function assetImageBlob(asset: Asset): Promise<Blob> {
  if (asset.dataUrl.startsWith('data:')) {
    const encoded = asset.dataUrl.slice(asset.dataUrl.indexOf(',') + 1),
      binary = atob(encoded),
      bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: asset.mimeType });
  }
  const response = await fetch(asset.dataUrl);
  if (!response.ok) throw new Error('Missing media');
  return response.blob();
}

export class Canvas2DRenderer implements RendererAdapter<HTMLCanvasElement> {
  #last = new WeakMap<
    HTMLCanvasElement,
    { input: RenderSnapshot; assets: number; handleScale: number }
  >();
  #content = new WeakMap<
    Layer,
    {
      canvas: HTMLCanvasElement;
      time: number;
      assets: number;
      project?: Project;
      padding: number;
    }
  >();
  #graphLayers = new Map<
    ID,
    {
      key: string;
      source: HTMLCanvasElement;
      cache: GraphExecutionCache<HTMLCanvasElement>;
    }
  >();
  #assetVersion = 0;
  #graphDiagnostics = new Map<string, string>();
  #failedLinked = new WeakSet<Asset>();
  #images = new Map<ID, { url: string; bitmap: ImageBitmap }>();
  #pending = new Map<ID, Promise<void>>();
  #desired = new Map<ID, string>();
  async syncAssets(assets: readonly Asset[]): Promise<void> {
    this.#desired = new Map(assets.map((asset) => [asset.id, asset.dataUrl]));
    for (const [id, image] of this.#images)
      if (
        !assets.some((asset) => asset.id === id && asset.dataUrl === image.url)
      ) {
        image.bitmap.close();
        this.#images.delete(id);
        this.#assetVersion++;
      }
    await Promise.all(
      assets.map(async (asset) => {
        if (this.#images.has(asset.id) || this.#failedLinked.has(asset)) return;
        const pending = this.#pending.get(asset.id);
        if (pending) await pending;
        if (this.#desired.get(asset.id) !== asset.dataUrl) return;
        if (this.#images.get(asset.id)?.url === asset.dataUrl) return;
        const promise = (async () => {
          const bitmap = await createImageBitmap(await assetImageBlob(asset));
          if (this.#desired.get(asset.id) === asset.dataUrl) {
            this.#images.set(asset.id, { url: asset.dataUrl, bitmap });
            this.#assetVersion++;
          } else bitmap.close();
        })();
        this.#pending.set(asset.id, promise);
        try {
          await promise;
        } catch (error) {
          if (!asset.source) throw error;
          this.#failedLinked.add(asset);
        } finally {
          this.#pending.delete(asset.id);
        }
      }),
    );
  }
  dispose(): void {
    this.#desired.clear();
    this.#graphDiagnostics.clear();
    this.#graphLayers.clear();
    for (const image of this.#images.values()) image.bitmap.close();
    this.#images.clear();
    this.#last = new WeakMap();
    this.#content = new WeakMap();
  }
  render(
    input: RenderSnapshot,
    target: HTMLCanvasElement,
    handleScale = 1,
  ): void {
    const last = this.#last.get(target);
    if (
      last?.input === input &&
      last.assets === this.#assetVersion &&
      last.handleScale === handleScale &&
      target.width === input.width &&
      target.height === input.height
    )
      return;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    if (target.width !== input.width) target.width = input.width;
    if (target.height !== input.height) target.height = input.height;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.fillStyle = input.backgroundColor
      ? cssColor(input.backgroundColor)
      : '#111827';
    ctx.fillRect(0, 0, target.width, target.height);
    const live = new Set(
      input.project?.compositions.flatMap((c) => c.layers.map((l) => l.id)) ??
        input.layers.map((l) => l.source.id),
    );
    for (const id of this.#graphLayers.keys())
      if (!live.has(id)) this.#graphLayers.delete(id);
    for (const item of input.layers) {
      const layer = item.source;
      if (!layer.visible || item.active === false || layer.type === 'camera')
        continue;
      ctx.save();
      if (!item.source.editor?.is3D) {
        if (item.matrix) ctx.transform(...item.matrix);
        else {
          ctx.translate(item.position.x, item.position.y);
          ctx.rotate((item.rotation * Math.PI) / 180);
          ctx.scale(item.scale.x, item.scale.y);
          ctx.translate(-(item.anchor?.x ?? 0), -(item.anchor?.y ?? 0));
        }
      }
      ctx.globalAlpha = item.opacity;
      ctx.globalCompositeOperation =
        item.source.editor?.blendMode === 'add'
          ? 'lighter'
          : item.source.editor?.blendMode === 'normal' || !item.source.editor
            ? 'source-over'
            : item.source.editor.blendMode;
      const x = -layer.width / 2;
      const y = -layer.height / 2;
      let nested: HTMLCanvasElement | undefined;
      if (layer.type === 'precomp' && input.project) {
        const composition = input.project.compositions.find(
          (c) => c.id === layer.compositionId,
        );
        if (composition) {
          nested = surface(composition.width, composition.height);
          this.render(
            createRenderSnapshot(
              composition,
              Math.max(0, item.localTime ?? input.time),
              [],
              undefined,
              input.project,
            ),
            nested,
          );
        }
      }
      const draw = (context: CanvasRenderingContext2D) => {
        if (nested) context.drawImage(nested, x, y, layer.width, layer.height);
        else
          drawContent(
            context,
            layer,
            input.time,
            layer.type === 'image'
              ? this.#images.get(layer.assetId)?.bitmap
              : undefined,
          );
      };
      const directGraph =
        !!layer.editor?.graph &&
        isIdentityGraph(layer.editor.graph) &&
        item.opacity === 1 &&
        layer.editor.blendMode === 'normal';
      const hasEffects =
        (!!layer.editor?.graph && !directGraph) ||
        layerEffects(layer).some((e) => e.enabled) ||
        layer.editor?.masks.some((m) => m.enabled);
      if (hasEffects || layer.editor?.is3D || nested) {
        const padding = layer.editor?.graph
            ? Math.max(128, layerPadding(layer, input.time))
            : layerPadding(layer, input.time),
          animated =
            layer.type === 'precomp' ||
            (layer.editor
              ? Object.values(layer.editor.properties).some(
                  (p) => p.keyframes.length,
                ) ||
                layer.editor.masks.some((m) =>
                  [m.path, m.opacity, m.feather, m.expansion].some(
                    (p) => p.keyframes.length,
                  ),
                ) ||
                layerEffects(layer).some((e) =>
                  Object.values(e.parameters).some((p) => p.keyframes.length),
                ) ||
                layer.editor.graph?.nodes.some((n) =>
                  Object.values(n.params).some((p) => p.keyframes.length),
                )
              : false),
          cacheTime = animated ? input.time : 0,
          cached = layer.editor?.graph ? undefined : this.#content.get(layer);
        let processed =
          cached?.time === cacheTime &&
          cached.assets === this.#assetVersion &&
          cached.project === input.project &&
          cached.padding === padding
            ? cached.canvas
            : undefined;
        if (!processed) {
          const sourceKey = compositingSourceKey(
            layer,
            input.time,
            this.#assetVersion,
            padding,
            input.project,
          );
          let slot = this.#graphLayers.get(layer.id);
          if (slot?.key !== sourceKey) {
            const content = surface(
                layer.width + padding * 2,
                layer.height + padding * 2,
              ),
              local = content.getContext('2d')!;
            local.translate(
              layer.width / 2 + padding,
              layer.height / 2 + padding,
            );
            draw(local);
            slot = {
              key: sourceKey,
              source: applyMasks(content, layer, input.time, padding),
              cache:
                slot?.cache ??
                new GraphExecutionCache(
                  64,
                  32 * 1024 * 1024,
                  (c) => c.width * c.height * 4,
                ),
            };
            this.#graphLayers.delete(layer.id);
            if (
              slot.source.width * slot.source.height * 4 <=
              32 * 1024 * 1024
            ) {
              this.#graphLayers.set(layer.id, slot);
              const total = () =>
                [...this.#graphLayers.values()].reduce(
                  (n, s) => n + s.source.width * s.source.height * 4,
                  0,
                );
              while (this.#graphLayers.size > 4 || total() > 32 * 1024 * 1024)
                this.#graphLayers.delete(
                  this.#graphLayers.keys().next().value!,
                );
            }
          }

          const execution = renderCompositingGraph(
            slot.source,
            layer,
            input.time,
            padding,
            slot.cache,
            sourceKey,
          );
          processed = execution.output;
          if (layer.editor?.graph) {
            const graphId = layer.editor.graph.id,
              signature = JSON.stringify(execution.diagnostics);
            if (this.#graphDiagnostics.get(graphId) !== signature) {
              this.#graphDiagnostics.set(graphId, signature);
              window.dispatchEvent(
                new CustomEvent('motion:graph-errors', {
                  detail: { graphId, diagnostics: execution.diagnostics },
                }),
              );
            }
          }
          if (!layer.editor?.graph)
            this.#content.set(layer, {
              canvas: processed,
              time: cacheTime,
              assets: this.#assetVersion,
              project: input.project,
              padding,
            });
        }
        if (layer.editor?.is3D && item.world3D && input.camera)
          drawPerspectivePlane(
            ctx,
            processed,
            item.world3D,
            input.camera,
            layer.width,
            layer.height,
            padding,
          );
        else ctx.drawImage(processed, x - padding, y - padding);
      } else {
        this.#graphLayers.delete(layer.id);
        const graphId = layer.editor?.graph?.id;
        if (graphId && this.#graphDiagnostics.has(graphId)) {
          this.#graphDiagnostics.delete(graphId);
          window.dispatchEvent(
            new CustomEvent('motion:graph-errors', {
              detail: { graphId, diagnostics: [] },
            }),
          );
        }
        draw(ctx);
      }

      if (input.selection.includes(layer.id)) {
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#8eaaff';
        ctx.lineWidth =
          3 / Math.max(0.01, Math.abs(item.scale.x), Math.abs(item.scale.y));
        ctx.setLineDash([]);
        if (item.quad) {
          ctx.beginPath();
          item.quad.forEach((p, i) =>
            i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
          );
          ctx.closePath();
          ctx.stroke();
        } else ctx.strokeRect(x - 3, y - 3, layer.width + 6, layer.height + 6);
      }
      ctx.restore();
    }
    for (const item of input.layers.filter((l) =>
      input.selection.includes(l.source.id),
    ))
      for (const handle of transformHandles(item, handleScale)) {
        ctx.beginPath();
        ctx.strokeStyle = '#d4e2ff';
        ctx.fillStyle = handle.kind === 'anchor' ? '#ffd25a' : '#73a7ff';
        if (handle.kind === 'scale')
          ctx.rect(
            handle.point.x - 4 * handleScale,
            handle.point.y - 4 * handleScale,
            8 * handleScale,
            8 * handleScale,
          );
        else
          ctx.arc(
            handle.point.x,
            handle.point.y,
            (handle.kind === 'anchor' ? 4 : 5) * handleScale,
            0,
            Math.PI * 2,
          );
        ctx.fill();
        ctx.lineWidth = handleScale;
        ctx.stroke();
      }
    this.#last.set(target, { input, assets: this.#assetVersion, handleScale });
  }
}
