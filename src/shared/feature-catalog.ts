import { applicationMenus as seedMenus } from './application-menu-seed';
import {
  FeatureRegistry,
  type FeatureDefinition,
  type FeatureDomain,
  type ContributionPoint,
  type ObjectType,
  type TaskType,
} from './feature-registry';
import { toolDefinitions } from './tool-registry';
import { effectRegistry } from '../core/effect-registry';
export const features = new FeatureRegistry();
const menuDomains: Record<string, FeatureDomain> = {
  文件: 'APPLICATION',
  编辑: 'APPLICATION',
  图层: 'SCENE',
  动画: 'MOTION',
  视图: 'CANVAS',
  窗口: 'APPLICATION',
  帮助: 'APPLICATION',
};
export const menuPoints = {
  文件: 'menu.file',
  编辑: 'menu.edit',
  图层: 'menu.layer',
  动画: 'menu.animation',
  视图: 'menu.view',
  窗口: 'menu.window',
  帮助: 'menu.help',
} as const;
const overrides: Record<string, Partial<FeatureDefinition>> = {
  timeline: {
    domain: 'TIMELINE',
    objectTypes: ['Composition'],
    tasks: ['Navigate'],
    frequency: 'F1',
    contexts: ['TimelineMode'],
    placement: { canonical: 'timeline.header', secondary: ['menu.window'] },
  },
  export: {
    icon: 'export',
    placement: { canonical: 'menu.file', secondary: ['toolbar.global'] },
  },
  palette: {
    icon: 'search',
    placement: { canonical: 'menu.help', secondary: ['toolbar.global'] },
  },
  undo: {
    icon: 'undo',
    placement: {
      canonical: 'menu.edit',
      secondary: ['toolbar.global', 'context.keyframe', 'context.node'],
    },
  },
  redo: {
    icon: 'redo',
    placement: { canonical: 'menu.edit', secondary: ['toolbar.global'] },
  },
  import: {
    domain: 'PROJECT',
    objectTypes: ['Asset'],
    tasks: ['Create'],
    placement: { canonical: 'panel.project', secondary: ['menu.file'] },
  },
  'new-composition': {
    domain: 'PROJECT',
    objectTypes: ['Composition'],
    tasks: ['Create'],
    placement: { canonical: 'panel.project', secondary: ['menu.file'] },
  },
  'composition-settings': {
    domain: 'PROJECT',
    objectTypes: ['Composition'],
    tasks: ['Manage'],
  },
  assistant: {
    domain: 'ASSISTANT',
    tasks: ['Automate'],
    placement: { canonical: 'assistant.actions', secondary: ['menu.window'] },
  },
  precompose: {
    objectTypes: ['Layer'],
    tasks: ['Organize'],
    contexts: ['LayerSelection'],
    when: ['hasLayerSelection'],
    placement: { canonical: 'context.layer', secondary: ['menu.layer'] },
    keywords: ['precomp', 'nest', 'group composition', '合成', '预合成'],
  },
  'parent-null': {
    objectTypes: ['Layer'],
    tasks: ['Organize'],
    contexts: ['LayerSelection'],
    when: ['hasLayerSelection'],
  },
  'parent-select': {
    objectTypes: ['Layer'],
    tasks: ['Organize'],
    contexts: ['LayerSelection'],
    when: ['hasLayerSelection'],
    placement: {
      canonical: 'panel.inspector.structure',
      secondary: ['menu.layer', 'context.layer'],
    },
    keywords: ['parent', '父子级', '父级'],
  },
  'toggle-3d': {
    objectTypes: ['Layer'],
    tasks: ['Transform'],
    contexts: ['LayerSelection'],
    when: ['hasLayerSelection'],
    placement: {
      canonical: 'panel.scene',
      secondary: ['menu.layer', 'context.layer'],
    },
  },
  rename: {
    objectTypes: ['Layer'],
    contexts: ['LayerSelection'],
    when: ['hasLayerSelection'],
    placement: {
      canonical: 'context.layer',
      secondary: ['menu.layer', 'context.canvas'],
    },
  },
  keyframe: {
    domain: 'TIMELINE',
    objectTypes: ['Property'],
    tasks: ['Animate'],
    frequency: 'F2',
    contexts: ['LayerSelection', 'PropertySelection'],
    when: ['hasLayerSelection'],
    placement: {
      canonical: 'timeline.propertyContext',
      secondary: ['menu.animation', 'context.property'],
    },
  },
  graph: {
    objectTypes: ['Property'],
    tasks: ['Animate'],
    frequency: 'F2',
    placement: {
      canonical: 'motion.toolbar',
      secondary: ['menu.animation', 'context.property', 'context.keyframe'],
    },
    keywords: ['curve', 'graph', 'value', 'speed', '曲线', '速度曲线'],
  },
  'motion-curve': {
    objectTypes: ['Keyframe'],
    tasks: ['Animate'],
    placement: {
      canonical: 'motion.toolbar',
      secondary: ['menu.animation', 'context.property', 'context.keyframe'],
    },
    keywords: ['ease', 'easing', 'curve', '缓动', '速度曲线'],
  },
};
for (const id of [
  'precompose',
  'parent-null',
  'rename',
  'toggle-3d',
  'parent-select',
]) {
  const old = overrides[id]!;
  overrides[id] = {
    ...old,
    placement: {
      canonical: old.placement?.canonical ?? 'context.layer',
      secondary: [
        ...new Set([
          ...(old.placement?.secondary ?? []),
          'menu.layer',
          'context.canvas',
          'timeline.layerContext',
          'context.layer',
        ] as const),
      ].filter((p) => p !== (old.placement?.canonical ?? 'context.layer')),
    },
  };
}
for (const id of ['copy', 'paste'])
  overrides[id] = {
    when: ['hasSelection'],
    placement: {
      canonical: 'menu.edit',
      secondary: [
        'context.canvas',
        'context.layer',
        'timeline.layerContext',
        'context.keyframe',
        'context.node',
      ],
    },
  };
