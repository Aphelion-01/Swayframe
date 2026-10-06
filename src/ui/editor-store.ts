import type { TextMeasure } from '../core/text-geometry';
import { createTransformContext } from '../core/transform-resolvers';
import { transformItems } from '../core/transform-operations';
import type { TransformContext } from '../core/transform-context';
import {
  readTransformSettings,
  writeTransformSettings,
} from './transform-settings';
import type { TransformInteractionSettings } from '../core/transform-context';
import { MotionCurveClipboard } from '../core/motion-curve-operations';
import { projectWithPropertyPreviews } from '../core/property-preview';
import { createRenderSnapshot } from '../core/renderer-core';
import { inverse2D } from '../core/matrix2d';
import type { Matrix2D } from '../core/matrix2d';
import {
  transformEditCommands,
  deleteLayerCommands,
} from '../core/transform-editing';
import { parentCommands } from '../core/composition-editing';
import { displayName } from './labels';
import {
  animationEdit,
  toggleAnimation,
  cloneLayer,
  copyFrames,
  pasteFrames,
  moveFrames,
} from '../core/editing-commands';
import type { FrameRef, CopiedFrame } from '../core/editing-commands';
import { command } from '../core/command-system';
import { findProperty, layerProperties } from '../core/project-model';
import type { Layer, Asset } from '../core/project-model';
import type { ID, Seconds, Vec2, AnimValue } from '../core/core-types';
import {
  editPropertyCommand,
  CommandSystem,
  transaction,
} from '../core/command-system';
import type {
  Command,
  Transaction,
  TransactionResult,
} from '../core/command-system';
import { evaluateProperty } from '../core/animation-engine';
import { activeComposition } from '../core/project-model';
import type { Project, Property } from '../core/project-model';
import type { PositionPreview } from '../core/renderer-core';
import { loadProject, saveProject } from '../core/project-io';

