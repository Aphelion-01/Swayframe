import type { CompositingGraph } from './compositing-graph';
import { deepFreeze, isAnimValue, newId } from './core-types';
import type { AnimValue, Color, ID, Vec2 } from './core-types';
import { projectSchema } from './project-schema';
import { transactionSchema } from './command-schema';
import { findProperty, replaceProperty } from './project-model';
import type {
  Asset,
  Composition,
  Keyframe,
  Layer,
  Project,
  Property,
  SemanticMetadata,
} from './project-model';

export interface LayerPatch {
  readonly name?: string;
  readonly visible?: boolean;
  readonly locked?: boolean;
  readonly semantic?: SemanticMetadata | null;
  readonly text?: string;
  readonly fill?: Color;
  readonly fontSize?: number;
  readonly fontFamily?: string;
}
export type CommandSpec =
  | {
      readonly type: 'graph.replace';
      readonly compositionId: ID;
      readonly layerId: ID;
      readonly graph: CompositingGraph | null;
    }
  | {
      readonly type: 'layer.replace';
      readonly compositionId: ID;
      readonly layer: Layer;
    }
  | {
      readonly type: 'composition.add';
      readonly composition: Composition;
      readonly index?: number;
    }
  | { readonly type: 'composition.remove'; readonly compositionId: ID }
  | { readonly type: 'composition.replace'; readonly composition: Composition }
  | { readonly type: 'project.activate'; readonly compositionId: ID }
  | {
      readonly type: 'layer.create';
      readonly compositionId: ID;
      readonly layer: Layer;
      readonly index?: number;
    }
  | {
      readonly type: 'layer.delete';
      readonly compositionId: ID;
      readonly layerId: ID;
    }
  | {
      readonly type: 'layer.reorder';
      readonly compositionId: ID;
      readonly layerId: ID;
      readonly toIndex: number;
    }
  | {
      readonly type: 'layer.patch';
      readonly compositionId: ID;
      readonly layerId: ID;
      readonly patch: LayerPatch;
    }
  | {
      readonly type: 'property.setBase';
      readonly propertyId: ID;
      readonly value: unknown;
    }
  | {
      readonly type: 'keyframe.add';
      readonly propertyId: ID;
      readonly keyframe: Keyframe<AnimValue>;
      readonly index?: number;
    }
  | {
      readonly type: 'keyframe.update';
      readonly propertyId: ID;
      readonly keyframeId: ID;
      readonly patch: Partial<
        Pick<Keyframe<AnimValue>, 'time' | 'value' | 'interpolation'>
      > & {
        readonly incoming?: Vec2 | null;
        readonly outgoing?: Vec2 | null;
        readonly spatialIncoming?: Vec2 | null;
        readonly spatialOutgoing?: Vec2 | null;
      };
    }
  | {
      readonly type: 'keyframe.delete';
      readonly propertyId: ID;
      readonly keyframeId: ID;
    }
  | {
      readonly type: 'asset.add';
      readonly asset: Asset;
      readonly index?: number;
    }
  | { readonly type: 'asset.remove'; readonly assetId: ID }
  | { readonly type: 'asset.replace'; readonly asset: Asset }
  | { readonly type: 'project.replace'; readonly project: Project };
export type Command = CommandSpec & { readonly id: ID };
export interface Transaction {
  readonly id: ID;
  readonly label: string;
  readonly source: 'human' | 'agent' | 'system';
  readonly commands: readonly Command[];
  readonly createdAt: number;
}
export interface AppliedCommand {
  readonly command: Command;
  readonly inverse: Command;
}
export interface HistoryEntry {
  readonly transaction: Transaction;
  readonly applied: readonly AppliedCommand[];
  readonly workspace?: { redo: () => void; undo: () => void };
}
export type TransactionResult =
  | { readonly ok: true; readonly transactionId: ID }
  | { readonly ok: false; readonly error: string };
export const command = (spec: CommandSpec): Command => ({
  ...spec,
  id: newId(),
});
export const transaction = (
  label: string,
  source: Transaction['source'],
  commands: readonly Command[],
): Transaction => ({
  id: newId(),
  label,
  source,
  commands,
  createdAt: Date.now(),
});