let order = 0;
for (const menu of seedMenus)
  for (const [id, title, ...keys] of menu.items) {
    const canonical = menuPoints[menu.label];
    const isEdit = menu.label === '编辑';
    features.register({
      id,
      title,
      description: title,
      domain: menuDomains[menu.label]!,
      objectTypes: isEdit
        ? ['Layer', 'Keyframe', 'GraphNode']
        : ['Application'],
      tasks: [
        menu.label === '视图' || menu.label === '窗口' ? 'Navigate' : 'Manage',
      ],
      frequency: ['undo', 'redo', 'copy', 'paste', 'save', 'fit'].includes(id)
        ? 'F2'
        : 'F3',
      contexts: ['Global'],
      commandId: id,
      placement: {
        canonical,
        ...(isEdit
          ? { secondary: ['context.keyframe', 'context.node'] as const }
          : {}),
      },
      shortcut: keys[0],
      keywords: [id, menu.label],
      order: order++,
      ...overrides[id],
    });
  }
const add = (
  id: string,
  title: string,
  domain: FeatureDomain,
  objectTypes: readonly ObjectType[],
  tasks: readonly TaskType[],
  canonical: ContributionPoint,
  extra: Partial<FeatureDefinition> = {},
) =>
  features.register({
    id,
    title,
    description: title,
    domain,
    objectTypes,
    tasks,
    frequency: 'F3',
    contexts: ['Selection'],
    commandId: id,
    placement: { canonical },
    order: order++,
    ...extra,
  });
const creations = [
  ['rectangle', '矩形', 'rectangle'],
  ['ellipse', '椭圆', 'ellipse'],
  ['polygon', '多边形', 'polygon'],
  ['star', '星形', 'star'],
  ['path', '路径', 'path'],
  ['text', '文字', 'text'],
  ['camera', '摄像机', 'camera'],
  ['solid', '纯色', 'solid'],
  ['null', '空对象', 'null'],
] as const;
for (const [kind, title, icon] of creations)
  add(
    `create-${kind}`,
    `创建 ${title}`,
    'SCENE',
    ['Layer'],
    ['Create'],
    'panel.scene',
    {
      contexts: ['Composition'],
      icon,
      parentId: 'create-object',
      placement: {
        canonical: 'panel.scene',
        secondary: [],
      },
      keywords: ['create', 'layer', kind, '新建', '对象'],
    },
  );
for (const [i, title] of [
  '左对齐',
  '水平居中',
  '右对齐',
  '顶对齐',
  '垂直居中',
  '底对齐',
  '水平分布',
  '垂直分布',
].entries())
  add(
    `align-${i}`,
    title,
    'CANVAS',
    ['Layer'],
    ['Transform'],
    'context.canvas',
    {
      parentId: 'align',
      when: ['hasLayerSelection'],
      keywords: ['align', 'distribute', '对齐', '分布'],
    },
  );
