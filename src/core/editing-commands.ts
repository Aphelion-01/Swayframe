import { snapToFrame } from './timeline-time';
import { command, editPropertyCommand } from './command-system';
import type { Command } from './command-system';
import { newId } from './core-types';
import type { ID, AnimValue } from './core-types';
import { evaluateProperty } from './animation-engine';
import {
  activeComposition,
  findProperty,
  layerProperties,
  replaceProperty,
} from './project-model';
import type { Layer, Project, Keyframe } from './project-model';

export interface FrameRef {
  readonly propertyId: ID;
  readonly keyframeId: ID;
}
export interface CopiedFrame {
  readonly layerId: ID;
  readonly property: string;
  readonly frame: Keyframe<AnimValue>;
}
/** Inspector and Timeline record the same evaluated, frame-aligned property value. */
export function recordKeyframeCommand(
  project: Project,
  propertyId: ID,
  time: number,
): Command {
  const { property, composition } = findProperty(project, propertyId);
  const at = Math.max(
    0,
    Math.min(composition.duration, snapToFrame(time, composition.fps)),
  );
  const value = evaluateProperty(property, at);
  const existing = property.keyframes.find((k) => Math.abs(k.time - at) < 1e-8);
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
          time: at,
          value,
          interpolation: { type: 'linear' },
        },
      });
}
export function animationEdit(
  project: Project,
  propertyId: ID,
  time: number,
  value: AnimValue,
  auto = false,
): Command[] {
  const p = findProperty(project, propertyId).property;
  if (!auto || p.keyframes.length)
    return [editPropertyCommand(project, propertyId, time, value)];
  const frame = (at: number, v: AnimValue) =>
    command({
      type: 'keyframe.add',
      propertyId,
      keyframe: {
        id: newId(),
        time: at,
        value: v,
        interpolation: { type: 'linear' },
      },
    });
  return time > 0
    ? [frame(0, p.baseValue), frame(time, value)]
    : [frame(time, value)];
}
export function toggleAnimation(
  project: Project,
  propertyId: ID,
  time: number,
): Command[] {
  const p = findProperty(project, propertyId).property;
  if (!p.keyframes.length)
    return [
      command({
        type: 'keyframe.add',
        propertyId,
        keyframe: {
          id: newId(),
          time,
          value: p.baseValue,
          interpolation: { type: 'linear' },
        },
      }),
    ];
  return [
    command({
      type: 'property.setBase',
      propertyId,
      value: evaluateProperty(p, time),
    }),
    ...p.keyframes.map((k) =>
      command({ type: 'keyframe.delete', propertyId, keyframeId: k.id }),
    ),
  ];
}
export function cloneLayer(source: Layer): Layer {
  let copy = structuredClone(source);
  for (const { property } of layerProperties(copy))
    copy = replaceProperty(copy, property.id, {
      ...property,
      id: newId(),
      keyframes: property.keyframes.map((frame) => ({ ...frame, id: newId() })),
    });
  const layerId = newId();
  const graph = copy.editor?.graph;
  const nodeIds = new Map(graph?.nodes.map((n) => [n.id, newId()]));
  return {
    ...copy,
    id: layerId,
    name: `${source.name} 副本`,
    ...(copy.editor
      ? {
          editor: {
            ...copy.editor,
            masks: copy.editor.masks.map((m) => ({ ...m, id: newId() })),
            ...(copy.editor.effects
              ? {
                  effects: copy.editor.effects.map((e) => ({
                    ...e,
                    id: newId(),
                  })),
                }
              : {}),
            ...(graph
              ? {
                  graph: {
                    ...graph,
                    id: newId(),
                    owner: { type: 'layer' as const, id: layerId },
                    outputNodeId: nodeIds.get(graph.outputNodeId)!,
                    nodes: graph.nodes.map((n) => ({
                      ...n,
                      id: nodeIds.get(n.id)!,
                    })),
                    edges: graph.edges.map((e) => ({
                      ...e,
                      id: newId(),
                      from: { ...e.from, nodeId: nodeIds.get(e.from.nodeId)! },
                      to: { ...e.to, nodeId: nodeIds.get(e.to.nodeId)! },
                    })),
                  },
                }
              : {}),
          },
        }
      : {}),
  };
}

