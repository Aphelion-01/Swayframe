import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { defaultAISettings, type ChatRequest } from '../../src/ai/contracts';
import { modelUnavailableMessage } from '../../src/ai/provider-diagnostics';
const modelError = process.argv.includes('--model-error');
const out = path.resolve(modelError ? 'outputs/agent-v2-7/editor-model-error' : 'outputs/agent-v2-7/editor');
const restart = process.argv.includes('--reload-saved');
app.setPath('userData', path.join(out, restart ? 'isolated-restart-userdata' : 'isolated-userdata'));
const settings = defaultAISettings(), providerId = '02700000-0000-4000-8000-000000000001';
settings.providers = [{ id: providerId, name: 'OFFLINE FIXTURE · 不调用 API', type: 'openai-compatible', enabled: true, baseUrl: 'https://example.invalid', defaultModel: 'fixture', models: [{ id: 'fixture', name: 'Fixture', capabilities: ['text'] }] }];
settings.defaultProviderId = providerId;
settings.routing.planning = { providerId, modelId: 'fixture' };
settings.agent.planTransport = 'tools'; settings.agent.nativeSkills = false;
settings.privacy.saveHistory = false;
const data = new Map(), queue: any[] = [], calls: any[] = [];
app.whenReady().then(async () => {
  await fs.mkdir(out, { recursive: true });
  const win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { preload: path.resolve('work/agent-v2-7/editor-preload.cjs'), contextIsolation: true, nodeIntegration: false } });
  // No external transport is possible in this offline run.
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_d, cb) => cb({ cancel: true }));
  ipcMain.handle('fixture:ai', async (_e, method, args) => {
    switch (method) {
      case 'loadSettings': return settings;
      case 'saveSettings': throw Error('Offline fixture settings are frozen');
      case 'hasCredentials': return true; // synthetic fixture, never reads a real credential
      case 'storageStatus': return 'memory-only';
      case 'readData': return data.get(args[0]);
      case 'writeData': data.set(args[0], args[1]); return;
      case 'chunks': return [];
      case 'cancel': return;
      case 'models': return settings.providers[0]!.models;
      case 'test': return { ok: true, message: 'offline only' };
      case 'chat': {
        const r = args[2] as ChatRequest;
        calls.push({ toolChoice: r.toolChoice, serializedInputBytes: JSON.stringify(r).length, images: r.messages.reduce((n, m) => n + (m.images?.length ?? 0), 0) });
        if(modelError)return {fixtureError:{code:'invalid_request',message:modelUnavailableMessage,details:{kind:'http',status:503,code:'model_not_found'}}};
        const next = queue.shift(); if (!next) throw Error('Unplanned fixture request; network blocked');
        return { model: 'fixture', text: '', toolCalls: [{ id: 'fixture', name: r.toolChoice, arguments: next }], usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } };
      }
      default: throw Error('Unsupported fixture method: ' + method);
    }
  });
  ipcMain.handle('fixture:enqueue', (_e, value) => { queue.push(value); });
  ipcMain.handle('fixture:mode', () => restart);
  ipcMain.handle('fixture:errorMode', () => modelError);
  ipcMain.handle('fixture:loadSaved', () => fs.readFile(path.join(out, 'reload.swayframe'), 'utf8'));
  ipcMain.handle('fixture:save', async (_e, content) => { await fs.writeFile(path.join(out, 'reload.swayframe'), content); return fs.readFile(path.join(out, 'reload.swayframe'), 'utf8'); });
  ipcMain.handle('fixture:shot', async (_e, w, h, label) => {
    win.setSize(w, h); await new Promise(r => setTimeout(r, 250));
    await fs.writeFile(path.join(out, `${label}-${w}x${h}.png`), (await win.webContents.capturePage()).toPNG());
  });
  ipcMain.handle('fixture:done', async (_e, result) => {
    await fs.writeFile(path.join(out, restart ? 'restart-report.json' : 'report.json'), JSON.stringify({ ...result, fixtureRequests: calls.length, calls, paidRequests: 0, externalNetwork: 'BLOCKED' }, null, 2));
    app.exit(result.pass ? 0 : 1);
  });
  win.webContents.on('console-message', (_e, ...args) => console.log(...args));
  await win.loadFile(path.resolve('work/agent-v2-7/editor.html'));
  setTimeout(() => app.exit(1), 180000);
});
