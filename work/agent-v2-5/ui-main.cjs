const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path'),
  fs = require('node:fs/promises');
const out = path.resolve('outputs/agent-v2-5/ui');
app.setPath('userData', path.join(out, 'isolated-userdata'));
app.whenReady().then(async () => {
  await fs.mkdir(out, { recursive: true });
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.resolve('work/agent-v2-5/ui-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  ipcMain.handle('ui:shot', async (_, w, h) => {
    win.setSize(w, h);
    await new Promise((r) => setTimeout(r, 250));
    const screenshot = await win.webContents.capturePage();
    await fs.writeFile(path.join(out, `${w}x${h}.png`), screenshot.toPNG());
    return { width: w, height: h };
  });
  ipcMain.handle('ui:done', async (_, report) => {
    await fs.writeFile(
      path.join(out, 'report.json'),
      JSON.stringify(report, null, 2),
    );
    app.exit(report.pass ? 0 : 1);
  });
  win.webContents.on('console-message', (_e, ...args) => console.log(...args));
  await win.loadFile(path.resolve('work/agent-v2-5/ui.html'));
  setTimeout(() => app.exit(1), 45000);
});
