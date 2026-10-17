import { z } from 'zod';
import { editPropertyCommand } from '../core/command-system';
import { snapToFrame } from '../core/timeline-time';
import { layerProperties, type Project } from '../core/project-model';
import {
  ownerSchema,
  layerQuery,
  propertyRequest,
  importRequest,
  renderRequest,
} from './editor-operation-schemas';
import { defaultOutputSettings } from '../core/output-settings';
import { OutputFrameRenderer } from '../renderers/output-frame';
import {
  importLayerPack,
  isLayerPackImporting,
} from '../importers/layerpack-import';
import { CoreV2Error, problem, type CoreError } from '../agent-v2/errors';
import type { EditorStore } from '../ui/editor-store';

export interface EditorContext {
  projectId: string;
  /** Host-session token, not Scene/schemaVersion and not a persistent revision. */
  revision: string;
}
export type EditorResult<T> =
  | { ok: true; context: EditorContext; data: T }
  | { ok: false; error: CoreError };
/** Renderer-host local adapter only. No transport, Planner, registry, filesystem grants or new kernel. */
export class EditorOperations {
  private readonly session = crypto.randomUUID();
  private sequence = 0;
  private base: Project;
  private readonly unsubscribe: () => void;
  private readonly lifetime = new AbortController();
  private readonly requests = new Set<string>();
  private renderAbort?: AbortController;
  private importing = false;
  constructor(private readonly store: EditorStore) {
    this.base = store.commands.getSnapshot();
    this.unsubscribe = store.commands.subscribe(() => {
      const next = store.commands.getSnapshot();
      if (next === this.base) return; // Selection/layout/workspace-only changes are not Scene revisions.
      this.base = next;
      this.sequence++;
      this.renderAbort?.abort(
        problem('CONTEXT_STALE', '渲染期间工程已改变，请重新查询。'),
      );
    });
  }
  dispose() {
    this.unsubscribe();
    this.lifetime.abort();
  }
  private context(): EditorContext {
    return {
      projectId: this.base.id,
      revision: `${this.session}:${this.sequence}`,
    };
  }
  private alive() {
    if (this.lifetime.signal.aborted)
      throw problem('CANCELLED', '编辑操作宿主已关闭。');
  }
  private owner(request: EditorContext) {
    this.alive();
    const current = this.context();
    if (request.projectId !== current.projectId)
      throw problem('CONTEXT_STALE', '工程已切换，请重新查询目标工程。', {
        field: 'projectId',
        expected: current.projectId,
        actual: request.projectId,
      });
    if (request.revision !== current.revision)
      throw problem('STALE_BASE', '工程版本已改变，请重新查询后重试。', {
        field: 'revision',
        expected: current.revision,
        actual: request.revision,
      });
  }
  private parse<T>(schema: z.ZodType<T>, raw: unknown): T {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      throw problem('INVALID_ARGUMENTS', '操作参数无效：' + issue.message, {
        field: issue.path.join('.') || '$',
      });
    }
    return parsed.data;
  }
  private failure(
    error: unknown,
    fallback: CoreError['code'] = 'COMMAND_REJECTION',
    field?: string,
  ): { ok: false; error: CoreError } {
    if (error instanceof CoreV2Error)
      return { ok: false, error: error.diagnostic };
    return {
      ok: false,
      error: problem(
        fallback,
        error instanceof Error ? error.message.slice(0, 2000) : '编辑操作失败',
        {
          field: field ?? null,
          phase:
            fallback === 'VERIFICATION_FAILURE' ? 'verification' : 'execution',
        },
      ).diagnostic,
    };
  }
  private success<T>(data: T): EditorResult<T> {
    return { ok: true, context: this.context(), data };
  }
  private read<T>(read: () => T): EditorResult<T> {
    try {
      this.alive();
      return this.success(read());
    } catch (e) {
      return this.failure(e);
    }
  }
  private cancelled(signal: AbortSignal) {
    if (signal.aborted) throw problem('CANCELLED', '操作已取消。');
  }
  private beginWrite(
    request: EditorContext & { requestId: string },
    signal: AbortSignal,
  ) {
    this.alive();
    this.cancelled(signal);
    // A different Project always wins over replay diagnostics.
    if (request.projectId !== this.base.id) this.owner(request);
    if (this.requests.has(request.requestId))
      throw problem(
        'REPLAY_FORBIDDEN',
        '同一请求不能再次执行；请查询实际工程状态。',
        { field: 'requestId', actual: request.requestId },
      );
    this.owner(request);
    if (this.importing)
      throw problem(
        'STALE_BASE',
        '已有分层包导入进行中，请等待结果并重新查询。',
        { field: 'operation' },
      );
    // Never evict IDs and silently permit a replay. Renewing a host also changes its revision nonce.
    if (this.requests.size >= 256)
      throw problem(
        'BUDGET_EXCEEDED',
        '本宿主已受理256次写请求，请由可信宿主更新会话并重新查询。',
        { field: 'requestId' },
      );
    this.requests.add(request.requestId);
  }
  private layer(id: string) {
    for (const composition of this.base.compositions) {
      const layer = composition.layers.find((l) => l.id === id);
      if (layer) return { composition, layer };
    }
    throw problem('INVALID_REFERENCE', '目标图层不存在。', {
      field: 'layerId',
      actual: id,
    });
  }

  getProjectInfo() {
    return this.read(() => ({
      id: this.base.id,
      name: this.base.name,
      schemaVersion: this.base.schemaVersion,
      activeCompositionId: this.base.activeCompositionId,
      compositionCount: this.base.compositions.length,
      assetCount: this.base.assets.length,
    }));
  }
  getSceneTree(raw: unknown) {
    return this.read(() => {
      this.owner(this.parse(ownerSchema, raw));
      return {
        order: 'bottom-to-top' as const,
        compositions: this.base.compositions.map((c) => ({
          id: c.id,
          name: c.name,
          width: c.width,
          height: c.height,
          fps: c.fps,
          duration: c.duration,
          layers: c.layers.map((l) => ({
            id: l.id,
            name: l.name,
            type: l.type,
            parentId: l.editor?.parentId ?? null,
            visible: l.visible,
            locked: l.locked,
          })),
        })),
      };
    });
  }
  getLayerDetails(raw: unknown) {
    return this.read(() => {
      const request = this.parse(layerQuery, raw);
      this.owner(request);
      const { composition, layer } = this.layer(request.layerId);
      return structuredClone({
        compositionId: composition.id,
        layer,
        properties: layerProperties(layer),
      });
    });
  }
  getSelection(raw: unknown) {
    return this.read(() => {
      this.owner(this.parse(ownerSchema, raw));
      const view = this.store.getSnapshot();
      return {
        compositionId: this.base.activeCompositionId,
        layerIds: [...view.selection],
        time: view.time,
      };
    });
  }
  setLayerProperty(raw: unknown, options: { signal?: AbortSignal } = {}) {
    return this.read(() => {
      const request = this.parse(propertyRequest, raw);
      this.beginWrite(request, options.signal ?? this.lifetime.signal);
      const { composition, layer } = this.layer(request.layerId);
      if (layer.locked)
        throw problem('PERMISSION_DENIED', '图层已锁定。', {
          field: 'layerId',
          actual: layer.id,
        });
      const entry = layerProperties(layer).find(
        (p) => p.key === request.property,
      );
      if (!entry)
        throw problem('INVALID_ARGUMENTS', '该图层没有可编辑的动画属性路径。', {
          field: 'property',
          actual: request.property,
        });
      if (request.time > composition.duration)
        throw problem('INVALID_ARGUMENTS', '时间超出目标合成。', {
          field: 'time',
        });
      const result = this.store.run(
        '外部工具修改属性',
        [
          editPropertyCommand(
            this.base,
            entry.property.id,
            snapToFrame(request.time, composition.fps),
            request.value,
          ),
        ],
        'system',
      );
      if (!result.ok)
        throw problem('COMMAND_REJECTION', result.error, { field: 'value' });
      return {
        transactionId: result.transactionId,
        layerId: layer.id,
        propertyId: entry.property.id,
      };
    });
  }
  async importLayerPackage(
    raw: unknown,
    options: { signal?: AbortSignal } = {},
  ) {
    let importing = false;
    let original: Project | undefined;
    const signal = options.signal
      ? AbortSignal.any([this.lifetime.signal, options.signal])
      : this.lifetime.signal;
    try {
      const request = this.parse(importRequest, raw);
      this.beginWrite(request, signal);
      original = this.base;
      if (!original.compositions.some((c) => c.id === request.compositionId))
        throw problem('INVALID_REFERENCE', '目标合成不存在。', {
          field: 'compositionId',
          actual: request.compositionId,
        });
      if (isLayerPackImporting(this.store))
        throw problem('STALE_BASE', '编辑器已有导入进行中，不替代用户操作。', {
          field: 'operation',
        });
      this.importing = importing = true;
      const result = await importLayerPack(this.store, {
        directory: request.directory,
        targetCompositionId: request.compositionId,
        signal,
      });
      if (!result) throw problem('CANCELLED', '导入已取消。');
      // The importer owns the commit fence. Never report cancellation after a successful publication.
      return this.success(result);
    } catch (e) {
      if (e instanceof CoreV2Error) return this.failure(e);
      if (original && this.base !== original)
        return this.failure(
          problem(
            this.base.id === original.id ? 'STALE_BASE' : 'CONTEXT_STALE',
            '导入期间工程已改变，结果未提交。',
            { field: this.base.id === original.id ? 'revision' : 'projectId' },
          ),
        );
      if (
        signal.aborted ||
        (e instanceof DOMException && e.name === 'AbortError')
      )
        return this.failure(problem('CANCELLED', '分层包导入已取消。'));
      return this.failure(e, 'COMMAND_REJECTION', 'import');
    } finally {
      if (importing) this.importing = false;
    }
  }
  async renderFrame(raw: unknown, options: { signal?: AbortSignal } = {}) {
    let renderer: OutputFrameRenderer | undefined;
    let controller: AbortController | undefined;
    let signal: AbortSignal | undefined;
    try {
      const request = this.parse(renderRequest, raw);
      this.owner(request);
      if (this.renderAbort)
        throw problem('STALE_BASE', '已有帧渲染进行中。', {
          field: 'operation',
        });
      const c = this.base.compositions.find(
        (c) => c.id === request.compositionId,
      );
      if (!c)
        throw problem('INVALID_REFERENCE', '渲染合成不存在。', {
          field: 'compositionId',
        });
      if (request.time > c.duration)
        throw problem('INVALID_ARGUMENTS', '渲染时间超出合成。', {
          field: 'time',
        });
      // The existing output renderer allocates a full source canvas before scaling.
      if (c.width * c.height > 16_777_216)
        throw problem('INVALID_ARGUMENTS', '此入口最多渲染16777216源像素。', {
          field: 'compositionId',
        });
      this.renderAbort = controller = new AbortController();
      signal = AbortSignal.any([
        this.lifetime.signal,
        controller.signal,
        ...(options.signal ? [options.signal] : []),
      ]);
      this.cancelled(signal);
      const scale = Math.min(
        1,
        request.maxDimension / Math.max(c.width, c.height),
      );
      renderer = new OutputFrameRenderer(this.base, c, {
        ...defaultOutputSettings(c),
        width: Math.max(2, Math.round(c.width * scale)),
        height: Math.max(2, Math.round(c.height * scale)),
        transparent: true,
      });
      await renderer.init();
      this.owner(request);
      this.cancelled(signal);
      const canvas = await renderer.draw(request.time);
      this.owner(request);
      this.cancelled(signal);
      const image = canvas.toDataURL('image/png');
      if (image.length > 8_000_000) throw Error('帧图像超过8 MB传输限制。');
      return this.success({
        compositionId: c.id,
        time: request.time,
        width: canvas.width,
        height: canvas.height,
        mimeType: 'image/png' as const,
        image,
      });
    } catch (e) {
      if (!(e instanceof CoreV2Error) && signal?.aborted) {
        if (signal.reason instanceof CoreV2Error)
          return this.failure(signal.reason);
        return this.failure(problem('CANCELLED', '帧渲染已取消。'));
      }
      return this.failure(e, 'VERIFICATION_FAILURE', 'render');
    } finally {
      renderer?.dispose();
      if (controller && this.renderAbort === controller)
        this.renderAbort = undefined;
    }
  }
}
