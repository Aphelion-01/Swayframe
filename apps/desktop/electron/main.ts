import { rendererContentSecurityPolicy } from '../../../src/desktop/content-security';
import {
  app,
  BrowserWindow,
  protocol,
  ipcMain,
  screen,
  dialog,
} from 'electron';
import path from 'node:path';
import { installIPC } from './ipc';
import fs from 'node:fs/promises';
import { visibleWindow } from './window-state';
import { installMenu } from './menu';
import { DesktopPersistence } from './persistence';
import { ProductMetadata } from '../../../src/desktop/product';
import { NativeServices } from './native-services';
import { atomicWrite } from './files';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'swayframe-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
let window: BrowserWindow | undefined;
let services: NativeServices | undefined;
let pending =
  process.argv.find((arg) => arg.toLowerCase().endsWith('.swayframe')) ?? null;
if (pending) pending = path.resolve(pending);
app.on('open-file', (event, file) => {
  event.preventDefault();
  if (services) {
    services.grants.grantRead(file);
    window?.webContents.send('swayframe:action', 'open', file);
  } else pending = file;
});
app.setName(ProductMetadata.name);
app.setPath(
  'userData',
  process.env.SWAYFRAME_USER_DATA
    ? path.resolve(process.env.SWAYFRAME_USER_DATA)
    : path.join(app.getPath('appData'), ProductMetadata.name),
);
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', (_event, args) => {
  const file = args.find((arg) => arg.toLowerCase().endsWith('.swayframe'));
  if (file && services) {
    services.grants.grantRead(path.resolve(file));
    window?.webContents.send('swayframe:action', 'open', path.resolve(file));
  }
  window?.show();
  window?.focus();
});
const logs = new DesktopPersistence(app.getPath('userData'));
process.on('uncaughtException', (error) => {
  void logs.log('Main', error.stack ?? error.message);
});
process.on('unhandledRejection', (error) => {
  void logs.log(
    'Main',
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
});
app
  .whenReady()
  .then(async () => {
    const stateFile = path.join(app.getPath('userData'), 'window.json');
    let saved = null;
    try {
      saved = JSON.parse(await fs.readFile(stateFile, 'utf8'));
    } catch {
      /* first launch */
    }
    const state = visibleWindow(
      saved,
      screen.getAllDisplays().map((d) => d.workArea),
    );
    window = new BrowserWindow({
      ...state,
      minWidth: 900,
      minHeight: 600,
      title: 'Swayframe',
      backgroundColor: '#17191d',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, 'preload.cjs'),
      },
    });
    if (state.maximized) window.maximize();
    installMenu(window);
    services = new NativeServices(window);
    const native = services;
    if (pending) {
      native.startupPath = native.grants.grantRead(pending);
      pending = null;
    }
    await native.refreshMenu();
    native.assets.installProtocol();
    ipcMain.handle('swayframe:drop', (event, paths: unknown) => {
      if (
        event.sender !== window?.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        !Array.isArray(paths) ||
        paths.length > 100 ||
        paths.some((p) => typeof p !== 'string')
      )
        throw new Error('Invalid drop');
      return paths.map((p) => native.grants.grantRead(p));
    });
    let closing = false;
    window.on('close', (event) => {
      if (!closing) {
        event.preventDefault();
        window?.webContents.send('swayframe:action', 'close-window');
      }
    });
    native.allowClose = async () => {
      await fs.mkdir(app.getPath('userData'), { recursive: true });
      await atomicWrite(
        stateFile,
        JSON.stringify({
          ...window?.getNormalBounds(),
          maximized: window?.isMaximized(),
        }),
      );
      closing = true;
      window?.close();
    };
    installIPC(
      window,
      (request) => native.dispatch(request),
      (category, message) => native.persistence.log(category, message),
    );

    window.webContents.on('will-attach-webview', (event) =>
      event.preventDefault(),
    );
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());
    const url = process.env.SWAYFRAME_DEV_URL;
    window.webContents.session.webRequest.onHeadersReceived(
      (details, callback) => {
        const development = !app.isPackaged && !!url;
        const policy = rendererContentSecurityPolicy(development);
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [policy],
          },
        });
      },
    );
    if (url && !app.isPackaged) {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1')
        throw new Error('Invalid development URL');
      await window.loadURL(url);
    } else await window.loadFile(path.join(__dirname, '../dist/index.html'));
  })
  .catch((error) => {
    void logs.log(
      'Main',
      error instanceof Error ? error.message : String(error),
    );
    dialog.showErrorBox(
      ProductMetadata.name,
      '应用启动失败，请查看桌面日志后重试。',
    );
    app.quit();
  });
app.on('window-all-closed', () => app.quit());

app.on('before-quit', () => services?.ai.dispose());
