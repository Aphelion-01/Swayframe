import {
  activeComposition,
  findProperty,
  effectKinds,
  layerProperties,
} from '../../core/project-model';
import { command } from '../../core/command-system';
import {
  applyMotionCurveCommands,
  selectedMotionSegments,
} from '../../core/motion-curve-commands';
import { motionSegments } from '../../core/motion-curve';
import {
  recordKeyframeCommand,
  toggleAnimation,
} from '../../core/editing-commands';
import { effectDefinitions, createMask } from '../../core/effect-model';
import { effectsToGraph } from '../../core/compositing-migration';
import {
  insertGraphNode,
  deleteGraphNodes,
  duplicateGraphNodes,
} from '../../core/compositing-operations';
import { graphCommand } from '../../core/compositing-commands';
import { splitLayerCommands } from '../../core/composition-editing';
import type { EditorStore } from '../editor-store';
import { layerKindLabels } from '../labels';
import { layerActions } from './layer-actions';
import { createObject, objectChoices } from './object-actions';
import type { PaletteCommand } from './palette';
import type { ApplicationActionId } from '../../shared/application-menu';

import { focusContext } from './shortcuts';
import type { FocusContext } from './shortcuts';

export interface EditorAction extends PaletteCommand {
  id: string;
}
export const dispatchEditorAction = (id: string) =>
  window.dispatchEvent(new CustomEvent('motion:editor-action', { detail: id }));
const emit = (name: string) => () =>
  window.dispatchEvent(new Event(`motion:${name}`));

