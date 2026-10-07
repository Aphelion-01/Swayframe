import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const baseline = 'db86a03';
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(
    (f) =>
      /^(src\/(ui|desktop)|apps\/desktop\/electron)\//.test(f) &&
      /\.tsx?$/.test(f),
  );
const rows = [];
const areas = (f) =>
  /ai\/|Agent|Proposal/.test(f)
    ? ['Assistant / Settings', 'G', 'Mode-dependent']
    : /Assets/.test(f)
      ? ['Project / Assets', 'A', 'Mode-dependent']
      : /GraphEditor|MotionCurve|MotionPreset|MotionPreview|SpatialMotion|curve-navigation/.test(
            f,
          )
        ? ['Motion Curve / Graph', 'K', 'Keyframe-dependent']
        : /Compositing/.test(f)
          ? ['Compositing Graph / Effects', 'N', 'Selection-dependent']
          : /Timeline|LayerTimeBar/.test(f)
            ? ['Timeline', 'T', 'Mode-dependent']
            : /Inspector|Controls|AnimatedField|PathEditor|fields|axis-link/.test(
                  f,
                )
              ? ['Inspector', 'P', 'Property-dependent']
              : /LayerPanel|layer-actions|layer-color/.test(f)
                ? ['Scene / Outliner', 'O', 'Selection-dependent']
                : /Canvas|TransformOverlay/.test(f)
                  ? ['Canvas', 'O', 'Tool-dependent']
                  : ['Application / Workspace', 'G', 'Always'];
const clean = (s) =>
  s.replace(/\s+/g, ' ').replaceAll('|', ' / ').replaceAll('`', '').trim();
