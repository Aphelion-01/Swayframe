import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
execFileSync(process.execPath, ['scripts/ia-current-inventory.mjs']);
const temp = '/tmp/swayframe-feature-catalog-audit.mjs';
await build({
  entryPoints: ['src/shared/feature-catalog.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: temp,
});
const { features } = await import(pathToFileURL(temp).href + '?' + Date.now());
const entries = JSON.parse(
  fs.readFileSync('outputs/ia-refactor/entry-inventory.json', 'utf8'),
).rows;
const clean = (s) =>
  String(s ?? '—')
    .replaceAll('|', ' / ')
    .replaceAll('\n', ' ')
    .replaceAll('`', '');
const classify = (r) => {
  const file = r.file;
  const feature = features
    .all()
    .find((f) => f.title === r.name.replace(/^['"]|['"]$/g, ''));
  if (feature)
    return {
      domain: feature.domain,
      object: feature.objectTypes.join(','),
      task: feature.tasks.join(','),
      canonical: feature.placement.canonical,
      commandId: feature.commandId,
      frequency: feature.frequency,
      context: feature.contexts.join(','),
      secondary: feature.placement.secondary ?? [],
      shortcut: feature.shortcut,
    };
  if (/ai\/|Agent|Proposal/.test(file))
    return {
      domain: 'ASSISTANT',
      object: 'Application',
      task: 'Automate',
      canonical: 'assistant.actions',
      commandId: 'agent.tool/Proposal → Transaction',
      context: 'AssistantMode',
    };
  if (/Assets/.test(file))
    return {
      domain: 'PROJECT',
      object: 'Asset',
      task: 'Manage',
      canonical: 'panel.project',
      commandId: 'asset.create / asset.remove (instance binding)',
      context: 'Project',
    };
  if (/Compositing/.test(file))
    return {
      domain: 'COMPOSITING',
      object: 'GraphNode',
      task: 'Process',
      canonical: /Inspector|Controls/.test(file)
        ? 'panel.inspector.effects'
        : 'context.node',
      commandId: 'graphCommand (instance binding)',
      context: 'GraphSelection',
    };
  if (/GraphEditor|Motion|Curve/.test(file))
    return {
      domain: 'MOTION',
      object: 'Property,Keyframe',
      task: 'Animate',
      canonical: 'motion.toolbar',
      commandId: 'applyMotionCurveCommands / view state (instance binding)',
      context: 'PropertySelection,KeyframeSelection',
    };
  if (
    /Inspector|Controls|AnimatedField|fields|inspector-sections|PathEditor|PivotSelector/.test(
      file,
    )
  )
    return {
      domain: 'INSPECTOR',
      object: 'Property',
      task: 'Transform,Style',
      canonical: file.includes('inspector-sections')
        ? ({
            SectionTransform: 'panel.inspector.transform',
            SectionAppearance: 'panel.inspector.appearance',
            SectionText: 'panel.inspector.text',
            SectionGeometry: 'panel.inspector.geometry',
            SectionThreeD: 'panel.inspector.3d',
            SectionStructure: 'panel.inspector.structure',
            SectionTime: 'panel.inspector.time',
            SectionEffects: 'panel.inspector.effects',
            SectionSemantic: 'panel.inspector.semantic',
          }[r.owner] ?? 'panel.inspector.transform')
        : /ThreeD/.test(file)
          ? 'panel.inspector.3d'
          : /Structure/.test(file)
            ? 'panel.inspector.structure'
            : /Appearance|Path/.test(file)
              ? 'panel.inspector.geometry'
              : 'panel.inspector.transform',
      commandId: 'EditorStore.valueCommand / layer.patch (instance binding)',
      context: 'LayerSelection',
    };
  if (/Timeline|LayerTimeBar/.test(file))
    return {
      domain: 'TIMELINE',
      object: 'Layer,Property,Keyframe',
      task: 'Animate,Navigate',
      canonical: 'timeline.header',
      commandId: 'layer timing / keyframe.* / UI transport (instance binding)',
      context: 'TimelineMode',
    };
  if (/LayerPanel|layer-|object-actions|CreateLayerMenu/.test(file))
    return {
      domain: 'SCENE',
      object: 'Layer',
      task: 'Organize,Create',
      canonical: 'context.layer',
      commandId: 'layer.* / parentCommands (instance binding)',
      context: 'LayerSelection,Composition',
    };
  if (/Canvas|SpatialViewport|Gizmo|TransformOverlay|guidance/.test(file))
    return {
      domain: 'CANVAS',
      object: 'SceneObject',
      task: 'Transform,Navigate',
      canonical: 'toolbar.canvas',
      commandId: 'valueCommand / UI viewport (gesture binding)',
      context: 'CanvasMode,Selection',
    };
  return {
    domain: 'APPLICATION',
    object: 'Application',
    task: 'Manage',
    canonical: 'menu.file',
    commandId: 'application command / dialog state (workflow binding)',
    context: 'Global',
  };
};
const rows = entries.map((r) => {
  const c = classify(r);
  return {
    id: r.id,
    name: r.name,
    description: `${r.kind} 入口；${r.area}`,
    domain: c.domain,
    objectType: c.object,
    taskType: c.task,
    frequency:
      c.frequency ??
      (/NumberField|AnimatedField|scrub/.test(r.kind + r.name)
        ? 'F1'
        : r.frequency),
    context: c.context,
    currentLocations: [`${r.file}:${r.line}`],
    canonicalLocation: c.canonical,
    secondaryLocations: c.secondary ?? [],
    shortcut: c.shortcut ?? null,
    commandId: c.commandId,
    discoverability: r.discovery,
    severity: 0,
    registration: /instance|gesture|workflow|Proposal/.test(c.commandId)
      ? 'registered surface / parameterized workflow'
      : 'Feature Registry',
  };
});
fs.writeFileSync(
  'outputs/ia-refactor/feature-inventory.json',
  JSON.stringify({ features: features.all(), entries: rows }, null, 2) + '\n',
);
const fields = [
  'id',
  'name',
  'description',
  'domain',
  'objectType',
  'taskType',
  'frequency',
  'context',
  'currentLocations',
  'canonicalLocation',
  'secondaryLocations',
  'shortcut',
  'commandId',
  'discoverability',
  'severity',
];
fs.writeFileSync(
  'FEATURE_INVENTORY.md',
  `# Feature Inventory\n\n当前工作树扫描 ${entries.length} 个源码入口，注册 ${features.all().length} 个可搜索/可呈现 Feature。扫描表达式和重复实例按入口族保留；原始基线 467 条见 before-entry-inventory.json。字段、端口、轨道、对话框内状态不冒充无参数全局命令，它们由注册 Section/Tool/Node/workflow 拥有，使用参数化核心 Command；对应行显式标注 instance/gesture/workflow binding。元数据推断不等于真人发现性验证，severity=0 表示本轮未对该单独实例确认问题，问题等级见 UX_ARCHITECTURE_AUDIT.md。\n\n## Registered feature definitions\n\n| ID | Name | Domain | Object | Task | Frequency | Context | Canonical | Secondary | Command | Shortcut |\n|---|---|---|---|---|---|---|---|---|---|---|\n` +
    features
      .all()
      .map(
        (f) =>
          `| ${[f.id, f.title, f.domain, f.objectTypes.join(','), f.tasks.join(','), f.frequency, f.contexts.join(','), f.placement.canonical, (f.placement.secondary ?? []).join(','), f.commandId, f.shortcut].map(clean).join(' | ')} |`,
      )
      .join('\n') +
    `\n\n## 全部控件与动态入口族\n\n| ${fields.join(' | ')} |\n| ${fields.map(() => '---').join(' | ')} |\n` +
    rows
      .map(
        (r) =>
          `| ${fields.map((k) => clean(Array.isArray(r[k]) ? r[k].join(',') : r[k])).join(' | ')} |`,
      )
      .join('\n') +
    '\n',
);
fs.writeFileSync(
  'FEATURE_LOCATION_MATRIX.md',
  `# Feature Location Matrix\n\n主归属来自生产 Feature Registry；secondary 必须服务不同工作流。完整参数与动态控件位置见 FEATURE_INVENTORY.md。\n\n| Feature | Primary Location | Secondary | Shortcut | Permanent UI |\n|---|---|---|---|---|\n` +
    features
      .all()
      .map(
        (f) =>
          `| ${[f.id + ' ' + f.title, f.placement.canonical, (f.placement.secondary ?? []).join(','), f.shortcut, [f.placement.canonical, ...(f.placement.secondary ?? [])].some((p) => p.startsWith('toolbar.')) ? 'budgeted' : 'context/menu/section'].map(clean).join(' | ')} |`,
      )
      .join('\n') +
    '\n',
);
console.log(
  JSON.stringify({ entries: rows.length, features: features.all().length }),
);
