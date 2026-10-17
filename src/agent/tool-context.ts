import type { AgentToolRegistry } from './tool-registry';
import { NativeSkillRegistry } from './native-skill-runtime';
/** Context selection is identical in with/without-Skill evaluation. It changes
 * model context only, never the authoritative execution permissions. */
export class ToolContextLoader {
  private readonly loaded = new Set<string>();
  private allowed: readonly string[] = [];
  constructor(private readonly registry: AgentToolRegistry) {}
  begin(goal: string, allowed: readonly string[], emptyComposition = false) {
    this.allowed = allowed;
    this.loaded.clear();
    const wanted = new Set([
      'createRectangle',
      'createText',
      'setFill',
      'setPosition',
      'inspectToolContract',
      'discoverCapabilities',
      'inspectComposition',
      'getCanvasInfo',
      'getCurrentTime',
      'inspectSelection',
      'listLayers',
      'inspectLayer',
    ]);
    if (/关键帧|动画|淡入|淡出|keyframe|animation|fade|addKeyframe/i.test(goal))
      wanted.add('addKeyframe');
    for (const s of new NativeSkillRegistry().all())
      if (
        s.manifest.keywords.some((k) =>
          goal.toLowerCase().includes(k.toLowerCase()),
        )
      ) {
        if (s.manifest.id === 'sf.shape-creation') {
          ['createShape', 'placeAtCompositionCenter'].forEach((t) =>
            wanted.add(t),
          );
          for (const [pattern, name] of [
            [/椭圆|ellipse/i, 'createEllipse'],
            [/多边形|polygon/i, 'createPolygon'],
            [/星形|star/i, 'createStar'],
          ] as const)
            if (pattern.test(goal)) wanted.add(name);
        } else if (s.manifest.id === 'sf.typography' && emptyComposition) {
          // createText already carries content/family/size/color; load mutation
          // contracts only on actual demand through inspectToolContract.
          wanted.add('createText');
          continue;
        } else if (s.manifest.id === 'sf.keyframe-animation') {
          [
            'animateLayerProperty',
            'inspectKeyframes',
            'listMotionPresets',
          ].forEach((t) => wanted.add(t));
        } else s.workflow.actions.forEach((t) => wanted.add(t));
        s.manifest.optionalCapabilities.forEach((t) => wanted.add(t));
      }
    if (/参考|复刻|reference|reconstruct/i.test(goal))
      [
        'createPath',
        'setStroke',
        'createNode',
        'connectNodes',
        'setGraphOutput',
        'setNodeParameter',
        'setFont',
        'setFontSize',
      ].forEach((t) => wanted.add(t));
    for (const [pattern, name] of [
      [/布局|layout/i, 'analyzeLayout'],
      [/配色|color analysis/i, 'analyzeColor'],
      [/排版|typography analysis/i, 'analyzeTypography'],
      [/运动分析|motion analysis/i, 'analyzeMotion'],
      [/参考|复刻|reference|reconstruct/i, 'analyzeReference'],
    ] as const)
      if (pattern.test(goal)) wanted.add(name);
    for (const t of allowed) if (goal.includes(t)) wanted.add(t);
    this.load([...wanted]);
  }
  load(names: readonly string[]) {
    for (const name of names)
      if (this.allowed.includes(name)) this.loaded.add(name);
  }
  definitions() {
    return this.registry.definitions([...this.loaded]);
  }
  overview() {
    return this.registry
      .catalog()
      .filter((t) => this.allowed.includes(t.name) && t.permission !== 'READ')
      .map((t) => ({
        capabilityId: t.name,
        permission: t.permission,
      }));
  }
  metrics() {
    return {
      fullSchemaCharacters: JSON.stringify(
        this.registry.definitions(this.allowed),
      ).length,
      selectedSchemaCharacters: JSON.stringify(this.definitions()).length,
      loadedToolNames: [...this.loaded],
    };
  }
}
