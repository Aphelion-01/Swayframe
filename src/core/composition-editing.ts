import type { Project, Layer } from './project-model';
import {
  activeComposition,
  createComposition,
  createLayer,
  layerProperties,
} from './project-model';
import { command } from './command-system';
import type { Command } from './command-system';
import { cloneLayer } from './editing-commands';
import { createRenderSnapshot } from './renderer-core';
import { apply2D, inverse2D, multiply2D, identity2D } from './matrix2d';
export function parentCommands(
  project: Project,
  layerId: string,
  parentId: string | null,
  time: number,
): Command[] {
  const c = activeComposition(project),
    layer = c.layers.find((l) => l.id === layerId);
  if (!layer?.editor) throw new Error('图层不存在');
  const input = createRenderSnapshot(c, time, []);
  const oldParent = input.layers.find(
      (l) => l.source.id === layer.editor?.parentId,
    ),
    newParent = parentId
      ? input.layers.find((l) => l.source.id === parentId)
      : undefined;
  if (parentId && !newParent) throw new Error('父级不存在');
  const inverse = newParent ? inverse2D(newParent.matrix!) : identity2D;
  if (!inverse) throw new Error('父级缩放不能为零');
  const map = multiply2D(inverse, oldParent?.matrix ?? identity2D),
    rotationDelta = (oldParent?.rotation ?? 0) - (newParent?.rotation ?? 0),
    scaleRatio = {
      x: (oldParent?.scale.x ?? 1) / (newParent?.scale.x ?? 1),
      y: (oldParent?.scale.y ?? 1) / (newParent?.scale.y ?? 1),
    };
  const propertyEdits = (
    [
      ['position', (v: unknown) => apply2D(map, v as { x: number; y: number })],
      ['rotation', (v: unknown) => (v as number) + rotationDelta],
      [
        'scale',
        (v: unknown) => ({
          x: (v as { x: number; y: number }).x * scaleRatio.x,
          y: (v as { x: number; y: number }).y * scaleRatio.y,
        }),
      ],
    ] as const
  ).flatMap(([key, convert]) => {
    const property = layer.transform[key];
    return [
      command({
        type: 'property.setBase',
        propertyId: property.id,
        value: convert(property.baseValue),
      }),
      ...property.keyframes.map((k) =>
        command({
          type: 'keyframe.update',
          propertyId: property.id,
          keyframeId: k.id,
          patch: {
            value: convert(k.value),
            ...(key === 'position' && k.spatialIncoming
              ? { spatialIncoming: apply2D(map, k.spatialIncoming) }
              : {}),
            ...(key === 'position' && k.spatialOutgoing
              ? { spatialOutgoing: apply2D(map, k.spatialOutgoing) }
              : {}),
          },
        }),
      ),
    ];
  });
  return [
    command({
      type: 'layer.replace',
      compositionId: c.id,
      layer: { ...layer, editor: { ...layer.editor, parentId } },
    }),
    ...propertyEdits,
  ];
}
export function precomposeCommands(
  project: Project,
  selection: readonly string[],
): { commands: Command[]; layerId: string } {
  const c = activeComposition(project),
    chosen = c.layers.filter((l) => selection.includes(l.id));
  if (!chosen.length) throw new Error('先选择图层');
  if (chosen.some((l) => l.locked)) throw new Error('不能预合成锁定图层');
  if (
    c.layers.some(
      (l) =>
        l.editor?.parentId &&
        selection.includes(l.id) !== selection.includes(l.editor.parentId),
    )
  )
    throw new Error('请同时选择相互关联的父级和子级图层');
  const comp = {
    ...createComposition({
      name: `预合成 ${project.compositions.length}`,
      width: c.width,
      height: c.height,
      fps: c.fps,
      duration: c.duration,
    }),
    backgroundColor: { r: 0, g: 0, b: 0, a: 0 },
    layers: chosen,
  };
  const layer = createLayer('precomp', {
    compositionId: comp.id,
    width: c.width,
    height: c.height,
    position: { x: c.width / 2, y: c.height / 2 },
    name: comp.name,
  });
  const index = Math.min(...chosen.map((l) => c.layers.indexOf(l)));
  return {
    layerId: layer.id,
    commands: [
      ...chosen.map((l) =>
        command({ type: 'layer.delete', compositionId: c.id, layerId: l.id }),
      ),
      command({ type: 'composition.add', composition: comp }),
      command({ type: 'layer.create', compositionId: c.id, layer, index }),
    ],
  };
}
export function splitLayerCommands(
  project: Project,
  layerId: string,
  time: number,
): Command[] {
  const c = activeComposition(project),
    layer = c.layers.find((l) => l.id === layerId);
  if (!layer?.editor) throw new Error('图层不存在');
  if (
    time <= layer.editor.inPoint ||
    time >= Math.min(c.duration, layer.editor.outPoint)
  )
    throw new Error('播放头必须位于图层入点与出点之间');
  const copy = cloneLayer(layer);
  return [
    command({
      type: 'layer.replace',
      compositionId: c.id,
      layer: { ...layer, editor: { ...layer.editor, outPoint: time } },
    }),
    command({
      type: 'layer.create',
      compositionId: c.id,
      layer: { ...copy, editor: { ...copy.editor!, inPoint: time } },
      index: c.layers.indexOf(layer) + 1,
    }),
  ];
}
export function moveLayerInTime(
  project: Project,
  layer: Layer,
  delta: number,
): Command[] {
  const c = activeComposition(project),
    e = layer.editor;
  if (!e) throw new Error('图层不存在');
  const out = Math.min(c.duration, e.outPoint) + delta;
  if (e.inPoint + delta < 0 || out > c.duration)
    throw new Error('图层超出合成时间范围');
  return [
    command({
      type: 'layer.replace',
      compositionId: c.id,
      layer: {
        ...layer,
        editor: {
          ...e,
          inPoint: e.inPoint + delta,
          outPoint: out,
          startTime: e.startTime + delta,
        },
      },
    }),
    ...layerProperties(layer).flatMap(({ property }) =>
      property.keyframes.map((k) =>
        command({
          type: 'keyframe.update',
          propertyId: property.id,
          keyframeId: k.id,
          patch: { time: k.time + delta },
        }),
      ),
    ),
  ];
}
