const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const out = path.resolve('outputs/agent-v2-6');
process.env.SWAYFRAME_USER_DATA = path.join(
  out,
  'packaged-smoke-userdata-' + Date.now(),
);
const root = path.resolve(
  'release/mac-arm64/Swayframe.app/Contents/Resources/app.asar',
);
const errors = [];
let finished = false;
app.on('browser-window-created', (_, win) => {
  win.on('show', () => win.hide());
  win.hide();
});
app.on('web-contents-created', (_, contents) => {
  contents.on('render-process-gone', (_e, d) => errors.push(d));
  contents.on('did-fail-load', (_e, code, message) =>
    errors.push({ code, message }),
  );
  contents.once('did-finish-load', async () => {
    await new Promise((r) => setTimeout(r, 1200));
    try {
      await contents.executeJavaScript(
        'Array.from(document.querySelectorAll("button")).find(b=>b.textContent?.trim()==="新建工程")?.click()',
      );
      await new Promise((r) => setTimeout(r, 2000));
      await contents.executeJavaScript(
        'location.hash = "#agent-v2-test"; window.dispatchEvent(new Event("motion:assistant"))',
      );
      await new Promise((r) => setTimeout(r, 300));
      await contents.executeJavaScript(
        'Array.from(document.querySelectorAll("button")).find(b=>b.textContent?.trim()==="打开 V2 隔离测试")?.click()',
      );
      await new Promise((r) => setTimeout(r, 300));
      const lab = await contents.executeJavaScript(
        '({visible:!!document.querySelector(".agent-v2-lab"),explicitRequired:Array.from(document.querySelectorAll("button")).find(b=>b.textContent?.trim()==="执行隔离任务")?.disabled})',
      );
      const state = await contents.executeJavaScript(
        '({title:document.title,body:document.body.innerText.slice(0,12000),canvasCount:document.querySelectorAll("canvas").length})',
      );
      const version = JSON.parse(
        await fs.readFile(path.join(root, 'package.json'), 'utf8'),
      ).version;
      const core = (await fs.readdir(path.join(root, 'dist/assets'))).find(
        (n) => n.startsWith('agentCoreV2-') && n.endsWith('.js'),
      );
      const exported = await contents.executeJavaScript(
        `import(new URL(${JSON.stringify('assets/' + core)},location.href).href).then(m=>({defaultRuntime:m.defaultAgentRuntime,isolatedFactory:typeof m.createIsolatedCoreV2,planner:typeof m.AgentPlanner,bridge:typeof m.ProviderBridge}))`,
      );
      await fs.writeFile(
        path.join(out, 'packaged-smoke.json'),
        JSON.stringify(
          {
            version,
            state,
            exported,
            errors,
            lab,
            pass:
              lab.visible &&
              lab.explicitRequired &&
              version === '1.0.2' &&
              state.canvasCount > 0 &&
              errors.length === 0 &&
              exported.defaultRuntime === 'legacy-v1' &&
              exported.isolatedFactory === 'function',
            scope:
              'packaged Mac main/preload/renderer + actual V2 ESM load; isolated profile; no provider calls; no Windows runtime certification',
          },
          null,
          2,
        ),
      );
      finished = true;
      app.exit(0);
    } catch (e) {
      await fs.writeFile(
        path.join(out, 'packaged-smoke.json'),
        JSON.stringify({ errors: [...errors, String(e)], pass: false }),
      );
      app.exit(1);
    }
  });
});
require(path.join(root, 'desktop-dist/main.cjs'));
setTimeout(() => {
  if (!finished) app.exit(1);
}, 30000);