function updateComposition(
  project: Project,
  id: ID,
  update: (c: Composition) => Composition,
): Project {
  if (!project.compositions.some((c) => c.id === id))
    throw new Error('合成不存在');
  return {
    ...project,
    compositions: project.compositions.map((c) =>
      c.id === id ? update(c) : c,
    ),
  };
}
function layerAt(
  project: Project,
  compositionId: ID,
  layerId: ID,
): { layer: Layer; index: number } {
  const c = project.compositions.find((item) => item.id === compositionId);
  const index = c?.layers.findIndex((layer) => layer.id === layerId) ?? -1;
  if (!c || index < 0) throw new Error('图层不存在');
  return { layer: c.layers[index]!, index };
}
function updateLayer(
  project: Project,
  compositionId: ID,
  layerId: ID,
  update: (layer: Layer) => Layer,
): Project {
  layerAt(project, compositionId, layerId);
  return updateComposition(project, compositionId, (c) => ({
    ...c,
    layers: c.layers.map((layer) =>
      layer.id === layerId ? update(layer) : layer,
    ),
  }));
}
function updateProperty(
  project: Project,
  id: ID,
  update: (p: Property<AnimValue>) => Property<AnimValue>,
): Project {
  const location = findProperty(project, id);
  if (location.layer.locked) throw new Error('图层已锁定');
  const p = update(location.property);
  return updateLayer(
    project,
    location.composition.id,
    location.layer.id,
    (layer) => {
      return replaceProperty(layer, id, p);
    },
  );
}
function currentEditorInverse(
  layer: Layer,
  c: Extract<Command, { type: 'layer.patch' }>,
  inverse: Record<string, unknown>,
): Command {
  return layer.editor && (c.patch.fill || c.patch.fontSize !== undefined)
    ? command({ type: 'layer.replace', compositionId: c.compositionId, layer })
    : command({
        type: 'layer.patch',
        compositionId: c.compositionId,
        layerId: c.layerId,
        patch: inverse as LayerPatch,
      });
}
function indexIn(index: number, length: number): void {
  if (!Number.isInteger(index) || index < 0 || index > length)
    throw new Error('索引超出范围');
}
export function assertProjectState(project: Project): void {
  projectSchema.parse(project);
}
function applyCommand(
  project: Project,
  c: Command,
): { project: Project; inverse: Command } {
  switch (c.type) {
    case 'graph.replace': {
      const { layer } = layerAt(project, c.compositionId, c.layerId);
      if (layer.locked) throw new Error('图层已锁定');
      if (!layer.editor) throw new Error('图层属性容器不存在');
      if (
        c.graph &&
        (c.graph.owner.type !== 'layer' || c.graph.owner.id !== layer.id)
      )
        throw new Error('图所属图层不匹配');
      return {
        project: updateLayer(project, c.compositionId, c.layerId, (current) => {
          const {
            graph: _graph,
            effects: _effects,
            ...editor
          } = current.editor!;
          void _graph;
          void _effects;
          return {
            ...current,
            editor: { ...editor, ...(c.graph ? { graph: c.graph } : {}) },
          };
        }),
        inverse: layer.editor.effects
          ? command({
              type: 'layer.replace',
              compositionId: c.compositionId,
              layer,
            })
          : command({
              type: 'graph.replace',
              compositionId: c.compositionId,
              layerId: c.layerId,
              graph: layer.editor.graph ?? null,
            }),
      };
    }
    case 'layer.replace': {
      const { layer } = layerAt(project, c.compositionId, c.layer.id);
      return {
        project: updateLayer(
          project,
          c.compositionId,
          c.layer.id,
          () => c.layer,
        ),
        inverse: command({
          type: 'layer.replace',
          compositionId: c.compositionId,
          layer,
        }),
      };
    }
    case 'composition.add': {
      const index = c.index ?? project.compositions.length;
      indexIn(index, project.compositions.length);
      const compositions = [...project.compositions];
      compositions.splice(index, 0, c.composition);
      return {
        project: { ...project, compositions },
        inverse: command({
          type: 'composition.remove',
          compositionId: c.composition.id,
        }),
      };
    }
    case 'composition.remove': {
      const index = project.compositions.findIndex(
        (v) => v.id === c.compositionId,
      );
      if (index < 0) throw new Error('合成不存在');
      return {
        project: {
          ...project,
          compositions: project.compositions.filter(
            (v) => v.id !== c.compositionId,
          ),
        },
        inverse: command({
          type: 'composition.add',
          composition: project.compositions[index]!,
          index,
        }),
      };
    }
    case 'composition.replace': {
      const previous = project.compositions.find(
        (v) => v.id === c.composition.id,
      );
      if (!previous) throw new Error('合成不存在');
      return {
        project: updateComposition(
          project,
          c.composition.id,
          () => c.composition,
        ),
        inverse: command({
          type: 'composition.replace',
          composition: previous,
        }),
      };
    }
    case 'project.activate':
      return {
        project: { ...project, activeCompositionId: c.compositionId },
        inverse: command({
          type: 'project.activate',
          compositionId: project.activeCompositionId,
        }),
      };
    case 'project.replace':
      return {
        project: c.project,
        inverse: command({ type: 'project.replace', project }),
      };
    case 'asset.add': {
      const index = c.index ?? project.assets.length;
      indexIn(index, project.assets.length);
      const assets = [...project.assets];
      assets.splice(index, 0, c.asset);
      return {
        project: { ...project, assets },
        inverse: command({ type: 'asset.remove', assetId: c.asset.id }),
      };
    }
    case 'asset.replace': {
      const old = project.assets.find((a) => a.id === c.asset.id);
      if (!old) throw new Error('素材不存在');
      return {
        project: {
          ...project,
          assets: project.assets.map((a) =>
            a.id === c.asset.id ? c.asset : a,
          ),
        },
        inverse: command({ type: 'asset.replace', asset: old }),
      };
    }
    case 'asset.remove': {
      const index = project.assets.findIndex((asset) => asset.id === c.assetId);
      if (index < 0) throw new Error('素材不存在');
      return {
        project: {
          ...project,
          assets: project.assets.filter((a) => a.id !== c.assetId),
        },
        inverse: command({
          type: 'asset.add',
          asset: project.assets[index]!,
          index,
        }),
      };
    }
    case 'layer.create': {
      const composition = project.compositions.find(
        (item) => item.id === c.compositionId,
      );
      if (!composition) throw new Error('合成不存在');
      const index = c.index ?? composition.layers.length;
      indexIn(index, composition.layers.length);
      return {
        project: updateComposition(project, c.compositionId, (item) => {
          const layers = [...item.layers];
          layers.splice(index, 0, c.layer);
          return { ...item, layers };
        }),
        inverse: command({
          type: 'layer.delete',
          compositionId: c.compositionId,
          layerId: c.layer.id,
        }),
      };
    }
    case 'layer.delete': {
      const { layer, index } = layerAt(project, c.compositionId, c.layerId);
      return {
        project: updateComposition(project, c.compositionId, (item) => ({
          ...item,
          layers: item.layers.filter((l) => l.id !== c.layerId),
        })),
        inverse: command({
          type: 'layer.create',
          compositionId: c.compositionId,
          layer,
          index,
        }),
      };
    }
    case 'layer.reorder': {
      const { layer, index } = layerAt(project, c.compositionId, c.layerId);
      return {
        project: updateComposition(project, c.compositionId, (item) => {
          indexIn(c.toIndex, item.layers.length - 1);
          const layers = [...item.layers];
          layers.splice(index, 1);
          layers.splice(c.toIndex, 0, layer);
          return { ...item, layers };
        }),
        inverse: command({
          type: 'layer.reorder',
          compositionId: c.compositionId,
          layerId: c.layerId,
          toIndex: index,
        }),
      };
    }
    case 'layer.patch': {
      const { layer } = layerAt(project, c.compositionId, c.layerId);
      if (
        (c.patch.text !== undefined ||
          c.patch.fontSize !== undefined ||
          c.patch.fontFamily !== undefined) &&
        layer.type !== 'text'
      )
        throw new Error('此图层不是文字图层');
      if (c.patch.fill !== undefined && layer.type === 'image')
        throw new Error('图片图层不支持填充颜色');
      const inverse: Record<string, unknown> = {};
      for (const key of Object.keys(c.patch)) {
        if (key === 'semantic') inverse[key] = layer.semantic ?? null;
        else if (key in layer) inverse[key] = layer[key as keyof Layer];
        else throw new Error('图层修改参数无效');
      }
      const next = updateLayer(
        project,
        c.compositionId,
        c.layerId,
        (current) => {
          const { semantic: previous, ...rest } = current;
          const { semantic, ...patch } = c.patch;
          return {
            ...rest,
            ...patch,
            ...(current.editor && (patch.fill || patch.fontSize !== undefined)
              ? {
                  editor: {
                    ...current.editor,
                    properties: {
                      ...current.editor.properties,
                      ...(patch.fill && current.editor.properties.fill
                        ? {
                            fill: {
                              ...current.editor.properties.fill,
                              baseValue: [
                                patch.fill.r,
                                patch.fill.g,
                                patch.fill.b,
                                patch.fill.a,
                              ],
                            },
                          }
                        : {}),
                      ...(patch.fontSize !== undefined &&
                      current.editor.properties.fontSize
                        ? {
                            fontSize: {
                              ...current.editor.properties.fontSize,
                              baseValue: patch.fontSize,
                            },
                          }
                        : {}),
                    },
                  },
                }
              : {}),
            ...(semantic === null
              ? {}
              : (semantic ?? previous)
                ? { semantic: semantic ?? previous }
                : {}),
          } as Layer;
        },
      );
      return {
        project: next,
        inverse: currentEditorInverse(layer, c, inverse),
      };
    }
    case 'property.setBase': {
      const previous = findProperty(project, c.propertyId).property.baseValue;
      if (!isAnimValue(c.value)) throw new Error('属性值必须有限');
      return {
        project: updateProperty(project, c.propertyId, (p) => ({
          ...p,
          baseValue: c.value as AnimValue,
        })),
        inverse: command({
          type: 'property.setBase',
          propertyId: c.propertyId,
          value: previous,
        }),
      };
    }
    case 'keyframe.add': {
      return {
        project: updateProperty(project, c.propertyId, (p) => {
          const index = c.index ?? p.keyframes.length;
          indexIn(index, p.keyframes.length);
          const keyframes = [...p.keyframes];
          keyframes.splice(index, 0, c.keyframe);
          return { ...p, keyframes };
        }),
        inverse: command({
          type: 'keyframe.delete',
          propertyId: c.propertyId,
          keyframeId: c.keyframe.id,
        }),
      };
    }
    case 'keyframe.update': {
      const previous = findProperty(
        project,
        c.propertyId,
      ).property.keyframes.find((k) => k.id === c.keyframeId);
      if (!previous) throw new Error('关键帧不存在');
      return {
        project: updateProperty(project, c.propertyId, (p) => ({
          ...p,
          keyframes: p.keyframes.map((k) =>
            k.id === c.keyframeId
              ? (() => {
                  const next = { ...k, ...c.patch };
                  for (const key of [
                    'incoming',
                    'outgoing',
                    'spatialIncoming',
                    'spatialOutgoing',
                  ] as const)
                    if (next[key] == null) delete next[key];
                  return next as Keyframe<AnimValue>;
                })()
              : k,
          ),
        })),
        inverse: command({
          type: 'keyframe.update',
          propertyId: c.propertyId,
          keyframeId: c.keyframeId,
          patch: {
            time: previous.time,
            value: previous.value,
            interpolation: previous.interpolation,
            ...(c.patch.incoming !== undefined
              ? { incoming: previous.incoming ?? null }
              : {}),
            ...(c.patch.spatialIncoming !== undefined
              ? { spatialIncoming: previous.spatialIncoming ?? null }
              : {}),
            ...(c.patch.spatialOutgoing !== undefined
              ? { spatialOutgoing: previous.spatialOutgoing ?? null }
              : {}),
            ...(c.patch.outgoing !== undefined
              ? { outgoing: previous.outgoing ?? null }
              : {}),
          },
        }),
      };
    }
    case 'keyframe.delete': {
      const p = findProperty(project, c.propertyId).property;
      const index = p.keyframes.findIndex((k) => k.id === c.keyframeId);
      if (index < 0) throw new Error('关键帧不存在');
      return {
        project: updateProperty(project, c.propertyId, (value) => ({
          ...value,
          keyframes: value.keyframes.filter((k) => k.id !== c.keyframeId),
        })),
        inverse: command({
          type: 'keyframe.add',
          propertyId: c.propertyId,
          keyframe: p.keyframes[index]!,
          index,
        }),
      };
    }
    default:
      throw new Error('未知命令');
  }
}
export function editPropertyCommand(
  project: Project,
  propertyId: ID,
  time: number,
  value: unknown,
): Command {
  if (!isAnimValue(value)) throw new Error('属性值必须是有限数值或二维坐标');
  const p = findProperty(project, propertyId).property;
  if (p.keyframes.length === 0)
    return command({ type: 'property.setBase', propertyId, value });
  const existing = p.keyframes.find(
    (frame) => Math.abs(frame.time - time) < 1e-8,
  );
  return existing
    ? command({
        type: 'keyframe.update',
        propertyId,
        keyframeId: existing.id,
        patch: { value },
      })
    : command({
        type: 'keyframe.add',
        propertyId,
        keyframe: {
          id: newId(),
          time,
          value,
          interpolation: { type: 'linear' },
        },
      });
}

