import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NativeAIService } from '../../apps/desktop/electron/ai-service';
async function main() {
  const live = process.env.SF_V26_LIVE === '1',
    recheck = process.env.SF_V26_RECHECK === '1',
    replay = process.env.SF_V26_REPLAY === '1',
    out = path.resolve(
      'outputs/agent-v2-6/' +
        (recheck ? 'live-recheck' : replay ? 'live-replay' : live ? 'live' : 'electron-offline'),
    );
  if ((recheck && !live) || (replay && live) || (replay && recheck))
    throw Error('Invalid benchmark mode');
  app.setName('Swayframe');
  app.setPath('userData', path.join(out, 'isolated-userdata'));
  await app.whenReady();
  await fs.mkdir(out, { recursive: true });
  const calls: Record<string, unknown>[] = [];
  if (recheck) {
    const first = JSON.parse(await fs.readFile('outputs/agent-v2-6/live/calls.json', 'utf8'));
    if (first.length !== 10 || first.filter((c) => c.id === 'L3-V2').length !== 1)
      throw Error('Unexpected first-run ledger; cannot resume blindly');
    calls.push(...first);
  }
  const initialRequests = calls.length;
  let activeRequestId: string | null = null;
  let tag: { id: string; maxRequests: number } | null = null;
  if (live) {
    const authorization = JSON.parse(
      await fs.readFile('outputs/agent-v2-6/authorization.json', 'utf8'),
    );
    if (
      authorization.authorized !== true ||
      authorization.stage !== 'V2-6' ||
      authorization.requests !== 20 ||
      authorization.inputTokens !== 400000 ||
      authorization.outputTokens !== 40000
    )
      throw Error('New V2-6 human authorization required; V2-5 does not apply');
    if (
      await fs.stat(path.join(out, 'calls.json')).then(
        () => true,
        () => false,
      )
    )
      throw Error('Existing live ledger; never overwrite or silently repeat');
  }
  const saveLedger = () =>
    fs.writeFile(
      path.join(out, 'calls.json'),
      JSON.stringify(calls, null, 2) + '\n',
    );
  // Offline mode does not even read credentials or user AI settings.
  const service = live
    ? new NativeAIService(
        path.join(app.getPath('appData'), 'Swayframe'),
        undefined,
        false,
        async (url, init) => {
          if (!tag) throw Error('Missing case context');
          if (recheck && (tag.id !== 'L3-V2' || tag.maxRequests !== 3))
            throw Error('Recheck is authorized only for the original failed L3 case');
          const body = JSON.parse(String(init?.body));
          body.max_tokens = 2000;
          if (
            body.messages.some(
              (m: { content: unknown }) => typeof m.content !== 'string',
            )
          )
            throw Error('No images permitted');
          const upper = Buffer.byteLength(JSON.stringify(body), 'utf8') + 5000;
          const usage = (
            c: Record<string, unknown>,
            field: 'inputTokens' | 'outputTokens',
            fallback: 'inputUpper' | 'outputUpper',
          ) =>
            Number(
              (c.usage as Record<string, number> | undefined)?.[field] ??
                c[fallback],
            );
          if (
            calls.length >= 20 ||
            calls.filter((c) => c.id === tag!.id).length >= tag.maxRequests ||
            calls.reduce(
              (n, c) => n + usage(c, 'inputTokens', 'inputUpper'),
              0,
            ) +
              upper >
              400000 ||
            calls.reduce(
              (n, c) => n + usage(c, 'outputTokens', 'outputUpper'),
              0,
            ) +
              2000 >
              40000
          )
            throw Error('Budget cap BEFORE fetch');
          const c: Record<string, unknown> = {
            index: calls.length + 1,
            ...tag,
            body,
            inputUpper: upper,
            outputUpper: 2000,
            endpoint: String(url),
            startedAt: new Date().toISOString(),
          };
          calls.push(c);
          await saveLedger();
          try {
            const response = await fetch(url, {
              ...init,
              body: JSON.stringify(body),
            });
            c.status = response.status;
            const raw = await response.clone().text();
            try {
              c.response = JSON.parse(raw);
              const u = (
                c.response as {
                  usage?: { prompt_tokens: number; completion_tokens: number };
                }
              ).usage;
              if (u)
                c.usage = {
                  inputTokens: u.prompt_tokens,
                  outputTokens: u.completion_tokens,
                };
            } catch {
              c.invalidResponse = true;
            }
            await saveLedger();
            return response;
          } catch (e) {
            c.error = 'Transport failure';
            await saveLedger();
            throw e;
          }
        },
      )
    : null;
  ipcMain.handle('bench:live', () => live);
  ipcMain.handle('bench:mode', () => ({ recheck, replay }));
  ipcMain.handle('bench:replay', async () => {
    if (!replay || service) throw Error('Paid transport forbidden in replay mode');
    const trace = JSON.parse(await fs.readFile('outputs/agent-v2-6/live/L3-V2-trace.json', 'utf8'));
    return trace.transportRecords[0].response;
  });
  ipcMain.handle('bench:settings', () => {
    if (!service) throw Error('Offline cannot access user settings');
    return service.settings();
  });
  ipcMain.handle('bench:chat', async (_, providerId, request, caseTag) => {
    if (!service) throw Error('Offline network forbidden');
    if (activeRequestId)
      throw Error(
        'Previous native request has not finished; no overlapping paid calls',
      );
    if (request.messages.some((m: { images?: unknown[] }) => m.images?.length))
      throw Error('Images forbidden');
    tag = caseTag;
    activeRequestId = randomUUID();
    try {
      return await service.dispatch({
        method: 'ai.chat',
        providerId,
        requestId: activeRequestId,
        request: { ...request, stream: false },
      });
    } catch (e) {
      return {
        benchError: {
          code: (e as { code?: string }).code ?? 'provider',
          message: (e as Error).message,
          details: (e as { details?: unknown }).details,
        },
      };
    } finally {
      tag = null;
      activeRequestId = null;
    }
  });
  ipcMain.handle('bench:cancel', () =>
    activeRequestId && service
      ? service.dispatch({ method: 'ai.cancel', requestId: activeRequestId })
      : null,
  );
  ipcMain.handle('bench:save', async (_, name, data) => {
    if (!/^[A-Za-z0-9.-]+$/.test(name)) throw Error('Invalid filename');
    await fs.writeFile(path.join(out, name), data);
  });
  ipcMain.handle('bench:image', async (_, name, data) => {
    if (!/^[A-Za-z0-9.-]+$/.test(name)) throw Error('Invalid filename');
    await fs.writeFile(
      path.join(out, name),
      Buffer.from(data.split(',')[1], 'base64'),
    );
  });
  ipcMain.handle('bench:progress', (_, s) => console.log(s));
  ipcMain.handle('bench:done', async (_, report) => {
    report.budget = {
      live,
      initialRequests,
      newRequests: calls.length - initialRequests,
      requests: calls.length,
      inputTokens: calls.reduce(
        (n, c) =>
          n +
          Number(
            (c.usage as { inputTokens: number } | undefined)?.inputTokens ?? 0,
          ),
        0,
      ),
      outputTokens: calls.reduce(
        (n, c) =>
          n +
          Number(
            (c.usage as { outputTokens: number } | undefined)?.outputTokens ??
              0,
          ),
        0,
      ),
      unknownUsage: calls.filter((c) => !c.usage).length,
      reservedInputTokens: calls.reduce(
        (n, c) =>
          n +
          Number(
            (c.usage as { inputTokens: number } | undefined)?.inputTokens ??
              c.inputUpper,
          ),
        0,
      ),
      reservedOutputTokens: calls.reduce(
        (n, c) =>
          n +
          Number(
            (c.usage as { outputTokens: number } | undefined)?.outputTokens ??
              c.outputUpper,
          ),
        0,
      ),
    };
    await fs.writeFile(
      path.join(out, 'report.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    app.exit(report.rows?.every((r: { pass: boolean }) => r.pass) ? 0 : 1);
  });
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.resolve('work/agent-v2-6/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.on('console-message', (_e, ...args) =>
    console.log('renderer', ...args),
  );
  await win.loadFile(path.resolve('work/agent-v2-6/index.html'));
  setTimeout(() => app.exit(2), 20 * 60 * 1000);
}
void main();
