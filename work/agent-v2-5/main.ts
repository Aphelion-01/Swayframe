import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NativeAIService } from '../../apps/desktop/electron/ai-service';
async function main() {
  const live = process.env.SF_V25_LIVE === '1';
  const matchedRecheck = process.env.SF_V25_MATCHED_RECHECK === '1';
  if (matchedRecheck && !live)
    throw Error('Matched recheck requires live mode');
  const ledgerPath = path.resolve(
    'outputs/agent-v2-5/live-smoke/live-calls.json',
  );
  const out = path.resolve(
    'outputs/agent-v2-5/' +
      (live
        ? matchedRecheck
          ? 'live-matched-recheck'
          : 'live-smoke'
        : 'offline-integration'),
  );
  app.setName('Swayframe');
  app.setPath('userData', path.join(out, 'isolated-userdata'));
  await app.whenReady();
  await fs.mkdir(out, { recursive: true });
  let authorization: any;
  if (live) {
    authorization = JSON.parse(
      await fs.readFile('outputs/agent-v2-5/authorization.json', 'utf8'),
    );
    if (
      authorization.authorized !== true ||
      authorization.stage !== 'V2-5' ||
      authorization.requests !== 20 ||
      authorization.inputTokens !== 300000 ||
      authorization.outputTokens !== 40000
    )
      throw Error('Explicit current-stage authorization required');
    if (
      !matchedRecheck &&
      (await fs.stat(ledgerPath).then(
        () => true,
        () => false,
      ))
    )
      throw Error(
        'Existing ledger: do not overwrite or silently repeat paid tests',
      );
  }
  if (process.env.SF_V25_PREFLIGHT === '1') {
    const service = new NativeAIService(
      path.join(app.getPath('appData'), 'Swayframe'),
    );
    const settings = await service.settings();
    const provider = settings.providers.find(
      (p) =>
        p.enabled &&
        p.baseUrl === 'https://api.deepseek.com' &&
        p.defaultModel === 'deepseek-flash',
    );
    const credentialsAvailable = provider
      ? await service.dispatch({
          method: 'ai.credentials.has',
          providerId: provider.id,
        })
      : false;
    await fs.writeFile(
      path.resolve('outputs/agent-v2-5/provider-preflight.json'),
      JSON.stringify(
        {
          configured: !!provider,
          provider: provider?.name,
          baseUrl: provider?.baseUrl,
          model: provider?.defaultModel,
          credentialsAvailable,
          apiRequests: 0,
          endpointCapabilities: 'NOT VERIFIED',
          authorization: 'NOT GRANTED FOR THIS STAGE',
        },
        null,
        2,
      ),
    );
    app.exit(0);
    return;
  }
  if (
    matchedRecheck &&
    (await fs.stat(path.join(out, 'report.json')).then(
      () => true,
      () => false,
    ))
  )
    throw Error('Matched recheck already completed; do not overwrite evidence');
  const calls: any[] = matchedRecheck
    ? JSON.parse(await fs.readFile(ledgerPath, 'utf8'))
    : [];
  if (
    matchedRecheck &&
    (calls.length !== 12 ||
      calls.some((c) => !c.usage || c.caseId.startsWith('recheck-')))
  )
    throw Error(
      'Recheck requires the intact completed 12-request initial ledger',
    );
  let current: any = null,
    done = false;
  const saveLedger = () =>
    fs.writeFile(
      live ? ledgerPath : path.join(out, 'live-calls.json'),
      JSON.stringify(calls, null, 2),
    );
  const service = new NativeAIService(
    path.join(app.getPath('appData'), 'Swayframe'),
    undefined,
    false,
    async (url, init) => {
      if (!live || !current)
        throw Error(
          'Network forbidden without live authorization and case context',
        );
      const body = JSON.parse(String(init?.body));
      body.max_tokens = 2000;
      if (body.messages.some((m) => m.content && typeof m.content !== 'string'))
        throw Error('Images are forbidden');
      const inputUpper = Buffer.byteLength(JSON.stringify(body), 'utf8') + 5000;
      const reservedInput = calls.reduce(
        (n, c) => n + (c.usage?.inputTokens ?? c.inputUpper),
        0,
      );
      const reservedOutput = calls.reduce(
        (n, c) => n + (c.usage?.outputTokens ?? c.outputLimit),
        0,
      );
      if (
        calls.length >= 20 ||
        reservedInput + inputUpper > 300000 ||
        reservedOutput + 2000 > 40000 ||
        calls.filter((c) => c.caseId === current.caseId).length >= 3
      )
        throw Error('Authorized request/token/case cap reached before sending');
      const record: any = {
        index: calls.length + 1,
        ...current,
        inputUpper,
        outputLimit: 2000,
        startedAt: new Date().toISOString(),
        endpoint: String(url),
        body,
      };
      calls.push(record);
      await saveLedger();
      try {
        const response = await fetch(url, {
          ...init,
          body: JSON.stringify(body),
        });
        const raw = await response.clone().text();
        record.status = response.status;
        try {
          record.rawResponse = JSON.parse(raw);
          const u = record.rawResponse.usage;
          if (u)
            record.usage = {
              inputTokens: u.prompt_tokens,
              outputTokens: u.completion_tokens,
              totalTokens: u.total_tokens,
            };
        } catch {
          record.responseNotJSON = true;
        }
        record.durationMs = Date.now() - Date.parse(record.startedAt);
        await saveLedger();
        return response;
      } catch (e) {
        record.error = 'Transport failed';
        record.durationMs = Date.now() - Date.parse(record.startedAt);
        await saveLedger();
        throw e;
      }
    },
  );
  ipcMain.handle('bench:mode', () => live);
  ipcMain.handle('bench:matchedRecheck', () => matchedRecheck);
  ipcMain.handle('bench:settings', () => service.settings());
  ipcMain.handle('bench:has', (_, id) =>
    service.dispatch({ method: 'ai.credentials.has', providerId: id }),
  );
  ipcMain.handle('bench:chat', async (_, providerId, request, tag) => {
    if (!live) throw Error('Offline run may not call API');
    if (request.messages.some((m) => m.images?.length))
      throw Error('Images forbidden');
    current = tag;
    try {
      return await service.dispatch({
        method: 'ai.chat',
        providerId,
        requestId: randomUUID(),
        request: { ...request, stream: false },
      });
    } catch (e) {
      return {
        benchError: {
          code: (e as any).code ?? 'provider',
          message: (e as Error).message,
          details: (e as any).details,
        },
      };
    } finally {
      current = null;
    }
  });
  for (const method of ['save', 'saveImage'])
    ipcMain.handle('bench:' + method, async (_, name, data) => {
      if (!/^[A-Za-z0-9.-]+$/.test(name))
        throw Error('Invalid evidence filename');
      await fs.writeFile(
        path.join(out, name),
        method === 'saveImage'
          ? Buffer.from(data.split(',')[1], 'base64')
          : data,
      );
    });
  ipcMain.handle('bench:progress', (_, s) => console.log(s));
  ipcMain.handle('bench:done', async (_, report) => {
    done = true;
    await fs.writeFile(
      path.join(out, 'report.json'),
      JSON.stringify(
        {
          ...report,
          budget: {
            authorized: live,
            requests: calls.length,
            inputTokens: calls.reduce(
              (n, c) => n + (c.usage?.inputTokens ?? 0),
              0,
            ),
            outputTokens: calls.reduce(
              (n, c) => n + (c.usage?.outputTokens ?? 0),
              0,
            ),
            unknownUsage: calls.filter((c) => !c.usage).length,
            remainingRequests: live ? 20 - calls.length : 0,
          },
        },
        null,
        2,
      ),
    );
    app.exit(0);
  });
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.resolve('work/agent-v2-5/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.on('console-message', (_e, ...args) =>
    console.log('renderer', ...args),
  );
  await win.loadFile(path.resolve('work/agent-v2-5/index.html'));
  setTimeout(() => {
    if (!done) app.exit(1);
  }, 1800000);
}
void main();