for (const [id, title] of [
  ['ease-in', '缓入'],
  ['ease-out', '缓出'],
  ['ease-both', '缓入缓出'],
  ['linear', '线性'],
  ['hold', '保持'],
] as const)
  add(id, title, 'MOTION', ['Keyframe'], ['Animate'], 'context.keyframe', {
    frequency: 'F2',
    contexts: ['KeyframeSelection'],
    when: ['hasKeyframeSelection'],
    parentId: 'interpolation',
    placement: {
      canonical: 'context.keyframe',
      secondary: ['timeline.keyframeContext', 'motion.toolbar'],
    },
    keywords: ['ease', 'easing', 'interpolation', '缓动', '插值', id],
  });
for (const def of effectRegistry.all())
  add(
    `effect-${def.id}`,
    `添加${def.name}`,
    'INSPECTOR',
    ['Effect', 'Layer'],
    ['Process'],
    'panel.inspector.effects',
    {
      contexts: ['LayerSelection'],
      when: ['hasSingleEditableLayer'],
      keywords: [
        'effect',
        def.id,
        '效果',
        ...(def.id === 'gaussianBlur' ? ['blur', '模糊'] : []),
      ],
    },
  );
for (const [kind, title] of [
  ['rectangle', '矩形'],
  ['ellipse', '椭圆'],
  ['path', '路径'],
] as const)
  add(
    `mask-${kind}`,
    `添加${title}遮罩`,
    'INSPECTOR',
    ['Mask', 'Layer'],
    ['Style'],
    'panel.inspector.effects',
    {
      contexts: ['LayerSelection'],
      when: ['hasSingleEditableLayer'],
      keywords: ['mask', kind, '遮罩'],
    },
  );
add(
  'split-layer',
  '在播放头拆分图层',
  'TIMELINE',
  ['Layer'],
  ['Animate'],
  'timeline.layerContext',
  {
    contexts: ['LayerSelection', 'TimelineMode'],
    when: ['hasLayerSelection'],
    keywords: ['split', 'trim', '拆分'],
  },
);
add(
  'remove-animation',
  '移除选中属性动画',
  'TIMELINE',
  ['Property'],
  ['Animate'],
  'context.property',
  {
    contexts: ['PropertySelection'],
    when: ['hasPropertySelection'],
    placement: {
      canonical: 'context.property',
      secondary: ['timeline.propertyContext'],
    },
  },
);
for (const [id, title] of [
  ['layer-copy', '复制图层'],
  ['layer-delete', '删除选中图层'],
  ['layer-visibility', '切换图层可见性'],
  ['layer-lock', '切换图层锁定'],
  ['parent-remove', '解除父级'],
  ['enter-precomp', '进入预合成'],
] as const)
  add(id, title, 'SCENE', ['Layer'], ['Organize'], 'context.layer', {
    contexts: ['LayerSelection'],
    when: [id === 'enter-precomp' ? 'isPrecompSelected' : 'hasLayerSelection'],
    placement: {
      canonical: 'context.layer',
      secondary: ['context.canvas', 'timeline.layerContext'],
    },
    keywords: [id, 'parent', '图层'],
  });
for (const [id, title] of [
  ['copy-easing', '复制缓动'],
  ['paste-easing', '粘贴缓动'],
] as const)
  add(id, title, 'MOTION', ['Keyframe'], ['Animate'], 'context.keyframe', {
    contexts: ['KeyframeSelection'],
    when: ['hasMotionTarget'],
    placement: {
      canonical: 'context.keyframe',
      secondary: [
        'timeline.keyframeContext',
        'motion.toolbar',
        'motion.segmentContext',
      ],
    },
    keywords: ['easing', '缓动'],
  });

for (const tool of toolDefinitions)
  add(
    `tool-${tool.id}`,
    tool.label,
    'CANVAS',
    ['SceneObject'],
    [tool.group === 'draw' ? 'Create' : 'Navigate'],
    'toolbar.canvas',
    {
      frequency: 'F1',
      contexts: ['CanvasMode'],
      icon: tool.icon,
      shortcut: tool.key,
      keywords: [tool.id, 'tool', '绘图'],
      order: tool.order,
    },
  );

add(
  'layer-color',
  '图层颜色',
  'SCENE',
  ['Layer'],
  ['Organize'],
  'context.layer',
  {
    contexts: ['LayerSelection'],
    when: ['hasLayerSelection'],
    placement: {
      canonical: 'context.layer',
      secondary: ['context.canvas', 'timeline.layerContext'],
    },
  },
);

