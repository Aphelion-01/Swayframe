// Runs on the documented Browser plugin Tab API; never reads app internals.
import assert from 'node:assert/strict';

export const readNumber = async (tab, label) =>
  Number(
    await tab.playwright
      .getByLabel(label, { exact: true })
      .evaluate((el) => el.value),
  );
export async function editNumber(tab, label, value) {
  await tab.playwright.getByLabel(label, { exact: true }).fill(String(value));
  await tab.playwright
    .getByRole('heading', { name: '属性', exact: true })
    .click();
}
export const historyCount = async (tab) =>
  parseInt(await tab.playwright.locator('.history-tools span').inner文字(), 10);
export async function uploadFile(tab, buttonName, path) {
  const event = tab.playwright.waitForEvent('filechooser', {
    timeoutMs: 10000,
  });
  await tab.playwright
    .getByRole('button', { name: buttonName, exact: true })
    .click();
  const chooser = await event;
  await chooser.setFiles([path]);
}
export async function downloadFile(tab, resolveNativeDownload) {
  const started = Date.now();
  const event = tab.playwright.waitForEvent('download', { timeoutMs: 10000 });
  await tab.playwright
    .getByRole('button', { name: '保存工程 ↗', exact: true })
    .click();
  let path;
  try {
    const download = await event;
    path = await download.path();
  } catch (error) {
    if (!resolveNativeDownload) throw error;
    path = await resolveNativeDownload(started);
  }
  assert.ok(path, 'Downloaded project path');
  return path;
}
export async function manualPhase(tab) {
  const passed = [];
  await tab.playwright
    .getByRole('button', { name: '新建合成', exact: true })
    .click();
  for (const [key, value] of Object.entries({
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
  }))
    await tab.playwright
      .getByLabel(
        `新合成 ${{ width: '宽度', height: '高度', fps: '帧率', duration: '时长' }[key]}`,
        { exact: true },
      )
      .fill(String(value));
  await tab.playwright
    .getByRole('button', { name: '创建合成', exact: true })
    .click();
  // Baseline manual-key workflow; the extension's default auto-key workflow has separate acceptance.
  await tab.playwright
    .getByRole('checkbox', { name: '自动记录位置关键帧', exact: true })
    .uncheck();
  await tab.playwright
    .getByRole('button', { name: '创建 矩形', exact: true })
    .click();
  assert.equal(await readNumber(tab, '位置 X'), 960);
  assert.equal(await readNumber(tab, '位置 Y'), 540);
  assert.equal(
    await tab.playwright
      .getByRole('button', { name: '选择 矩形', exact: true })
      .count(),
    1,
  );
  passed.push('A-01');
  const rect = await tab.playwright.getByTestId('canvas').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const count = await historyCount(tab);
  await tab.cua.drag({
    path: [
      { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      { x: rect.x + rect.width / 2 + 12, y: rect.y + rect.height / 2 + 8 },
      { x: rect.x + rect.width / 2 + 24, y: rect.y + rect.height / 2 + 12 },
    ],
  });
  assert.equal(await historyCount(tab), count + 1);
  assert.ok(
    Math.abs(
      (await readNumber(tab, '位置 X')) - (960 + (24 * 1920) / rect.width),
    ) < 2,
  );
  await tab.playwright
    .getByRole('button', { name: '撤销', exact: true })
    .click();
  assert.equal(await readNumber(tab, '位置 X'), 960);
  await tab.playwright
    .getByRole('button', { name: '重做', exact: true })
    .click();
  passed.push('A-05');
  await editNumber(tab, '缩放 X（%）', 150);
  await editNumber(tab, '旋转（°）', 25);
  await editNumber(tab, '透明度（%）', 80);
  for (let i = 0; i < 3; i++)
    await tab.playwright
      .getByRole('button', { name: '撤销', exact: true })
      .click();
  assert.equal(await readNumber(tab, '缩放 X（%）'), 100);
  assert.equal(await readNumber(tab, '旋转（°）'), 0);
  assert.equal(await readNumber(tab, '透明度（%）'), 100);
  for (let i = 0; i < 3; i++)
    await tab.playwright
      .getByRole('button', { name: '重做', exact: true })
      .click();
  assert.equal(await readNumber(tab, '缩放 X（%）'), 150);
  assert.equal(await readNumber(tab, '旋转（°）'), 25);
  passed.push('A-02');
  await editNumber(tab, '缩放 X（%）', 100);
  await editNumber(tab, '旋转（°）', 0);
  await tab.playwright.getByLabel('当前时间（秒）', { exact: true }).fill('0');
  await editNumber(tab, '位置 X', -120);
  await editNumber(tab, '位置 Y', 540);
  await editNumber(tab, '透明度（%）', 0);
  for (const property of ['位置', '透明度'])
    await tab.playwright
      .getByRole('button', {
        name: `添加 矩形 ${property} 关键帧`,
        exact: true,
      })
      .click();
  await tab.playwright.getByLabel('当前时间（秒）', { exact: true }).fill('1');
  await editNumber(tab, '位置 X', 960);
  await editNumber(tab, '透明度（%）', 100);
  await tab.playwright.getByLabel('当前时间（秒）', { exact: true }).fill('0');
  await tab.playwright
    .getByLabel('插值 矩形 位置', { exact: true })
    .selectOption('spring');
  await tab.playwright
    .getByLabel('当前时间（秒）', { exact: true })
    .fill('0.5');
  assert.equal(await readNumber(tab, '透明度（%）'), 50);
  assert.ok((await readNumber(tab, '位置 X')) > 500);
  await tab.playwright.getByLabel('当前时间（秒）', { exact: true }).fill('1');
  assert.equal(await readNumber(tab, '位置 X'), 960);
  assert.equal(
    await tab.playwright
      .getByRole('button', {
        name: '关键帧 矩形 位置 0.000 秒',
        exact: true,
      })
      .count(),
    1,
  );
  assert.equal(
    await tab.playwright
      .getByRole('button', {
        name: '关键帧 矩形 位置 1.000 秒',
        exact: true,
      })
      .count(),
    1,
  );
  await tab.playwright
    .getByRole('button', { name: '回到起点', exact: true })
    .click();
  await tab.playwright
    .getByRole('button', { name: '播放', exact: true })
    .click();
  return { passed, playbackStarted: true };
}
export async function assetsAndSavePhase(
  tab,
  imagePath,
  resolveNativeDownload,
) {
  await tab.playwright
    .getByRole('button', { name: '暂停', exact: true })
    .click();
  assert.ok((await readNumber(tab, '当前时间（秒）')) > 0);
  await tab.playwright.getByLabel('当前时间（秒）', { exact: true }).fill('1');
  await tab.playwright
    .getByRole('button', { name: '创建 椭圆', exact: true })
    .click();
  await tab.playwright
    .getByRole('button', { name: '创建 文字', exact: true })
    .click();
  await uploadFile(tab, '导入 图片', imagePath);
  await tab.playwright
    .getByRole('button', { name: '选择 图片', exact: true })
    .click();
  const downloadPath = await downloadFile(tab, resolveNativeDownload);
  return { passed: ['A-03'], downloadPath };
}
export async function agentAndProposalPhase(
  tab,
  savedPath,
  resolveNativeDownload,
) {
  await uploadFile(tab, '打开工程', savedPath);
  await tab.playwright
    .getByRole('button', { name: '选择 矩形', exact: true })
    .click();
  await tab.playwright.getByLabel('当前时间（秒）', { exact: true }).fill('0');
  await tab.playwright
    .getByLabel('插值 矩形 位置', { exact: true })
    .evaluate((el) => {
      if (el.value !== 'spring') throw new Error('Spring not restored');
    });
  await tab.playwright.getByLabel('当前时间（秒）', { exact: true }).fill('1');
  assert.equal(await readNumber(tab, '位置 X'), 960);
  assert.equal(await historyCount(tab), 0);
  const passed = ['A-04'];
  const reopenedPath = await downloadFile(tab, resolveNativeDownload);
  await tab.playwright
    .getByRole('button', { name: '生成入场动画 ↗', exact: true })
    .click();
  assert.equal(await historyCount(tab), 1);
  assert.equal(await readNumber(tab, '位置 X'), 960);
  assert.equal(
    await tab.playwright
      .getByRole('button', {
        name: '关键帧 蓝色方块入场 位置 0.000 秒',
        exact: true,
      })
      .count(),
    1,
  );
  passed.push('A-06');
  await tab.playwright
    .getByRole('button', { name: '撤销', exact: true })
    .click();
  assert.equal(
    await tab.playwright
      .getByRole('button', { name: '选择 蓝色方块入场', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await tab.playwright
      .getByRole('button', { name: '选择 矩形', exact: true })
      .count(),
    1,
  );
  passed.push('A-07');
  await tab.playwright
    .getByRole('button', { name: '重做', exact: true })
    .click();
  await tab.playwright
    .getByRole('button', { name: '选择 蓝色方块入场', exact: true })
    .click();
  await editNumber(tab, '旋转（°）', 15);
  assert.equal(await readNumber(tab, '旋转（°）'), 15);
  await tab.playwright
    .getByRole('button', { name: '选择 矩形', exact: true })
    .click();
  await editNumber(tab, '位置 X', 1100);
  const before = await historyCount(tab);
  await tab.playwright
    .getByRole('button', { name: '布局建议', exact: true })
    .click();
  await tab.playwright
    .getByRole('button', { name: '应用建议', exact: true })
    .count();
  assert.equal(await readNumber(tab, '位置 X'), 1100);
  assert.equal(await historyCount(tab), before);
  await tab.playwright
    .getByRole('button', { name: '应用建议', exact: true })
    .click();
  assert.equal(await readNumber(tab, '位置 X'), 960);
  await tab.playwright
    .getByRole('button', { name: '撤销', exact: true })
    .click();
  assert.equal(await readNumber(tab, '位置 X'), 1100);
  passed.push('A-08');
  return { passed, reopenedPath };
}
export async function errorPhase(tab, invalidPath, unknownPath) {
  const before = await historyCount(tab);
  const x = await readNumber(tab, '位置 X');
  for (const [path, message] of [
    [invalidPath, 'JSON 语法错误'],
    [unknownPath, '不支持工程版本'],
  ]) {
    await uploadFile(tab, '打开工程', path);
    const alert = await tab.playwright.getByRole('alert').inner文字();
    assert.ok(alert.includes(message));
    assert.equal(await historyCount(tab), before);
    assert.equal(await readNumber(tab, '位置 X'), x);
  }
  return {
    passed: ['A-09'],
    errors: await tab.dev.logs({ levels: ['error'], limit: 10 }),
  };
}