export function moveFrames(
  project: Project,
  refs: readonly FrameRef[],
  delta: number,
): Command[] {
  const c = activeComposition(project);
  const selected = refs.map((ref) => ({
    ref,
    property: findProperty(project, ref.propertyId).property,
  }));
  const moves = selected.map(({ ref, property }) => {
    const frame = property.keyframes.find((k) => k.id === ref.keyframeId);
    if (!frame) throw new Error('关键帧不存在');
    return { ref, time: frame.time + delta, property };
  });
  for (const item of moves) {
    if (item.time < -1e-8 || item.time > c.duration + 1e-8)
      throw new Error('关键帧超出合成时长');
    if (
      item.property.keyframes.some(
        (k) =>
          !refs.some((r) => r.keyframeId === k.id) &&
          Math.abs(k.time - item.time) < 1e-8,
      )
    )
      throw new Error('目标时间已有关键帧');
  }
  return moves.map(({ ref, time }) =>
    command({
      type: 'keyframe.update',
      ...ref,
      patch: { time: Math.max(0, Math.min(c.duration, time)) },
    }),
  );
}
export function copyFrames(
  project: Project,
  refs: readonly FrameRef[],
): CopiedFrame[] {
  return refs.map((ref) => {
    const p = findProperty(project, ref.propertyId);
    const frame = p.property.keyframes.find((k) => k.id === ref.keyframeId);
    if (!frame) throw new Error('关键帧不存在');
    return {
      layerId: p.layer.id,
      property: p.key,
      frame: structuredClone(frame),
    };
  });
}
export function pasteFrames(
  project: Project,
  copied: readonly CopiedFrame[],
  time: number,
  selection: readonly ID[],
  targetProperties: readonly ID[] = [],
): Command[] {
  if (!copied.length) return [];
  const c = activeComposition(project),
    origin = Math.min(...copied.map((k) => k.frame.time));
  const oneSource = new Set(copied.map((k) => k.layerId)).size === 1;
  const oneProperty =
    new Set(copied.map((k) => `${k.layerId}:${k.property}`)).size === 1;
  if (targetProperties.length && !oneProperty)
    throw Error('跨属性粘贴请只复制一个属性的关键帧');
  const kind = (v: AnimValue) =>
    typeof v === 'number'
      ? 'number'
      : Array.isArray(v)
        ? `array:${v.length}`
        : 'vec2';
  const commands: Command[] = [];
  for (const item of copied) {
    const destinations = targetProperties.length
      ? targetProperties.map((id) => {
          const found = findProperty(project, id);
          if (!c.layers.some((layer) => layer.id === found.layer.id))
            throw Error('粘贴目标属性不属于当前合成');
          return { layer: found.layer, property: found.property };
        })
      : (oneSource && selection.length ? selection : [item.layerId]).map(
          (id) => {
            const layer = c.layers.find((l) => l.id === id);
            return {
              layer,
              property:
                layer &&
                layerProperties(layer).find((p) => p.key === item.property)
                  ?.property,
            };
          },
        );
    for (const { layer, property } of destinations) {
      if (!layer) throw new Error('粘贴目标图层不存在');
      const at = Math.min(c.duration, time + item.frame.time - origin);
      if (time + item.frame.time - origin > c.duration + 1e-8)
        throw new Error('粘贴的关键帧超出合成时长');
      if (!property) throw new Error('粘贴属性不存在');
      if (kind(property.baseValue) !== kind(item.frame.value))
        throw Error('关键帧类型不兼容，无法粘贴到所选属性');
      if (layer.locked) throw Error('粘贴目标图层已锁定');
      const existing = property.keyframes.find(
        (k) => Math.abs(k.time - at) < 1e-8,
      );
      commands.push(
        existing
          ? command({
              type: 'keyframe.update',
              propertyId: property.id,
              keyframeId: existing.id,
              patch: {
                value: item.frame.value,
                interpolation: item.frame.interpolation,
              },
            })
          : command({
              type: 'keyframe.add',
              propertyId: property.id,
              keyframe: { ...item.frame, id: newId(), time: at },
            }),
      );
    }
  }
  return commands;
}
