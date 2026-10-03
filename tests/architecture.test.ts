import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(join(directory, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [join(directory, entry.name)]
        : [],
  );
}
describe('A-10 架构检查', () => {
  it('核心无 React / DOM / 具体 Renderer 反向依赖，未禁用类型检查', () => {
    const forbidden = new Set([
      'window',
      'document',
      'HTMLElement',
      'HTMLCanvasElement',
      'CanvasRenderingContext2D',
      'ImageBitmap',
      'localStorage',
      'requestAnimationFrame',
      'fetch',
    ]);
    const violations: string[] = [];
    for (const file of sources('src/core')) {
      const text = readFileSync(file, 'utf8');
      const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      if (/@ts-(ignore|nocheck|expect-error)/.test(text))
        violations.push(`${file}: disabled typecheck`);
      const visit = (node: ts.Node) => {
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          /react|\/ui\/|\/renderers\//.test(node.moduleSpecifier.text)
        )
          violations.push(`${file}: reverse import`);
        if (ts.isIdentifier(node) && forbidden.has(node.text))
          violations.push(`${file}: ${node.text}`);
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    expect(violations).toEqual([]);
  });
  it('UI / Agent / Provider 没有对模型对象赋值或集合原地修改', () => {
    const files = sources('src');
    const program = ts.createProgram(files, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      skipLibCheck: true,
    });
    const checker = program.getTypeChecker();
    const model = (type: ts.Type): boolean => {
      if (type.isUnionOrIntersection()) return type.types.some(model);
      const symbol = type.aliasSymbol ?? type.getSymbol();
      return (
        symbol?.declarations?.some((d) =>
          /\/(project-model|core-types)\.ts$/.test(d.getSourceFile().fileName),
        ) ?? false
      );
    };
    const violations: string[] = [];
    for (const file of files.filter(
      (file) =>
        file.startsWith('src/ui/') ||
        /agent-contracts|intelligence-contracts|proposal-commands/.test(file),
    )) {
      const ast = program.getSourceFile(file)!;
      const visit = (node: ts.Node) => {
        if (
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
          (ts.isPropertyAccessExpression(node.left) ||
            ts.isElementAccessExpression(node.left)) &&
          model(checker.getTypeAtLocation(node.left.expression))
        )
          violations.push(`${file}: model assignment`);
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          [
            'push',
            'splice',
            'pop',
            'shift',
            'unshift',
            'sort',
            'reverse',
          ].includes(node.expression.name.text)
        ) {
          // Mutating a fresh spread copy does not modify the Scene's readonly array.
          if (ts.isArrayLiteralExpression(node.expression.expression)) return;
          const type = checker.getTypeAtLocation(node.expression.expression);
          if (
            type.getSymbol()?.name === 'Array' ||
            type.getSymbol()?.name === 'ReadonlyArray'
          ) {
            const args = checker.getTypeArguments(type as ts.TypeReference);
            if (args.some(model))
              violations.push(`${file}: model array mutation`);
          }
        }
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(ast) === 'Object.assign' &&
          node.arguments[0] &&
          model(checker.getTypeAtLocation(node.arguments[0]))
        )
          violations.push(`${file}: Object.assign(model)`);
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    expect(violations).toEqual([]);
  });
});