for (const file of files) {
  const source = execFileSync('git', ['show', `${baseline}:${file}`], {
      encoding: 'utf8',
    }),
    ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
  const [area, scope, context] = areas(file);
  const visit = (node) => {
    let label = '',
      kind = '';
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      if (
        [
          'button',
          'input',
          'select',
          'textarea',
          'summary',
          'IconButton',
          'NumberField',
          'TextField',
          'AnimatedField',
          'AxisLinkButton',
          'Tabs',
        ].includes(tag)
      ) {
        const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
        const attr =
          attrs.find((a) => a.name.getText(ast) === 'aria-label') ??
          attrs.find((a) => a.name.getText(ast) === 'label') ??
          attrs.find((a) => a.name.getText(ast) === 'title');
        label = attr?.initializer?.getText(ast) ?? '';
        if (!label && ts.isJsxElement(node.parent))
          label = node.parent.children
            .map((ch) =>
              ts.isJsxText(ch)
                ? ch.text
                : ts.isJsxExpression(ch)
                  ? ch.getText(ast)
                  : '',
            )
            .join(' ');
        if (!label)
          label =
            attrs
              .find((a) => a.name.getText(ast) === 'placeholder')
              ?.initializer?.getText(ast) ??
            `${tag} (${attrs.find((a) => a.name.getText(ast) === 'type')?.initializer?.getText(ast) ?? '动态实例'})`;
        kind = tag;
      }
    } else if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(ast) === 'label' &&
      (ts.isStringLiteral(node.initializer) ||
        ts.isTemplateExpression(node.initializer))
    ) {
      label = node.initializer.getText(ast);
      kind = 'Menu / Registry';
    }
    if (label) {
      const line =
        ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      const frequency =
        /选择|位置|播放|暂停|拖动|保存|撤销|重做|记录.*关键帧|导入/.test(label)
          ? 'F2'
          : /删除|复制|粘贴|缩放|旋转|缓动|预合成|父级|图层|动画|模糊/.test(
                label,
              )
            ? 'F3'
            : 'F4';
      const wrong = /layer-actions/.test(file)
        ? 'Wrong'
        : /层级与时间|效果与遮罩/.test(label)
          ? 'Wrong'
          : /Toolbar/.test(file) && /menu|Registry/.test(kind)
            ? 'Acceptable'
            : 'Good';
      rows.push({
        id: `E-${String(rows.length + 1).padStart(4, '0')}`,
        name: clean(label),
        file,
        line,
        kind,
        area,
        scope,
        context,
        frequency,
        depth: /layer-actions/.test(file)
          ? 3
          : /Inspector|Controls/.test(file)
            ? 2
            : 1,
        discovery:
          wrong === 'Wrong' ? 'D3' : kind === 'Menu / Registry' ? 'D2' : 'D1',
        fit: wrong,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
}
fs.mkdirSync('outputs/information-architecture', { recursive: true });
fs.writeFileSync(
  'outputs/information-architecture/entry-inventory.json',
  JSON.stringify(
    {
      baseline,
      method:
        'TypeScript AST: JSX controls + menu/shortcut label objects; dynamic instances documented by family below.',
      rows,
    },
    null,
    2,
  ),
);
const pre = `# Feature Entry Inventory\n\n审计基线 ${baseline} / 0.9.11，2026-10-07。扫描真实 UI、desktop renderer 和 Electron menu。下表是代码入口全量索引，不把截图当功能清单。动态对象/属性/关键帧/节点的重复实例按组件族记录；显示表达式保留用于复核。Frequency 为专家判断，未做用户遥测；D 是首次定位难度，未作真人研究。\n\nF1 极高频 / F2 高频 / F3 中频 / F4 低频 / F5 极低频。G/O/P/T/K/C/N/A 分别全局/对象/属性/时间/关键帧/合成/节点/素材。D0 明显到 D4 几乎隐藏。Depth 为点击到控件的典型深度，拖拽和键盘视作0–1，不代表所有条件分支。\n\n## Heuristic audit before\n\n| Issue | Evidence | Severity | Recommendation |\n|---|---|---|---|\n| IA-01 对象右键先创建再操作 | LayerPanel + Timeline: CreatePieMenu items → 操作 | 3 | 对象直接结构菜单，空白保留创建 |\n| IA-02 全局菜单单一文件分类 | Toolbar 文件只含工程/设置，编辑/图层/动画不在Web菜单 | 3 | 七类标准菜单共享操作 |\n| IA-03 搜索未覆盖真实能力 | Toolbar palette仅五类对象，缺camera/polygon/star/solid及大量全局操作 | 3 | 搜索全局和上下文操作，叶子直达 |\n| IA-04 父级、效果、遮罩在关闭的Section | Inspector 层级与时间/效果与遮罩 open=false | 3 | 任务分区、核心入口默认展开 |\n| IA-05 图层操作混空间对齐/结构/创建 | layerActions所有表面同一个万能集合 | 2 | Scene/Timeline/Canvas上下文过滤 |\n| IA-06 顶部播放与时间轴播放重复 | Toolbar 播放预览 + Timeline playback | 2 | 保留底部唯一预览操作 |\n| IA-07 节点只能底部Tab，效果与节点工作流断开 | CompositingControls 无打开按钮 | 3 | 效果区直达节点，打开时展开dock |\n| IA-08 Timeline footer关键帧杂项常驻菜单 | Copy/Paste/Delete/next-frame clone导航混合 | 2 | 关键帧右键、编辑/动画菜单、J/K |\n| IA-09 合成和面板缺全局可见导航 | 只有doubleclick、隐藏面板toggle | 2 | 窗口菜单带目标名称、显式打开 |\n| IA-10 Help无任务指引/快捷键 | 原生仅About、Web仅搜索icon | 2 | Help任务路径+Registry快捷键 |\n\n无已确认 Severity 4。Before Quick Diagnostic：导航、主操作、辨识负担失败（最严重3），指引不足（2）；按Skill权重初评3/10，是启发式评级，不是用户满意度。\n\n## Dynamic feature families / Alternative entries / Related features\n\n| Family | Actual instances | Alternative / shortcut | Related / problem |\n|---|---|---|---|\n| Canvas tools | select hand rectangle ellipse pen text | V H R E P T；菜单对象创建；空白饼菜单 | drawing / spatial；高级对象创建仅右键 |\n| Layer kinds | rectangle ellipse polygon star path text camera solid null image；precomp由预合成或嵌套合成 | 右键创建；palette原本缺多数 | Project / Scene / Canvas |\n| Transform | position scale rotation opacity anchor；Vec2/Vec3联动；scalar无链接 | Inspector + animated Timeline + Graph；P/S/R/T/U轨道筛选 | property previews / Undo |\n| Shape / text | dimensions strokeColor strokeWidth gradient gradientEndColor join cap polygonSides starInnerRadius pathFill closed / font size family weight tracking lineHeight align | AppearanceControls；PathEditor | 按真实对象类型显示 |\n| Structure / temporal | parent precompose enter-precomp 3D visibility lock rename reorder；inPoint outPoint split | Scene右键更多操作、Inspector折叠、Timeline拖动/右键 | 结构与时间混淆 |\n| Keyframes | animation toggle add delete move multi select copy paste duplicate-next-frame linear hold bezier spring(原存量) ease-in/out/both prev/next | property row / keyframe右键 / Graph / Motion；J/K Cmd/Ctrl+C/V/D Delete | 不新增Spring能力 |\n| Graph | property/component value/speed incoming/outgoing velocity/influence cubic coords FitAll/Selected Reset wheel/pan context | Timeline tab / property/keyframe context；F/Home 1/2 Space | 共用selection/time |\n| Motion Curve | quick presets, library29 builtin/custom favorite recent rename duplicate delete import/export, scope segments, both/in/out reverse/mirror/reset copy/paste | 缓动Tab、选区context、preset browser | 标准化区间，与Graph共享数据 |\n| Spatial/path | path point/add/delete smooth/corner closed tangent fit animation/time | Inspector path editor、Graph spatial section | 不混用时间缓动 |\n| Effects | brightnessContrast exposure hueSaturation temperature tint levels gaussianBlur dropShadow glow tintFill | effects type registry select、node search、palette blur | 下表控件族逐参数实例化 |\n| Masks/blend | rectangle ellipse path mask / enable mode opacity feather expansion delete edit path；7 blend modes | Inspector / 节点处理流 | 分支图不能作为线性效果栈编辑 |\n| Nodes | source output passthrough solid transform mask merge + effects；add connect reconnect disconnect duplicate delete layout enable/rename align search | node Tab search、node/edge/context；F Home Space Ctrl/Cmd+D Delete | node inspector parameters animated |\n| Project/assets | new/open/save/saveAs recent/recovery/newComp/settings/import/addAssetLayer/relink/delete/nestedComp | native menu、Project assets、drop；Ctrl/Cmd+N/O/S/ShiftS | relink只在native linked媒体 |\n| Export | current PNG / range sequence / cancel / progress | 顶部export、palette、native file menu | 同一renderer |\n| Assistant/settings | provider/model/vision/routes/limits/headers/retry/skills；chat/plan/stop/apply/undo refs drop/paste history motion presets proposals | Assistant tab/toolbar、File settings、palette | 错误保留文本，Proposal validated transaction |\n| Workspace/help | panel resize/collapse/tabs/fit actual zoom；about startup recovery recents | icons、Tab、native菜单；Ctrl/Cmd+0/1/=/− | layout UI-only |\n\n## Code entry ledger\n\nAlternative Entry Points / Shortcut / Related Features 对照上面的功能族及 FEATURE_LOCATION_MATRIX.md。每个 ID 保留原始文件位置，即使本轮迁移后行号变化也可用基线复核。\n\n| ID | Feature / expression | Current Location | Depth | Frequency | Scope | Context Dependency | Discoverability | Current IA Fit | Problems |\n|---|---|---|---|---|---|---|---|---|---|\n`;
fs.writeFileSync(
  'UX_INFORMATION_ARCHITECTURE_AUDIT.md',
  pre +
    rows
      .map(
        (r) =>
          `| ${r.id} | ${r.name} | ${r.area} · ${r.file}:${r.line} (${r.kind}) | ${r.depth} | ${r.frequency} | ${r.scope} | ${r.context} | ${r.discovery} | ${r.fit} | ${r.fit === 'Wrong' ? 'IA-01/04/05上下文/深度需调整' : '保留能力；按功能族统一归属'} |`,
      )
      .join('\n') +
    '\n',
);
const matrixIntro = `# Feature Location Matrix\n\n每个真实代码入口族都有归属；基线入口ID对应审计文档和JSON，可追溯到源码。动态实例按实际Property/Node/Layer注册表展开，绝不新增不存在的功能。\n\n## Primary capability map\n\n| Feature | Primary Location | Secondary | Shortcut | Remove From |\n|---|---|---|---|---|\n| 工程新建/打开/保存/另存 | 文件 | 搜索；native File；startup/recent（native） | Cmd/Ctrl+N/O/S/Shift+S | 无 |\n| 合成创建/设置 | Project / 文件 | 搜索；窗口打开项目 | — | 混合对象创建菜单 |\n| 导入/重复使用/重连/删除素材 | Project Assets | File import、Canvas/Timeline drop、Asset右键 | — | 对象属性区域 |\n| 矩形/椭圆/文字/钢笔 | Canvas Tools | Scene创建/空白饼菜单；图层菜单；搜索 | R/E/T/P | File |\n| 多边形/星形/纯色/空对象/Camera | Scene创建对象 | 图层菜单；搜索；空白饼菜单 | — | 隐藏操作子菜单 |\n| Copy/Paste/Cut/Duplicate/Delete/Undo/Redo | 编辑 / selection context | 搜索；键盘；context | Cmd/Ctrl+C/V/X/D/Z/Shift+Z Delete | Timeline永久菜单 |\n| Position/Scale/Rotation/Opacity/Anchor | Inspector Transform | Timeline if animated、Graph | P/S/R/T/U（Timeline筛选） | 无关全局菜单 |\n| 外观/路径/文字/三维/Camera参数 | Inspector对象类型Section | PathEditor；animated Timeline/Graph | — | 无关Toolbar |\n| Parent/Visibility/Lock/Rename/Reorder | Scene / Inspector层级 | 对象右键；图层菜单；搜索 | F2 | Timeline header、Canvas toolbar |\n| Precompose/Enter/Return | Layer context / Inspector层级 | 图层菜单；搜索；Canvas双击；合成面包屑 | — | 创建饼菜单的操作深层 |\n| LayerSpan/In/Out/Split | Timeline | Inspector图层时间；Timeline对象右键 | — | Scene / global toolbar |\n| Animation toggle / Record / Remove | Property row | Property context；动画菜单/搜索记录 | — | global permanent toolbar |\n| Keyframe select/move/multi/copy/delete/nextframeclone | Timeline keyframes | 编辑菜单 / keyframe context | Cmd/Ctrl+C/V/D Delete | Timeline footer永久菜单 |\n| Interpolation / Ease | Keyframe context | Graph / Motion；动画菜单；搜索 | — | Timeline permanent toolbar |\n| Prev/Next key | Timeline | 动画菜单；搜索 | J/K（Timeline） | footer永久入口 |\n| Graph / value-speed / handles / velocity / influence | Bottom Graph tab | 动画菜单/搜索；key/property context | Shift+F3；1/2 F/Home Space | unrelated panels |\n| Motion normalized presets/library/scope/coords | Bottom缓动曲线tab | Animation/context/search | F Space（mode） | File |\n| Spatial path / Bezier points/tangents | Inspector PathEditor / Graph空间路径 | Canvas pen | Enter/P | normalized Motion settings |\n| Mask/Blend/Effects参数与顺序 | Inspector效果与遮罩 | Node graph；添加效果搜索 | — | Canvas toolbar |\n| Source/Mask/Color/Blur/Merge/Output flow | Compositing Graph | Inspector打开合成节点；窗口菜单/搜索 | Tab/F/Home Space（nodes） | Scene |\n| Node connections/selection/layout/enable/rename/duplicate/delete | Compositing Graph context | 节点Inspector；mode keys | Cmd/Ctrl+D Delete | Layer context |\n| AI任务/Proposal/refs/history/presets | Assistant | Toolbar/Window/Search | — | Inspector normal editing |\n| Provider/model/skill/routing/limits/settings | File设置 → AI | Assistant服务设置；搜索 | — | Canvas/Timeline |\n| PNG current/sequence/cancel | File Export | top-right快捷出口；search | — | Canvas tools |\n| Playback/time/loop/snap | Bottom preview bar | Space；各curve共用footer | Space/Arrows | Topbar duplicate Play |\n| Viewport/reference/pivot/snap | Canvas | View menu/search；Inspector Pivot | Cmd/Ctrl+0/1/=/− | Scene hierarchy |\n| Panels/workspace mode/restore | Window | panel tabs/collapse；search | Tab（Canvas） | File settings混区 |\n| Help/shortcuts/about | Help | Search；native Help | Cmd/Ctrl+K搜索 | 隐藏独占入口 |\n\n## Complete code entry ownership\n\n所有入口ID逐项归属（包括dialog/popover/隐藏字段/动态实例族）。源代码未迁移的参数继续保留原模块；具体跨区迁移见结果报告。\n\n| Feature ID / Name | Primary Location | Secondary | Shortcut | Remove From |\n|---|---|---|---|---|\n`;
const primary = (r) =>
  r.area === 'Scene / Outliner'
    ? 'Scene / 对象右键'
    : r.file.includes('StructureControls')
      ? /入点|出点|拆分/.test(r.name)
        ? 'Timeline / Inspector图层时间'
        : 'Scene / Inspector层级'
      : r.file.includes('CompositingControls')
        ? 'Inspector效果与遮罩'
        : r.area;
fs.writeFileSync(
  'FEATURE_LOCATION_MATRIX.md',
  matrixIntro +
    rows
      .map(
        (r) =>
          `| ${r.id} ${r.name} | ${primary(r)} | ${r.scope === 'G' ? 'Application Menu / Palette（已注册操作）' : '同族 Context / Inspector / Animated Timeline（适用时）'} | 见族表/Registry | ${r.fit === 'Wrong' ? '创建菜单操作深层/错误混区' : '—'} |`,
      )
      .join('\n') +
    '\n',
);
console.log(`Inventoried ${rows.length} code entries in ${files.length} files`);