export function buildEditorActions(
  store: EditorStore,
  ui: Partial<Record<ApplicationActionId, () => void>>,
  getContext: () => FocusContext = () => focusContext(document.activeElement),
): EditorAction[] {
  const v = store.getSnapshot(),
    c = activeComposition(v.project);
  const selected = c.layers.filter((l) => v.selection.includes(l.id));
  const editable = selected.some((l) => !l.locked);
  const nodeContext = getContext() === 'compositing';
  const graphOwner =
      c.layers.find((l) => l.id === v.graphSelection?.layerId) ??
      (nodeContext ? selected[0] : undefined),
    graph = graphOwner?.editor?.graph;
  const nodeIds = v.graphSelection?.nodeIds ?? [],
    editingNodes = nodeContext || (!!graph && nodeIds.length > 0);
  const editableNodes =
    graph?.nodes
      .filter(
        (n) =>
          nodeIds.includes(n.id) && n.type !== 'source' && n.type !== 'output',
      )
      .map((n) => n.id) ?? [];

  const properties = v.selectedProperties.length
    ? v.selectedProperties
    : selected.filter((l) => !l.locked).map((l) => l.transform.position.id);
  const structure = layerActions(
    store,
    () => {
      emit('show-layers')();
      emit('rename')();
    },
    'scene',
  );
  const fromLayer = (label: string) => structure.find((a) => a.label === label);
  const selectedAction = (
    id: string,
    label: string,
    source: string,
  ): EditorAction => ({ id, label, action: () => {}, ...fromLayer(source) });
  const ease = (
    id: string,
    label: string,
    curve: 'linear' | 'hold' | 'in' | 'out' | 'both',
  ): EditorAction => ({
    id,
    label,
    keywords: 'animation interpolation easing 缓动 插值',
    disabled: !v.frames.length,
    action: () => {
      if (curve === 'hold')
        store.run(
          label,
          v.frames.map((ref) =>
            command({
              type: 'keyframe.update',
              propertyId: ref.propertyId,
              keyframeId: ref.keyframeId,
              patch: { interpolation: { type: 'hold' } },
            }),
          ),
        );
      else {
        const explicit = selectedMotionSegments(v.project, v.frames);
        const ids = explicit.length
          ? explicit
          : [
              ...new Set(
                v.frames.flatMap((ref) => {
                  const segments = motionSegments(
                    findProperty(v.project, ref.propertyId).property,
                  );
                  const s =
                    segments.find((s) => s.from.id === ref.keyframeId) ??
                    segments.find((s) => s.to.id === ref.keyframeId);
                  return s ? [s.id] : [];
                }),
              ),
            ];
        if (!ids.length) {
          store.setStatus('请选择含相邻区间的关键帧');
          return;
        }
        store.run(
          label,
          applyMotionCurveCommands(
            v.project,
            ids,
            curve === 'linear'
              ? { type: 'linear' }
              : {
                  type: 'cubic-bezier',
                  x1: curve === 'out' ? 0 : 0.42,
                  y1: 0,
                  x2: curve === 'in' ? 1 : 0.58,
                  y2: 1,
                },
          ),
        );
      }
    },
  });
  const easing = [
    ease('ease-in', '缓入', 'in'),
    ease('ease-out', '缓出', 'out'),
    ease('ease-both', '缓入缓出', 'both'),
    ease('linear', '线性', 'linear'),
    ease('hold', '保持', 'hold'),
  ];
  const creators: EditorAction[] = objectChoices
    .filter(([kind]) => kind !== 'image')
    .map(([kind]) => ({
      id: `create-${kind}`,
      label: `创建 ${layerKindLabels[kind]}`,
      keywords: `create layer ${kind} 新建 对象`,
      action: () => createObject(store, kind as Exclude<typeof kind, 'image'>),
    }));
  return [
    ...Object.entries(ui).map(([id, action]) => ({ id, label: id, action })),
    {
      id: 'undo',
      label: '撤销',
      disabled: !store.commands.undoStack.length,
      action: () => store.undo(),
    },
    {
      id: 'redo',
      label: '重做',
      disabled: !store.commands.redoStack.length,
      action: () => store.redo(),
    },
    {
      id: 'cut',
      label: '剪切',
      disabled: editingNodes || (!selected.length && !v.frames.length),
      action: () => {
        store.copySelection();
        store.deleteSelected();
      },
    },
    {
      id: 'copy',
      label: '复制',
      disabled: editingNodes || (!selected.length && !v.frames.length),
      action: () => store.copySelection(),
    },
    {
      id: 'paste',
      label: '粘贴',
      disabled: editingNodes,
      action: () => store.pasteSelection(),
    },
    {
      id: 'duplicate',
      label: '创建副本',
      disabled: editingNodes
        ? !editableNodes.length
        : !selected.length && !v.frames.length,
      action: () => {
        if (editingNodes && graph && graphOwner) {
          const copy = duplicateGraphNodes(graph, editableNodes);
          if (
            store.run('复制节点', [
              graphCommand(v.project, graphOwner.id, copy.graph),
            ]).ok
          )
            store.selectGraphNodes(graphOwner.id, copy.ids);
        } else store.duplicateSelection();
      },
    },
    {
      id: 'delete',
      label: '删除选中',
      disabled: editingNodes
        ? !editableNodes.length
        : !selected.length && !v.frames.length,
      action: () => {
        if (editingNodes && graph && graphOwner) {
          if (
            store.run('删除节点', [
              graphCommand(
                v.project,
                graphOwner.id,
                deleteGraphNodes(graph, editableNodes),
              ),
            ]).ok
          )
            store.selectGraphNodes(graphOwner.id, []);
        } else store.deleteSelected();
      },
    },
    {
      id: 'select-all',
      label: '全选',
      action: () => {
        if (getContext() === 'compositing') {
          if (graph && graphOwner)
            store.selectGraphNodes(
              graphOwner.id,
              graph.nodes.map((n) => n.id),
            );
        } else if (['timeline', 'curvegraph'].includes(getContext()))
          store.selectFrames(
            c.layers.flatMap((l) =>
              layerProperties(l).flatMap(({ property }) =>
                property.keyframes.map((k) => ({
                  propertyId: property.id,
                  keyframeId: k.id,
                })),
              ),
            ),
          );
        else store.selectAll();
      },
    },
    {
      id: 'create-object',
      label: '创建对象',
      action: () => {},
      children: creators,
    },
    ...creators,
    selectedAction('rename', '重命名', '重命名'),
    selectedAction('precompose', '选中图层预合成', '选中图层预合成'),
    selectedAction('parent-null', '创建父级空对象', '创建父级空对象'),
    {
      ...selectedAction('parent-select', '设置父子级', '设置父级'),
      action: () => {
        store.clearGraphSelection();
        window.dispatchEvent(new Event('motion:show-right'));
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLSelectElement>('[aria-label="父级图层"]')
            ?.focus(),
        );
      },
    },
    selectedAction(
      'toggle-3d',
      '切换三维图层',
      selected[0]?.editor?.is3D ? '关闭三维图层' : '开启三维图层',
    ),
    {
      id: 'align',
      label: '对齐与分布',
      disabled: !editable,
      action: () => {},
      children: layerActions(store, emit('rename'), 'canvas').filter((a) =>
        /对齐|居中|分布/.test(a.label),
      ),
    },
    ...layerActions(store, emit('rename'), 'canvas')
      .filter((a) => /对齐|居中|分布/.test(a.label))
      .map((a, i) => ({
        ...a,
        id: `align-${i}`,
        keywords: 'align distribute 对齐 分布',
      })),
    {
      id: 'keyframe',
      label: '记录选中属性关键帧',
      keywords: 'animation keyframe 位置 动画 记录',
      disabled: !editable || !properties.length,
      action: () => {
        try {
          const ids = properties.filter((id) => {
            const entry = findProperty(v.project, id);
            return (
              !entry.layer.locked &&
              selected.some((l) => l.id === entry.layer.id)
            );
          });
          if (ids.length)
            store.run(
              '记录选中属性关键帧',
              ids.map((id) => recordKeyframeCommand(v.project, id, v.time)),
            );
        } catch {
          store.setStatus('请重新选择有效的动画属性', true);
        }
      },
    },
    {
      id: 'interpolation',
      label: '关键帧插值与缓动',
      disabled: !v.frames.length,
      action: () => {},
      children: easing,
    },
    ...easing,
    ...(
      [
        'fit',
        'actual-size',
        'zoom-in',
        'zoom-out',
        'graph',
        'motion-curve',
        'previous-key',
        'next-key',
        'timeline',
        'compositing',
        'toggle-left',
        'toggle-right',
        'toggle-bottom',
        'reset-workspace',
        'show-project',
        'show-layers',
        'assistant',
      ] as const
    ).map((id) => ({ id, label: id, action: emit(id) })),
    ...effectKinds.map((kind) => ({
      id: `effect-${kind}`,
      label: `添加${effectDefinitions[kind].label}`,
      keywords: `effect ${kind} 效果`,
      disabled: selected.length !== 1 || !editable || !selected[0]?.editor,
      action: () => {
        const layer = selected[0];
        if (!layer?.editor) return;
        const graph =
          layer.editor.graph ??
          effectsToGraph(layer.id, layer.editor.effects ?? []);
        store.run(`添加${effectDefinitions[kind].label}`, [
          graphCommand(v.project, layer.id, insertGraphNode(graph, kind).graph),
        ]);
      },
    })),
    ...(['rectangle', 'ellipse', 'path'] as const).map((kind) => ({
      id: `mask-${kind}`,
      label: `添加${{ rectangle: '矩形', ellipse: '椭圆', path: '路径' }[kind]}遮罩`,
      keywords: `mask ${kind} 遮罩`,
      disabled: selected.length !== 1 || !editable || !selected[0]?.editor,
      action: () => {
        const layer = selected[0];
        if (!layer?.editor) return;
        store.run('添加遮罩', [
          command({
            type: 'layer.replace',
            compositionId: c.id,
            layer: {
              ...layer,
              editor: {
                ...layer.editor,
                masks: [...layer.editor.masks, createMask(layer, kind)],
              },
            },
          }),
        ]);
      },
    })),
    {
      id: 'split-layer',
      label: '在播放头拆分图层',
      keywords: 'split trim 时间 入点 出点',
      disabled: !editable,
      action: () => {
        try {
          store.run(
            '拆分图层',
            selected
              .filter((l) => !l.locked)
              .flatMap((l) => splitLayerCommands(v.project, l.id, v.time)),
          );
        } catch (e) {
          store.setStatus(e instanceof Error ? e.message : '拆分失败', true);
        }
      },
    },
    {
      id: 'remove-animation',
      label: '移除选中属性动画',
      keywords: 'animation remove keyframes',
      disabled: !properties.length || !editable,
      action: () => {
        const commands = properties.flatMap((id) => {
          const { property, layer } = findProperty(v.project, id);
          if (layer.locked || !property.keyframes.length) return [];
          return toggleAnimation(v.project, id, v.time);
        });
        if (commands.length) store.run('移除选中属性动画', commands);
      },
    },
  ];
}
