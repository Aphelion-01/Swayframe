import { app, BrowserWindow } from 'electron';
import { protocol } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { NativeServices } from '../../apps/desktop/electron/native-services';
import { installIPC } from '../../apps/desktop/electron/ipc';
import { rendererContentSecurityPolicy } from '../../src/desktop/content-security';
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'swayframe-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
app.setPath(
  'userData',
  '/private/tmp/sf-audio-font-029-integration-' + Date.now(),
);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app
  .whenReady()
  .then(async () => {
    const w = new BrowserWindow({
      show: false,
      width: 1440,
      height: 900,
      webPreferences: {
        preload: path.resolve('desktop-dist/preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const service = new NativeServices(w);
    service.assets.installProtocol();
    installIPC(w, (r) => service.dispatch(r));
    const files: string[] = process.env.SF_AUDIO_FILES_JSON
      ? JSON.parse(process.env.SF_AUDIO_FILES_JSON)
      : [
          path.resolve('tests/fixtures/media/tone.flac'),
          path.resolve('tests/fixtures/media/tone.aiff'),
        ];
    files.forEach((f) => service.grants.grantRead(f));
    const html = path.resolve('work/audio-font-029/integration.html');
    await fs.writeFile(
      html,
      `<meta http-equiv="Content-Security-Policy" content="${rendererContentSecurityPolicy()}"><link rel="stylesheet" href="renderer.css"><body data-files='${JSON.stringify(files)}' style="background:#222428;color:#e0e3e8"><div id="root" style="width:340px"></div><script src="renderer.js"></script></body>`,
    );
    await w.loadFile(html);
    let result;
    for (let i = 0; i < 120; i++) {
      result = await w.webContents.executeJavaScript('window.result');
      if (result) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    await fs.writeFile(
      'outputs/audio-font-029/integration.json',
      JSON.stringify(result ?? { pass: false, timeout: true }, null, 2),
    );
    await fs.writeFile(
      'outputs/audio-font-029/fonts.png',
      (await w.webContents.capturePage()).toPNG(),
    );
    app.exit(result?.pass ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    app.exit(1);
  });
