import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { NativeServices } from '../../apps/desktop/electron/native-services';
import '../../apps/desktop/electron/main';
const out = path.resolve('docs/qa/canvas-release/electron');
let win: BrowserWindow;
let networkAttempts = 0,
  modelAttempts = 0;
const dispatch = NativeServices.prototype.dispatch;
NativeServices.prototype.dispatch = async function (r) {
  if (['ai.chat', 'ai.models', 'ai.test'].includes(r.method)) {
    modelAttempts++;
    throw Error('Paid model API prohibited');
  }
  return dispatch.call(this, r);
};
const load = BrowserWindow.prototype.loadFile;
BrowserWindow.prototype.loadFile = function (_f, o) {
  return load.call(
    this,
    path.resolve('work/canvas-release-qa/index.html'),
    o,
  );
};
app.on('browser-window-created', (_e, w) => {
  win = w;
  w.setContentSize(1440, 900);
  w.webContents.setBackgroundThrottling(false);
  w.webContents.session.webRequest.onBeforeRequest((d, cb) => {
    if (/^https?:/.test(d.url)) {
      networkAttempts++;
      cb({ cancel: true });
    } else cb({});
  });
});
ipcMain.handle('sf-unselected-agent', async (_e, method, ...args) => {
  if (method === 'init') {
    await fs.mkdir(out, { recursive: true });
    return;
  }
  if (method === 'mouse' || method === 'key') {
    win.show(); win.focus(); win.webContents.focus();
    if (!win.webContents.debugger.isAttached()) win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand(method === 'mouse' ? 'Input.dispatchMouseEvent' : 'Input.dispatchKeyEvent', args[0]);
    return;
  }
  if (method === 'pixels') {
    await fs.writeFile(
      path.join(out, args[0]),
      Buffer.from(args[1].split(',')[1], 'base64'),
    );
    return;
  }
  if (method === 'viewport') {
    if (!win.webContents.debugger.isAttached())
      win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand(
      'Emulation.setDeviceMetricsOverride',
      { width: args[0], height: args[1], deviceScaleFactor: 1, mobile: false },
    );
    return;
  }
  if (method === 'capture') {
    if (!win.webContents.debugger.isAttached())
      win.webContents.debugger.attach('1.3');
    const r = await win.webContents.debugger.sendCommand(
      'Page.captureScreenshot',
      { format: 'png' },
    );
    await fs.writeFile(
      path.join(out, args[0] + '.png'),
      Buffer.from(r.data, 'base64'),
    );
    return;
  }
  if (method === 'done') {
    const r = {
      ...args[0],
      networkAttempts,
      modelAttempts,
      environment: {
        electron: process.versions.electron,
        node: process.versions.node,
        chrome: process.versions.chrome,
        platform: process.platform,
        arch: process.arch,
      },
    };
    await fs.writeFile(
      path.join(out, 'report.json'),
      JSON.stringify(r, null, 2),
    );
    console.log(
      'ASSISTANT_CHAT_OFFLINE_ELECTRON',
      JSON.stringify({
        pass: r.pass,
        current: r.current,
        error: r.error,
        records: r.records,
        networkAttempts,
        modelAttempts,
      }),
    );
    app.exit(r.pass && !modelAttempts && !networkAttempts ? 0 : 1);
  }
});
setTimeout(() => app.exit(3), 180000).unref();
