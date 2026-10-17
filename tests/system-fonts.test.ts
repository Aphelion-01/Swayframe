import { expect, it } from 'vitest';
import { fontQuery, parseFontFamilies } from '../apps/desktop/electron/fonts';
import { requestSchema } from '../src/desktop/contracts';
it('字体 IPC 只允许固定无参查询，不接受路径或脚本', () => {
  expect(requestSchema.safeParse({ method: 'fonts.list' }).success).toBe(true);
  for (const extra of [
    { path: '/tmp/font.ttf' },
    { script: 'evil' },
    { platform: 'win32' },
  ])
    expect(
      requestSchema.safeParse({ method: 'fonts.list', ...extra }).success,
    ).toBe(false);
  expect(fontQuery('darwin').file).toBe('/usr/bin/osascript');
  expect(fontQuery('win32').args).toContain('-NonInteractive');
});
it('读取系统字体名称，去重、清理无效项并保留中文字体', () => {
  expect(
    parseFontFamilies('\uFEFF["苹方", "Arial", "Arial", "", null, 4]', 'win32'),
  ).toEqual(['Arial', '苹方']);
  expect(
    parseFontFamilies('Noto Sans,思源黑体\nNoto Sans\n', 'linux'),
  ).toHaveLength(2);
  expect(() => parseFontFamilies('{}', 'darwin')).toThrow('列表无效');
});
