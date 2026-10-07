export const domains = [
  'PROJECT',
  'SCENE',
  'CANVAS',
  'INSPECTOR',
  'TIMELINE',
  'MOTION',
  'COMPOSITING',
  'ASSISTANT',
  'APPLICATION',
] as const;
export type FeatureDomain = (typeof domains)[number];
export const objectTypes = [
  'Application',
  'Project',
  'Composition',
  'Asset',
  'SceneObject',
  'Layer',
  'Property',
  'Keyframe',
  'Mask',
  'Effect',
  'GraphNode',
] as const;
export type ObjectType = (typeof objectTypes)[number];
export const taskTypes = [
  'Create',
  'Organize',
  'Navigate',
  'Transform',
  'Style',
  'Animate',
  'Process',
  'Manage',
  'Inspect',
  'Automate',
] as const;
export type TaskType = (typeof taskTypes)[number];
export const contexts = [
  'Global',
  'Project',
  'Composition',
  'Selection',
  'LayerSelection',
  'PropertySelection',
  'KeyframeSelection',
  'GraphSelection',
  'CanvasMode',
  'TimelineMode',
  'TextEditing',
  '3DMode',
  'AssistantMode',
] as const;
export type ContextKey = (typeof contexts)[number];
export type FeatureFrequency = 'F1' | 'F2' | 'F3' | 'F4' | 'F5';
export const contributionPoints = [
  'toolbar.global',
  'toolbar.canvas',
  'panel.project',
  'panel.scene',
  'panel.inspector.transform',
  'panel.inspector.appearance',
  'panel.inspector.text',
  'panel.inspector.geometry',
  'panel.inspector.effects',
  'panel.inspector.structure',
  'panel.inspector.time',
  'panel.inspector.3d',
  'panel.inspector.semantic',
  'timeline.header',
  'timeline.layerContext',
  'timeline.propertyContext',
  'timeline.keyframeContext',
  'motion.toolbar',
  'motion.segmentContext',
  'graph.nodeContext',
  'menu.file',
  'menu.edit',
  'menu.layer',
  'menu.animation',
  'menu.view',
  'menu.window',
  'menu.help',
  'context.canvas',
  'context.layer',
  'context.property',
  'context.keyframe',
  'context.asset',
  'context.node',
  'commandPalette',
  'assistant.actions',
  'dialog.actions',
] as const;
export type ContributionPoint = (typeof contributionPoints)[number];
export const conditionKeys = [
  'hasSelection',
  'hasMotionTarget',
  'hasLayerSelection',
  'hasMultipleLayers',
  'hasPropertySelection',
  'hasKeyframeSelection',
  'hasSingleEditableLayer',
  'isShapeSelected',
  'isTextSelected',
  'isCameraSelected',
  'isPrecompSelected',
  'is3DLayer',
  'canPrecompose',
  'canParent',
  'canAnimate',
  'graphMode',
  'timelineMode',
  'textEditing',
] as const;
export type ConditionKey = (typeof conditionKeys)[number];
export interface FeatureDefinition {
  commandScope?: 'asset' | 'node' | 'motion';
  id: string;
  title: string;
  description: string;
  domain: FeatureDomain;
  objectTypes: readonly ObjectType[];
  tasks: readonly TaskType[];
  frequency: FeatureFrequency;
  contexts: readonly ContextKey[];
  commandId: string;
  placement: {
    canonical: ContributionPoint;
    secondary?: readonly ContributionPoint[];
  };
  shortcut?: string;
  keywords?: readonly string[];
  icon?: string;
  group?: string;
  order?: number;
  when?: readonly ConditionKey[];
  contributeToCommandPalette?: boolean;
  parentId?: string;
}
export type ContextValues = Readonly<Record<string, boolean>>;
export class FeatureRegistry {
  private readonly items = new Map<string, FeatureDefinition>();
  register(feature: FeatureDefinition) {
    if (this.items.has(feature.id)) throw new Error(`重复功能：${feature.id}`);
    if (
      !domains.includes(feature.domain) ||
      !/^F[1-5]$/.test(feature.frequency) ||
      !feature.id ||
      !feature.commandId ||
      !feature.title ||
      !feature.description ||
      !feature.contexts.length ||
      !feature.objectTypes.length ||
      !feature.tasks.length
    )
      throw new Error(`功能元数据缺失：${feature.id}`);
    if (
      feature.contexts.some((c) => !contexts.includes(c)) ||
      feature.tasks.some((t) => !taskTypes.includes(t)) ||
      feature.objectTypes.some((o) => !objectTypes.includes(o))
    )
      throw new Error(`未知分类：${feature.id}`);
    if (feature.when?.some((k) => !conditionKeys.includes(k)))
      throw new Error(`未知上下文：${feature.id}`);
    const points = [
      feature.placement.canonical,
      ...(feature.placement.secondary ?? []),
    ];
    if (
      points.some((p) => !contributionPoints.includes(p)) ||
      new Set(points).size !== points.length
    )
      throw new Error(`无效入口：${feature.id}`);
    if (
      points.some((p) =>
        ['toolbar.global', 'toolbar.canvas', 'timeline.header'].includes(p),
      ) &&
      ['F4', 'F5'].includes(feature.frequency)
    )
      throw new Error(`低频功能不能常驻：${feature.id}`);
    this.items.set(
      feature.id,
      Object.freeze({
        ...feature,
        placement: Object.freeze({ ...feature.placement }),
      }),
    );
  }
  all() {
    return [...this.items.values()];
  }
  get(id: string) {
    return this.items.get(id);
  }
  contributions(
    point: ContributionPoint,
    context: ContextValues = { Global: true },
  ) {
    return this.all()
      .filter(
        (f) =>
          (f.placement.canonical === point ||
            f.placement.secondary?.includes(point) ||
            (point === 'commandPalette' &&
              f.contributeToCommandPalette !== false &&
              !f.parentId)) &&
          (f.when ?? []).every((k) => context[k]),
      )
      .sort(
        (a, b) =>
          (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id),
      );
  }
  search(query: string, context: ContextValues) {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return this.all()
      .filter(
        (f) =>
          f.contributeToCommandPalette !== false &&
          !this.all().some((c) => c.parentId === f.id) &&
          words.every((w) =>
            [
              f.title,
              f.description,
              f.id,
              f.domain,
              ...f.objectTypes,
              ...(f.keywords ?? []),
            ]
              .join(' ')
              .toLowerCase()
              .includes(w),
          ),
      )
      .sort((a, b) => {
        const score = (f: FeatureDefinition) =>
          f.contexts.filter((k) => context[k]).length * 10 +
          ((f.when ?? []).every((k) => context[k]) ? 5 : 0);
        return score(b) - score(a) || (a.order ?? 100) - (b.order ?? 100);
      });
  }
  validatePermanentBudgets() {
    for (const [point, max] of [
      ['toolbar.global', 4],
      ['toolbar.canvas', 6],
      ['timeline.header', 8],
    ] as const) {
      const count = this.all().filter(
        (f) =>
          f.placement.canonical === point ||
          f.placement.secondary?.includes(point),
      ).length;
      if (count > max)
        throw Error(`永久入口预算超限：${point} ${count}/${max}`);
    }
  }
  validateCommands(ids: ReadonlySet<string>) {
    for (const f of this.all())
      if (!ids.has(f.commandId)) throw new Error(`未绑定命令：${f.commandId}`);
  }
}