export class CommandSystem {
  #project: Project;
  #undo: HistoryEntry[] = [];
  #redo: HistoryEntry[] = [];
  #listeners = new Set<() => void>();
  constructor(project: Project) {
    assertProjectState(project);
    this.#project = deepFreeze(structuredClone(project));
  }
  getSnapshot = (): Project => this.#project;
  get undoStack(): readonly HistoryEntry[] {
    return [...this.#undo];
  }
  get redoStack(): readonly HistoryEntry[] {
    return [...this.#redo];
  }
  subscribe = (callback: () => void): (() => void) => {
    this.#listeners.add(callback);
    return () => this.#listeners.delete(callback);
  };
  #emit(): void {
    for (const callback of this.#listeners) {
      try {
        callback();
      } catch (error) {
        console.error('Command subscriber failed', error);
      }
    }
  }
  executeTransaction(tx: Transaction): TransactionResult {
    try {
      if (
        !tx.id ||
        !tx.label ||
        tx.commands.length === 0 ||
        new Set(tx.commands.map((c) => c.id)).size !== tx.commands.length
      )
        throw new Error('事务无效');
      const owned = transactionSchema.parse(tx);
      if (
        [...this.#undo, ...this.#redo].some(
          (entry) => entry.transaction.id === owned.id,
        )
      )
        throw new Error('事务编号重复');
      let project = this.#project;
      const applied: AppliedCommand[] = [];
      for (const c of owned.commands) {
        if (
          c.type === 'layer.replace' &&
          layerAt(project, c.compositionId, c.layer.id).layer.locked
        )
          throw new Error('图层已锁定');
        const result = applyCommand(project, c);
        project = result.project;
        applied.push({ command: c, inverse: result.inverse });
      }
      assertProjectState(project);
      this.#project = deepFreeze(project);
      this.#undo.push(deepFreeze({ transaction: owned, applied }));
      this.#redo = [];
      this.#emit();
      return { ok: true, transactionId: owned.id };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '命令执行失败',
      };
    }
  }
  /** Application-only reference commands share ordering and Undo, never modify Scene. */
  executeWorkspaceCommand(
    label: string,
    redo: () => void,
    undo: () => void,
  ): TransactionResult {
    const tx = transaction(label, 'human', []);
    redo();
    this.#undo.push({
      transaction: tx,
      applied: [],
      workspace: { redo, undo },
    });
    this.#redo = [];
    this.#emit();
    return { ok: true, transactionId: tx.id };
  }
  /** Merge only explicitly identified adjacent human actions (keyboard repeat). */
  coalesceRecent(previousId: ID, currentId: ID): boolean {
    const a = this.#undo.at(-2),
      b = this.#undo.at(-1);
    if (
      !a ||
      !b ||
      a.workspace ||
      b.workspace ||
      this.#redo.length ||
      a.transaction.id !== previousId ||
      b.transaction.id !== currentId ||
      a.transaction.source !== 'human' ||
      b.transaction.source !== 'human' ||
      a.transaction.label !== b.transaction.label
    )
      return false;
    this.#undo.splice(
      -2,
      2,
      deepFreeze({
        transaction: {
          ...a.transaction,
          commands: [...a.transaction.commands, ...b.transaction.commands],
        },
        applied: [...a.applied, ...b.applied],
      }),
    );
    this.#emit();
    return true;
  }
  undo(): TransactionResult {
    const entry = this.#undo.at(-1);
    if (!entry) return { ok: false, error: '没有可撤销的操作' };
    entry.workspace?.undo();
    let project = this.#project;
    for (const item of [...entry.applied].reverse())
      project = applyCommand(project, item.inverse).project;
    assertProjectState(project);
    this.#project = deepFreeze(project);
    this.#undo.pop();
    this.#redo.push(entry);
    this.#emit();
    return { ok: true, transactionId: entry.transaction.id };
  }
  redo(): TransactionResult {
    const entry = this.#redo.at(-1);
    if (!entry) return { ok: false, error: '没有可重做的操作' };
    entry.workspace?.redo();
    let project = this.#project;
    for (const item of entry.applied)
      project = applyCommand(project, item.command).project;
    assertProjectState(project);
    this.#project = deepFreeze(project);
    this.#redo.pop();
    this.#undo.push(entry);
    this.#emit();
    return { ok: true, transactionId: entry.transaction.id };
  }
  replaceProject(project: Project): TransactionResult {
    const result = this.executeTransaction(
      transaction('打开工程', 'system', [
        command({ type: 'project.replace', project }),
      ]),
    );
    if (result.ok) {
      this.#undo = [];
      this.#redo = [];
      this.#emit();
    }
    return result;
  }
  beginEdit(
    label: string,
    source: Transaction['source'],
  ): {
    commit: (commands: readonly Command[]) => TransactionResult;
    cancel: () => void;
  } {
    let closed = false;
    return {
      commit: (commands) => {
        if (closed) throw new Error('临时编辑已结束');
        closed = true;
        return this.executeTransaction(transaction(label, source, commands));
      },
      cancel: () => {
        closed = true;
      },
    };
  }
}