for (const [id, title] of [
  ['asset.add', '添加到当前合成'],
  ['asset.relink', '重新链接'],
  ['asset.delete', '删除素材'],
] as const)
  add(id, title, 'PROJECT', ['Asset'], ['Manage'], 'context.asset', {
    commandScope: 'asset',
    contexts: ['Project'],
    keywords: [id, 'asset', '素材', 'relink'],
  });
for (const [id, title] of [
  ['node.rename', '重命名节点'],
  ['node.duplicate', '复制节点'],
  ['node.delete', '删除节点'],
  ['node.add', '添加节点'],
  ['node.fit', '适应所有节点'],
  ['edge.insert', '在连线上插入节点'],
  ['edge.disconnect', '断开连线'],
] as const)
  add(id, title, 'COMPOSITING', ['GraphNode'], ['Process'], 'context.node', {
    commandScope: 'node',
    contexts: ['GraphSelection'],
    keywords: [id, 'node', '节点'],
  });

add(
  'create-image',
  '导入 图片',
  'SCENE',
  ['Layer', 'Asset'],
  ['Create'],
  'panel.scene',
  {
    contexts: ['Composition'],
    icon: 'image',
    parentId: 'create-object',
    keywords: ['image', '图片', 'import'],
  },
);

for (const [id, title] of [
  ['motion.edit-segment', '编辑缓动'],
  ['motion.reset-segment', '重置缓动'],
] as const)
  add(
    id,
    title,
    'MOTION',
    ['Property', 'Keyframe'],
    ['Animate'],
    'motion.segmentContext',
    {
      commandScope: 'motion',
      contexts: ['PropertySelection'],
      keywords: ['segment', 'easing', 'Motion Curve', '缓动'],
    },
  );

add(
  'import-model',
  '导入三维模型…',
  'PROJECT',
  ['Asset'],
  ['Create'],
  'panel.project',
  {
    contexts: ['Composition'],
    icon: 'cube',
    placement: { canonical: 'panel.project', secondary: ['menu.file'] },
    keywords: ['GLB', 'glTF', 'FBX', 'OBJ', 'STL', 'PLY', 'DAE', '3DS', '模型'],
  },
);
add(
  'camera-frustum',
  '拍摄范围',
  'CANVAS',
  ['Layer'],
  ['Navigate'],
  'panel.inspector.3d',
  {
    contexts: ['LayerSelection'],
    when: ['isCameraSelected'],
    keywords: ['camera', 'frustum', '景深', '光圈', '曝光'],
    description:
      '摄像机空间位置、焦平面拍摄范围与光学参数；参数由 ThreeDControls Section 管理',
  },
);
add(
  'motion-paths',
  '运动路径',
  'MOTION',
  ['Property', 'Keyframe'],
  ['Animate'],
  'panel.inspector.transform',
  {
    frequency: 'F1',
    contexts: ['LayerSelection'],
    placement: {
      canonical: 'panel.inspector.transform',
      secondary: ['menu.view'],
    },
    keywords: ['Bezier', '贝塞尔', '路径', '最终位置'],
    description:
      '选中图层的二维/三维位置路径和结束位置；直接拖动端点及空间控制点',
  },
);
add(
  'canvas-aids',
  '网格 / 参考线 / 标尺',
  'CANVAS',
  ['Composition'],
  ['Inspect'],
  'menu.view',
  {
    frequency: 'F2',
    contexts: ['Composition'],
    keywords: ['grid', 'ruler', 'guides', '安全框', '作图'],
    description:
      '画布标题行的现有辅助菜单；像素主次网格、可拖拽参考线、安全区和标尺',
  },
);
add(
  'text-animator',
  '文本动画',
  'INSPECTOR',
  ['Property'],
  ['Animate'],
  'panel.inspector.text',
  {
    frequency: 'F2',
    contexts: ['LayerSelection'],
    keywords: ['text', '逐字', '范围选择器'],
    description:
      '文字 Section 的逐字范围选择器与位置、缩放、旋转、透明度；通过共享 Command 修改',
  },
);

for (const [id, title] of [
  ['spatial-translate', '三维移动手柄'],
  ['spatial-rotate', '三维旋转手柄'],
] as const)
  add(id, title, 'CANVAS', ['Layer'], ['Transform'], 'panel.inspector.3d', {
    frequency: 'F2',
    contexts: ['LayerSelection'],
    when: ['is3DLayer'],
    description:
      '三维 Section 中切换直接操控模式；操作状态位于 EditorView，变换仍经 Command/Transaction',
  });

features.validatePermanentBudgets();
