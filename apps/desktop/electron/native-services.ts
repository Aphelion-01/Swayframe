import { NativeAIService } from './ai-service';
import { Worker } from 'node:worker_threads';
import { app, dialog } from 'electron';
import type { BrowserWindow } from 'electron';
import path from 'node:path';
import type { DesktopRequest } from '../../../src/desktop/contracts';
import { loadProject, saveProject } from '../../../src/core/project-io';
import { DesktopPersistence } from './persistence';
import { installMenu } from './menu';
import { NativeAssets } from './assets';
import { FileGrants, readProject, writeProject } from './files';
export class NativeServices {
  allowClose: () => Promise<void> = async () => {};
  readonly grants = new FileGrants();
  startupPath: string | null = null;
  readonly persistence = new DesktopPersistence(app.getPath('userData'));
  readonly assets = new NativeAssets(this.grants);
  readonly ai = new NativeAIService(
    app.getPath('userData'),
    undefined,
    !app.isPackaged,
  );
  constructor(readonly window: BrowserWindow) {}
  hydrate(data: string): string {
    const project = loadProject(data);
    return saveProject({
      ...project,
      assets: project.assets.map((asset) => {
        if (!asset.source) return asset;
        try {
          this.grants.grantRead(asset.source.path);
          return { ...asset, dataUrl: this.assets.register(asset.source.path) };
        } catch {
          return asset;
        }
      }),
    });
  }
  async refreshMenu() {
    const recents = await this.persistence.recents();
    for (const recent of recents) this.grants.grantRead(recent.path);
    installMenu(this.window, recents);
  }
  async dispatch(request: DesktopRequest): Promise<unknown> {
    if (request.method.startsWith('ai.'))
      return this.ai.dispatch(
        request as import('../../../src/ai/desktop-contracts').AIRequest,
      );
    switch (request.method) {
      case 'window.close':
        await this.allowClose();
        return;
      case 'project.new':
        return;
      case 'dialog.open': {
        const r = await dialog.showOpenDialog(this.window, {
          title: request.options.title,
          properties: request.options.multiple
            ? ['openFile', 'multiSelections']
            : ['openFile'],
          filters: request.options.extensions
            ? [{ name: '文件', extensions: request.options.extensions }]
            : undefined,
        });
        return r.canceled
          ? []
          : r.filePaths.map((p) => this.grants.grantRead(p));
      }
      case 'dialog.folder': {
        const r = await dialog.showOpenDialog(this.window, {
          title: request.options.title,
          properties: ['openDirectory', 'createDirectory'],
        });
        return r.canceled
          ? null
          : r.filePaths[0]
            ? this.grants.grantWrite(r.filePaths[0])
            : null;
      }
      case 'dialog.save': {
        const r = await dialog.showSaveDialog(this.window, {
          title: request.options.title,
          defaultPath: request.options.defaultPath,
          filters: request.options.extensions
            ? [{ name: '文件', extensions: request.options.extensions }]
            : undefined,
        });
        return r.canceled || !r.filePath
          ? null
          : this.grants.grantWrite(r.filePath);
      }
      case 'project.open': {
        let file = request.path;
        if (file) file = this.grants.requireRead(file);
        else {
          const r = await dialog.showOpenDialog(this.window, {
            title: '打开工程',
            filters: [
              { name: 'Swayframe 工程', extensions: ['swayframe', 'json'] },
            ],
            properties: ['openFile'],
          });
          if (r.canceled || !r.filePaths[0]) return null;
          file = this.grants.grantRead(r.filePaths[0]);
        }
        let data = await readProject(file);
        data = this.hydrate(data);
        await this.persistence.addRecent(file, loadProject(data).name);
        await this.refreshMenu();
        this.grants.grantWrite(file);
        return { path: file, data };
      }
      case 'project.save': {
        let file = request.path;
        if (request.saveAs || !file) {
          const r = await dialog.showSaveDialog(this.window, {
            title: '保存工程',
            defaultPath: file ?? '未命名.swayframe',
            filters: [{ name: 'Swayframe 工程', extensions: ['swayframe'] }],
          });
          if (r.canceled || !r.filePath) return null;
          file = this.grants.grantWrite(
            path.extname(r.filePath) ? r.filePath : r.filePath + '.swayframe',
          );
        } else file = this.grants.requireWrite(file);
        await writeProject(file, request.data);
        await this.persistence.addRecent(file, loadProject(request.data).name);
        await this.refreshMenu();
        return { path: file, saved: true };
      }
      case 'assets.import': {
        let paths = request.paths;
        if (!paths) {
          const result = await dialog.showOpenDialog(this.window, {
            title: '导入图片',
            filters: [
              {
                name: '图片',
                extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
              },
            ],
            properties: ['openFile', 'multiSelections'],
          });
          if (result.canceled) return [];
          paths = result.filePaths.map((p) => this.grants.grantRead(p));
        }
        return Promise.all(paths.map((p) => this.assets.import(p)));
      }
      case 'assets.metadata':
        return (await this.assets.import(request.path)).metadata;
      case 'assets.exists':
        return this.assets.exists(this.grants.requireRead(request.path));
      case 'assets.relink': {
        const result = await dialog.showOpenDialog(this.window, {
          title: '重新链接素材',
          filters: [
            { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
          ],
          properties: ['openFile'],
        });
        if (result.canceled || !result.filePaths[0]) return null;
        return this.assets.import(this.grants.grantRead(result.filePaths[0]));
      }
      case 'recent.list': {
        const recents = await this.persistence.recents();
        for (const recent of recents) this.grants.grantRead(recent.path);
        return recents;
      }
      case 'recent.add':
        await this.persistence.addRecent(
          this.grants.requireRead(request.path),
          request.name,
        );
        await this.refreshMenu();
        return;
      case 'recent.remove':
        await this.persistence.removeRecent(request.path);
        await this.refreshMenu();
        return;
      case 'recent.clear':
        await this.persistence.removeRecent();
        await this.refreshMenu();
        return;
      case 'recovery.read': {
        const recovery = await this.persistence.readRecovery();
        if (recovery?.path) this.grants.grantWrite(recovery.path);
        return recovery
          ? { ...recovery, data: this.hydrate(recovery.data) }
          : null;
      }
      case 'recovery.write':
        return this.persistence.writeRecovery(
          request.data,
          request.path === null ? null : this.grants.requireRead(request.path),
        );
      case 'recovery.clear':
        return this.persistence.clearRecovery();
      case 'startup.read': {
        const file = this.startupPath;
        this.startupPath = null;
        return file;
      }
      case 'log.error':
        return this.persistence.log(request.category, request.message);
      case 'export.write': {
        const destination = this.grants.requireWrite(request.path);
        await new Promise<void>((resolve, reject) => {
          const worker = new Worker(path.join(__dirname, 'export-worker.cjs'), {
            workerData: {
              destination,
              bytes: request.bytes,
              sequence: request.sequence,
            },
          });
          worker.once('message', (reply: { ok: boolean; error?: string }) => {
            void worker.terminate();
            if (reply.ok) resolve();
            else reject(new Error(reply.error));
          });
          worker.once('error', reject);
          worker.once('exit', (code) => {
            if (code !== 0) reject(new Error('Export worker failed'));
          });
        });
        return;
      }
      default:
        throw new Error(`Native service not connected: ${request.method}`);
    }
  }
}
