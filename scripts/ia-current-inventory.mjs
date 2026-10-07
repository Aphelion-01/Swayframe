import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const baseline = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const collect = (root) =>
  fs
    .readdirSync(root, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? collect(`${root}/${e.name}`)
        : /\.tsx?$/.test(e.name)
          ? [`${root}/${e.name}`]
          : [],
    );
const files = ['src/ui', 'src/desktop', 'apps/desktop/electron']
  .flatMap(collect)
  .sort();
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
            : /Inspector|inspector-sections|Controls|AnimatedField|PathEditor|fields|axis-link/.test(
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
  const source = fs.readFileSync(file, 'utf8'),
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
      const wrong = /__no_automatic_severity__/.test(file)
        ? 'Wrong'
        : /层级与时间|效果与遮罩/.test(label)
          ? 'Wrong'
          : /Toolbar/.test(file) && /menu|Registry/.test(kind)
            ? 'Acceptable'
            : 'Good';
      let ownerNode = node.parent;
      while (ownerNode && !ts.isFunctionDeclaration(ownerNode))
        ownerNode = ownerNode.parent;
      const owner = ownerNode?.name?.getText(ast) ?? '';
      rows.push({
        owner,
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
fs.mkdirSync('outputs/ia-refactor', { recursive: true });
fs.writeFileSync(
  'outputs/ia-refactor/entry-inventory.json',
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

console.log(
  `Scanned ${rows.length} entries from ${files.length} files at ${baseline}`,
);