export interface EditorView {
  readonly project: Project;
  readonly transformSettings: TransformInteractionSettings;
  readonly time: Seconds;
  readonly playing: boolean;
  readonly selection: readonly ID[];
  readonly zoom: number;
  readonly autoKeyframes: boolean;
  readonly frames: readonly FrameRef[];
  readonly timelineZoom: number;
  readonly propertyFilter:
    'all' | 'animated' | 'position' | 'scale' | 'rotation' | 'opacity';
  readonly preview?: PositionPreview;
  readonly propertyPreviews?: readonly Property<AnimValue>[];
  readonly propertyPreview?: {
    readonly id: ID;
    readonly property: Property<AnimValue>;
  };
  readonly graphSelection?: {
    readonly layerId: string;
    readonly nodeIds: readonly string[];
  };
  readonly status: string;
  readonly error: boolean;
}
export class EditorStore {
  readonly commands: CommandSystem;
  textMeasure?: TextMeasure;
  readonly motionCurveClipboard = new MotionCurveClipboard();
  #view: EditorView;
  #renderPreview?: Project;
  #serializedProject?: Project;
  #serializedData = '';
  #listeners = new Set<() => void>();
  #layerClipboard: readonly Layer[] = [];
  #assetClipboard: readonly Asset[] = [];
  #frameClipboard: readonly CopiedFrame[] = [];
  #drag?: {
    layerId: ID;
    context: TransformContext;
    pointer: Vec2;
    position: Vec2;
    others: readonly { layerId: ID; position: Vec2 }[];
    snapshot: Project;
    time: number;
    vectors: Readonly<Record<string, Matrix2D>>;
    edit: ReturnType<CommandSystem['beginEdit']>;
  };
  constructor(project: Project) {
    this.commands = new CommandSystem(project);
    this.#view = {
      project: this.commands.getSnapshot(),
      transformSettings: readTransformSettings(),
      time: 0,
      playing: false,
      selection: [],
      zoom: 1,
      autoKeyframes: false,
      frames: [],
      timelineZoom: 1,
      propertyFilter: 'all',
      status: '准备就绪',
      error: false,
    };
    this.commands.subscribe(() => {
      this.#renderPreview = undefined;
      const project = this.commands.getSnapshot();
      const c = activeComposition(project);
      this.#set({
        project,
        graphSelection:
          this.#view.graphSelection &&
          c.layers.some((l) => l.id === this.#view.graphSelection?.layerId)
            ? {
                ...this.#view.graphSelection,
                nodeIds: this.#view.graphSelection.nodeIds.filter((id) =>
                  c.layers
                    .find((l) => l.id === this.#view.graphSelection?.layerId)
                    ?.editor?.graph?.nodes.some((n) => n.id === id),
                ),
              }
            : undefined,
        propertyPreview: undefined,
        propertyPreviews: undefined,
        frames: this.#view.frames.filter((ref) => {
          try {
            return !!findProperty(
              project,
              ref.propertyId,
            ).property.keyframes.some((k) => k.id === ref.keyframeId);
          } catch {
            return false;
          }
        }),
        time: Math.min(this.#view.time, c.duration),
        selection: this.#view.selection.filter((id) =>
          c.layers.some((layer) => layer.id === id),
        ),
      });
    });
  }
  getSnapshot = (): EditorView => this.#view;
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  #set(patch: Partial<EditorView>): void {
    this.#view = { ...this.#view, ...patch };
    for (const listener of this.#listeners) listener();
  }
  setTransformSettings(
    patch: Partial<TransformInteractionSettings>,
    persist = true,
  ): void {
    this.cancelDrag();
    const settings = Object.freeze({
      ...this.#view.transformSettings,
      ...patch,
    });
    if (persist) writeTransformSettings(settings);
    this.#set({ transformSettings: settings });
  }
  commitTransformReference(
    patch: Partial<TransformInteractionSettings>,
    before = this.#view.transformSettings,
  ): void {
    const next = { ...before, ...patch };
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    this.commands.executeWorkspaceCommand(
      '修改变换参考',
      () => this.setTransformSettings(next),
      () => this.setTransformSettings(before),
    );
  }
  setPropertyPreview(preview: EditorView['propertyPreview']): void {
    this.#renderPreview = preview
      ? projectWithPropertyPreviews(this.#view.project, [preview.property])
      : undefined;
    this.#set({ propertyPreview: preview, propertyPreviews: undefined });
  }
  setPropertyPreviews(properties?: readonly Property<AnimValue>[]): void {
    properties = properties?.map((p) =>
      Object.freeze({ ...p, keyframes: Object.freeze([...p.keyframes]) }),
    );
    this.#renderPreview = properties
      ? projectWithPropertyPreviews(this.#view.project, properties)
      : undefined;
    this.#set({ propertyPreviews: properties, propertyPreview: undefined });
  }
  /** Transient geometry/text preview; persistent changes still use Commands. */
  setLayerPreview(layer?: Layer): void {
    const project = this.#view.project;
    this.#renderPreview = layer
      ? {
          ...project,
          compositions: project.compositions.map((c) =>
            c.layers.some((l) => l.id === layer.id)
              ? {
                  ...c,
                  layers: c.layers.map((l) => (l.id === layer.id ? layer : l)),
                }
              : c,
          ),
        }
      : undefined;
    this.#set({ propertyPreview: undefined, propertyPreviews: undefined });
  }
  getRenderProject(): Project {
    return this.#renderPreview ?? this.#view.project;
  }
  setStatus(status: string, error = false): void {
    this.#set({ status, error });
  }
  selectGraphNodes(layerId: string, nodeIds: readonly string[]): void {
    this.#set({ graphSelection: { layerId, nodeIds } });
  }
  clearGraphSelection(): void {
    this.#set({ graphSelection: undefined });
  }
  select(id: ID | null, additive = false): void {
    this.#set({
      graphSelection: undefined,
      selection: id
        ? additive
          ? this.#view.selection.includes(id)
            ? this.#view.selection.filter((item) => item !== id)
            : [...this.#view.selection, id]
          : [id]
        : [],
      frames: [],
    });
  }
  selectFrames(frames: readonly FrameRef[]): void {
    this.#set({ frames: [...frames] });
  }
  selectAll(): void {
    this.#set({
      selection: activeComposition(this.#view.project).layers.map((l) => l.id),
      frames: [],
    });
  }
  setAutoKeyframes(value: boolean): void {
    this.#set({ autoKeyframes: value });
  }
  setPropertyFilter(value: EditorView['propertyFilter']): void {
    this.#set({ propertyFilter: value });
  }
  setTimelineZoom(value: number): void {
    this.#set({ timelineZoom: Math.max(1, Math.min(8, value)) });
  }
  selectFrame(ref: FrameRef, additive = false): void {
    const exists = this.#view.frames.some(
      (r) => r.keyframeId === ref.keyframeId,
    );
    const layerId = findProperty(this.#view.project, ref.propertyId).layer.id;
    this.#set({
      selection: additive
        ? [...new Set([...this.#view.selection, layerId])]
        : [layerId],
      frames: additive
        ? exists
          ? this.#view.frames.filter((r) => r.keyframeId !== ref.keyframeId)
          : [...this.#view.frames, ref]
        : exists
          ? this.#view.frames
          : [ref],
    });
  }
  togglePropertyAnimation(id: ID): void {
    this.run(
      '切换属性动画',
      toggleAnimation(this.#view.project, id, this.#view.time),
    );
  }
  deleteSelected(): void {
    const c = activeComposition(this.#view.project);
    const commands = this.#view.frames.length
      ? this.#view.frames.map((ref) =>
          command({ type: 'keyframe.delete', ...ref }),
        )
      : deleteLayerCommands(
          this.#view.project,
          c,
          this.#view.selection,
          this.#view.time,
          parentCommands,
        );
    if (commands.length) {
      const result = this.run('删除选中内容', commands);
      if (result.ok) this.#set({ frames: [] });
    }
  }
  deleteLayers(): void {
    try {
      const c = activeComposition(this.#view.project),
        commands = deleteLayerCommands(
          this.#view.project,
          c,
          this.#view.selection,
          this.#view.time,
          parentCommands,
        );
      if (commands.length) this.run('删除图层', commands);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : '删除失败', true);
    }
  }
  copySelection(): void {
    if (this.#view.frames.length) {
      this.#frameClipboard = copyFrames(this.#view.project, this.#view.frames);
      this.#layerClipboard = [];
      this.setStatus(`已复制 ${this.#frameClipboard.length} 个关键帧`);
    } else {
      this.#layerClipboard = activeComposition(
        this.#view.project,
      ).layers.filter((l) => this.#view.selection.includes(l.id));
      this.#frameClipboard = [];
      this.#assetClipboard = this.#view.project.assets.filter((asset) =>
        this.#layerClipboard.some(
          (layer) => layer.type === 'image' && layer.assetId === asset.id,
        ),
      );
      this.setStatus(`已复制 ${this.#layerClipboard.length} 个图层`);
    }
  }
  pasteSelection(): void {
    try {
      if (this.#frameClipboard.length) {
        const commands = pasteFrames(
          this.#view.project,
          this.#frameClipboard,
          this.#view.time,
          this.#view.selection,
        );
        if (commands.length) this.run('粘贴关键帧', commands);
      } else {
        const c = activeComposition(this.#view.project),
          clones = this.#layerClipboard.map((layer) => ({
            ...cloneLayer(layer),
            name: `${displayName(layer.name)} 副本`,
          }));
        const layers = clones.map((layer, index) => {
          const source = this.#layerClipboard[index]!,
            parentIndex = this.#layerClipboard.findIndex(
              (l) => l.id === source.editor?.parentId,
            ),
            parentId =
              parentIndex >= 0
                ? clones[parentIndex]!.id
                : source.editor?.parentId;
          return layer.editor
            ? {
                ...layer,
                editor: {
                  ...layer.editor,
                  parentId:
                    (parentId && c.layers.some((l) => l.id === parentId)) ||
                    parentIndex >= 0
                      ? (parentId ?? null)
                      : null,
                },
              }
            : layer;
        });
        if (layers.length) {
          const result = this.run('粘贴图层', [
            ...this.#assetClipboard
              .filter(
                (asset) =>
                  !this.#view.project.assets.some(
                    (existing) => existing.id === asset.id,
                  ),
              )
              .map((asset) => command({ type: 'asset.add', asset })),
            ...layers.map((layer) =>
              command({ type: 'layer.create', compositionId: c.id, layer }),
            ),
          ]);
          if (result.ok)
            this.#set({ selection: layers.map((l) => l.id), frames: [] });
        }
      }
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : '粘贴失败', true);
    }
  }
  duplicateSelection(): void {
    if (this.#view.frames.length) {
      try {
        const copied = copyFrames(this.#view.project, this.#view.frames),
          c = activeComposition(this.#view.project);
        this.run(
          '复制关键帧',
          pasteFrames(
            this.#view.project,
            copied,
            Math.min(...copied.map((k) => k.frame.time)) + 1 / c.fps,
            [],
          ),
        );
      } catch (error) {
        this.setStatus(
          error instanceof Error ? error.message : '复制失败',
          true,
        );
      }
      return;
    }
    this.copySelection();
    this.pasteSelection();
  }
  moveSelectedFrames(delta: number): void {
    try {
      if (this.#view.frames.length && Math.abs(delta) > 1e-8)
        this.run(
          '移动关键帧',
          moveFrames(this.#view.project, this.#view.frames, delta),
        );
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : '移动失败', true);
    }
  }
  jumpFrame(direction: -1 | 1): void {
    const c = activeComposition(this.#view.project);
    const times = c.layers
      .filter(
        (l) =>
          this.#view.selection.length === 0 ||
          this.#view.selection.includes(l.id),
      )
      .flatMap((l) =>
        layerProperties(l).flatMap(({ property }) =>
          property.keyframes.map((k) => k.time),
        ),
      );
    const next = times
      .filter((t) =>
        direction < 0 ? t < this.#view.time - 1e-8 : t > this.#view.time + 1e-8,
      )
      .sort((a, b) => (direction < 0 ? b - a : a - b))[0];
    if (next !== undefined) {
      this.setPlaying(false);
      this.setTime(next);
    }
  }
  nudge(dx: number, dy: number): void {
    const snapshot = createRenderSnapshot(
        activeComposition(this.#view.project),
        this.#view.time,
        this.#view.selection,
        undefined,
        this.#view.project,
      ),
      context = createTransformContext(
        snapshot,
        this.#view.selection,
        this.#view.transformSettings,
        this.textMeasure,
      );
    if (
      ![...context.initialTransforms.values()].some(
        (l) => l.source.editor?.is3D,
      )
    ) {
      try {
        const delta = {
          x: context.basis.x.x * dx + context.basis.y.x * dy,
          y: context.basis.x.y * dx + context.basis.y.y * dy,
        };
        const commands = transformEditCommands(
          this.#view.project,
          snapshot,
          transformItems(context, { kind: 'move', delta }),
          'move',
          this.#view.time,
          this.#view.autoKeyframes,
        );
        if (commands.length) this.run('微调图层位置', commands);
      } catch (error) {
        this.setStatus(
          error instanceof Error ? error.message : '无法计算变换',
          true,
        );
      }
      return;
    }
    const c = activeComposition(this.#view.project);
    const commands = c.layers
      .filter((l) => this.#view.selection.includes(l.id) && !l.locked)
      .flatMap((l) => {
        const p = evaluateProperty(l.transform.position, this.#view.time);
        return animationEdit(
          this.#view.project,
          l.transform.position.id,
          this.#view.time,
          { x: p.x + dx, y: p.y + dy },
          this.#view.autoKeyframes,
        );
      });
    if (commands.length) this.run('微调图层位置', commands);
  }
  align(
    mode:
      | 'left'
      | 'center'
      | 'right'
      | 'top'
      | 'middle'
      | 'bottom'
      | 'horizontal'
      | 'vertical',
  ): void {
    const c = activeComposition(this.#view.project),
      layers = c.layers.filter(
        (l) => this.#view.selection.includes(l.id) && !l.locked,
      );
    const horizontal = ['left', 'center', 'right', 'horizontal'].includes(mode);
    const items = layers.map((layer) => {
      const position = evaluateProperty(
          layer.transform.position,
          this.#view.time,
        ),
        scale = evaluateProperty(layer.transform.scale, this.#view.time),
        angle =
          (evaluateProperty(layer.transform.rotation, this.#view.time) *
            Math.PI) /
          180;
      return {
        layer,
        position,
        extent: horizontal
          ? (Math.abs(layer.width * scale.x * Math.cos(angle)) +
              Math.abs(layer.height * scale.y * Math.sin(angle))) /
            2
          : (Math.abs(layer.width * scale.x * Math.sin(angle)) +
              Math.abs(layer.height * scale.y * Math.cos(angle))) /
            2,
      };
    });
    const axis = horizontal ? 'x' : 'y',
      size = horizontal ? c.width : c.height;
    const distributed = mode === 'horizontal' || mode === 'vertical';
    if (distributed && items.length < 3) {
      this.setStatus('分布需要至少选择三个图层', true);
      return;
    }
    items.sort((a, b) => a.position[axis] - b.position[axis]);
    const first = items[0]?.position[axis] ?? 0,
      last = items.at(-1)?.position[axis] ?? size;
    const commands = items.flatMap((item, index) => {
      const value = distributed
        ? first + ((last - first) * index) / (items.length - 1)
        : mode === 'left' || mode === 'top'
          ? item.extent
          : mode === 'right' || mode === 'bottom'
            ? size - item.extent
            : size / 2;
      return animationEdit(
        this.#view.project,
        item.layer.transform.position.id,
        this.#view.time,
        { ...item.position, [axis]: value },
        this.#view.autoKeyframes,
      );
    });
    if (commands.length) this.run('对齐或分布图层', commands);
  }

  setTime(time: Seconds): void {
    if (Number.isFinite(time))
      this.#set({
        time: Math.max(
          0,
          Math.min(activeComposition(this.#view.project).duration, time),
        ),
      });
  }
  setPlaying(playing: boolean): void {
    this.#set({ playing });
  }
  setZoom(zoom: number): void {
    this.#set({ zoom: Math.max(0.25, Math.min(32, zoom)) });
  }
  run(
    label: string,
    commands: readonly Command[],
    source: Transaction['source'] = 'human',
  ): TransactionResult {
    const result = this.commands.executeTransaction(
      transaction(label, source, commands),
    );
    this.setStatus(result.ok ? label : result.error, !result.ok);
    return result;
  }
  undo(): void {
    this.cancelDrag();
    const result = this.commands.undo();
    this.setStatus(result.ok ? '已撤销' : result.error, !result.ok);
  }
  redo(): void {
    this.cancelDrag();
    const result = this.commands.redo();
    this.setStatus(result.ok ? '已重做' : result.error, !result.ok);
  }
  load(json: string): boolean {
    try {
      const project = loadProject(json);
      const result = this.commands.replaceProject(project);
      if (!result.ok) throw new Error(result.error);
      this.cancelDrag();
      this.#set({
        time: 0,
        selection: [],
        playing: false,
        timelineZoom: 1,
        propertyFilter: 'all',
        graphSelection: undefined,
        preview: undefined,
        propertyPreview: undefined,
        propertyPreviews: undefined,
      });
      this.#frameClipboard = [];
      this.#layerClipboard = [];
      this.#set({ frames: [] });
      this.setStatus('工程已打开 · 历史已清空');
      return true;
    } catch (error) {
      this.setStatus(
        error instanceof Error ? error.message : '打开工程失败',
        true,
      );
      return false;
    }
  }
  save(): string {
    const project = this.commands.getSnapshot();
    if (this.#serializedProject !== project) {
      this.#serializedData = saveProject(project);
      this.#serializedProject = project;
    }
    return this.#serializedData;
  }
  valueCommand(propertyId: ID, value: unknown): Command {
    return editPropertyCommand(
      this.#view.project,
      propertyId,
      this.#view.time,
      value,
    );
  }
  getDragTransformContext(): TransformContext | undefined {
    return this.#drag?.context;
  }
  beginDrag(layerId: ID, pointer: Vec2): void {
    this.cancelDrag();
    if (!this.#view.selection.includes(layerId)) this.select(layerId);
    this.setPlaying(false);
    const layer = activeComposition(this.#view.project).layers.find(
      (item) => item.id === layerId,
    );
    if (!layer || layer.locked) return;
    const composition = activeComposition(this.#view.project),
      snapshot = createRenderSnapshot(
        composition,
        this.#view.time,
        [],
        undefined,
        this.#view.project,
      );
    const ancestorSelected = (l: Layer) => {
      let parent = l.editor?.parentId;
      while (parent) {
        if (this.#view.selection.includes(parent)) return true;
        parent = composition.layers.find((i) => i.id === parent)?.editor
          ?.parentId;
      }
      return false;
    };
    const root = ancestorSelected(layer)
      ? (composition.layers.find(
          (l) =>
            this.#view.selection.includes(l.id) &&
            !ancestorSelected(l) &&
            !l.locked,
        ) ?? layer)
      : layer;
    const vectors = Object.fromEntries(
      snapshot.layers.map((item) => {
        const parent = snapshot.layers.find(
            (l) => l.source.id === item.source.editor?.parentId,
          ),
          m = parent?.matrix ? inverse2D(parent.matrix) : null,
          ratio = item.source.editor?.is3D
            ? (item.quad?.reduce((sum, p) => sum + p.z, 0) ?? 4000) /
              4 /
              (snapshot.camera?.zoom ?? 1000)
            : 1;
        return [
          item.source.id,
          [
            (m?.[0] ?? 1) * ratio,
            (m?.[1] ?? 0) * ratio,
            (m?.[2] ?? 0) * ratio,
            (m?.[3] ?? 1) * ratio,
            0,
            0,
          ] as Matrix2D,
        ];
      }),
    );
    this.#drag = {
      layerId: root.id,
      context: createTransformContext(
        snapshot,
        this.#view.selection,
        this.#view.transformSettings,
        this.textMeasure,
      ),
      pointer,
      vectors,
      position: evaluateProperty(root.transform.position, this.#view.time),
      others: activeComposition(this.#view.project)
        .layers.filter(
          (l) =>
            l.id !== root.id &&
            !ancestorSelected(l) &&
            this.#view.selection.includes(l.id) &&
            !l.locked,
        )
        .map((l) => ({
          layerId: l.id,
          position: evaluateProperty(l.transform.position, this.#view.time),
        })),
      snapshot: this.#view.project,
      time: this.#view.time,
      edit: this.commands.beginEdit('移动图层', 'human'),
    };
  }
  moveDrag(pointer: Vec2): void {
    if (!this.#drag) return;
    const drag = this.#drag;
    if (drag.snapshot !== this.#view.project || drag.time !== this.#view.time) {
      this.cancelDrag();
      return;
    }
    if (
      ![...drag.context.initialTransforms.values()].some((item) => item.quad)
    ) {
      try {
        const items = transformItems(drag.context, {
          kind: 'move',
          delta: {
            x: pointer.x - drag.pointer.x,
            y: pointer.y - drag.pointer.y,
          },
        });
        const values = items.map((item) => ({
          layerId: item.source.id,
          position: item.localTransform!.position,
        }));
        const primary = values.find((item) => item.layerId === drag.layerId)!;
        this.#set({
          preview: {
            ...primary,
            others: values.filter((item) => item.layerId !== primary.layerId),
          },
        });
      } catch (error) {
        this.cancelDrag();
        this.setStatus(
          error instanceof Error ? error.message : '无法计算变换',
          true,
        );
      }
      return;
    }
    const move = (id: string, p: Vec2): Vec2 => {
      const m = drag.vectors[id] ?? [1, 0, 0, 1, 0, 0],
        dx = pointer.x - drag.pointer.x,
        dy = pointer.y - drag.pointer.y;
      return { x: p.x + m[0] * dx + m[2] * dy, y: p.y + m[1] * dx + m[3] * dy };
    };
    this.#set({
      preview: {
        layerId: drag.layerId,
        position: move(drag.layerId, drag.position),
        others: drag.others.map((item) => ({
          ...item,
          position: move(item.layerId, item.position),
        })),
      },
    });
  }
  endDrag(): void {
    const drag = this.#drag;
    const preview = this.#view.preview;
    if (!drag) return;
    this.#drag = undefined;
    if (this.#view.project !== drag.snapshot || this.#view.time !== drag.time) {
      drag.edit.cancel();
      this.#set({ preview: undefined });
      this.setStatus('工程或播放头已变化，拖动已取消', true);
      return;
    }
    if (
      !preview ||
      (preview.position.x === drag.position.x &&
        preview.position.y === drag.position.y)
    )
      drag.edit.cancel();
    else {
      const layer = activeComposition(this.#view.project).layers.find(
        (item) => item.id === drag.layerId,
      )!;
      const result = drag.edit.commit([
        ...animationEdit(
          this.#view.project,
          layer.transform.position.id,
          drag.time,
          preview.position,
          this.#view.autoKeyframes,
        ),
        ...(preview.others ?? []).flatMap((item) => {
          const other = activeComposition(this.#view.project).layers.find(
            (l) => l.id === item.layerId,
          )!;
          const previous = evaluateProperty(
            other.transform.position,
            drag.time,
          );
          if (
            Math.abs(previous.x - item.position.x) < 1e-9 &&
            Math.abs(previous.y - item.position.y) < 1e-9
          )
            return [];
          return animationEdit(
            this.#view.project,
            other.transform.position.id,
            drag.time,
            item.position,
            this.#view.autoKeyframes,
          );
        }),
      ]);
      this.setStatus(result.ok ? '移动图层' : result.error, !result.ok);
    }
    this.#set({ preview: undefined });
  }
  cancelDrag(): void {
    this.#drag?.edit.cancel();
    this.#drag = undefined;
    if (this.#view.preview) this.#set({ preview: undefined });
  }
}
