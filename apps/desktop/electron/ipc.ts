import { AIError } from '../../../src/ai/contracts';
import { app, dialog, ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { requestSchema } from '../../../src/desktop/contracts';
import { ProjectFileError } from '../../../src/core/project-io';
import type { DesktopRequest } from '../../../src/desktop/contracts';
export function installIPC(
  window: BrowserWindow,
  extra?: (request: DesktopRequest) => Promise<unknown>,
  log?: (category: string, message: string) => Promise<void>,
) {
  ipcMain.handle('swayframe:request', async (event, raw: unknown) => {
    try {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        throw new Error('Untrusted sender');
      const request = requestSchema.parse(raw);
      switch (request.method) {
        case 'edit.text':
          window.webContents[request.action]();
          return { ok: true };
        case 'platform.info':
          return {
            ok: true,
            value: {
              platform: process.platform,
              primaryModifier:
                process.platform === 'darwin' ? 'Meta' : 'Control',
              version: app.getVersion(),
            },
          };
        case 'window.title':
          window.setTitle(request.title);
          return { ok: true };
        case 'window.edited':
          window.setDocumentEdited(request.edited);
          return { ok: true };
        case 'dialog.unsaved': {
          const result = await dialog.showMessageBox(window, {
            type: 'question',
            message: `是否保存“${request.name}”的更改？`,
            detail: '未保存的更改将会丢失。',
            buttons: ['保存', '不保存', '取消'],
            defaultId: 0,
            cancelId: 2,
          });
          return {
            ok: true,
            value: ['save', 'discard', 'cancel'][result.response],
          };
        }
        default:
          if (extra) return { ok: true, value: await extra(request) };
          throw new Error('Service not connected');
      }
    } catch (error) {
      if (!(
        typeof raw === 'object' &&
        raw !== null &&
        'method' in raw &&
        String(raw.method).startsWith('ai.')
      ))
        void log?.(
          error instanceof ProjectFileError ? 'Project' : 'FileIO',
          error instanceof Error ? error.message : String(error),
        );
      return {
        ok: false,
        code: error instanceof AIError ? error.code : undefined,
        error:
          error instanceof AIError || error instanceof ProjectFileError
            ? error.message
            : '原生操作未完成，请检查文件权限或日志后重试。',
      };
    }
  });
}
