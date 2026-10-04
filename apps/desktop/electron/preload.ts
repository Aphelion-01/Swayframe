import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  DesktopAPI,
  DesktopRequest,
  DesktopAction,
} from '../../../src/desktop/contracts';
async function call<T>(request: DesktopRequest): Promise<T> {
  const reply = (await ipcRenderer.invoke('swayframe:request', request)) as {
    ok: boolean;
    value: T;
    error?: string;
  };
  if (!reply.ok) throw new Error(reply.error ?? '原生操作失败，请查看日志。');
  return reply.value;
}
const desktop: DesktopAPI = {
  textEdit: (action) => call({ method: 'edit.text', action }),
  project: {
    newProject: () => call({ method: 'project.new' }),
    open: (path) => call({ method: 'project.open', path }),
    save: (data, path) =>
      call({ method: 'project.save', data, path, saveAs: false }),
    saveAs: (data, path) =>
      call({ method: 'project.save', data, path: path ?? null, saveAs: true }),
  },
  dialog: {
    openFile: (options) => call({ method: 'dialog.open', options }),
    openFolder: (options) => call({ method: 'dialog.folder', options }),
    saveFile: (options) => call({ method: 'dialog.save', options }),
    confirmUnsaved: (name) => call({ method: 'dialog.unsaved', name }),
  },
  assets: {
    importFiles: (paths) => call({ method: 'assets.import', paths }),
    readMetadata: (path) => call({ method: 'assets.metadata', path }),
    exists: (path) => call({ method: 'assets.exists', path }),
    relink: (id) => call({ method: 'assets.relink', id }),
    pathsForFiles: async (files) =>
      ipcRenderer.invoke(
        'swayframe:drop',
        files.map((f) => webUtils.getPathForFile(f)).filter(Boolean),
      ),
  },
  recentProjects: {
    list: () => call({ method: 'recent.list' }),
    add: (path, name) => call({ method: 'recent.add', path, name }),
    remove: (path) => call({ method: 'recent.remove', path }),
    clear: () => call({ method: 'recent.clear' }),
  },
  recovery: {
    read: () => call({ method: 'recovery.read' }),
    write: (data, path) => call({ method: 'recovery.write', data, path }),
    clear: () => call({ method: 'recovery.clear' }),
  },
  window: {
    setTitle: (title) => call({ method: 'window.title', title }),
    setDocumentEdited: (edited) => call({ method: 'window.edited', edited }),
    close: () => call({ method: 'window.close' }),
  },
  platform: { getInfo: () => call({ method: 'platform.info' }) },
  startup: () => call({ method: 'startup.read' }),
  export: {
    write: (path, bytes, sequence) =>
      call({
        method: 'export.write',
        path,
        bytes: new Uint8Array(bytes),
        sequence,
      }),
  },
  log: (category, message) => call({ method: 'log.error', category, message }),
  onAction: (listener) => {
    const handler = (_: unknown, action: DesktopAction, path?: string) =>
      listener(action, path);
    ipcRenderer.on('swayframe:action', handler);
    return () => ipcRenderer.removeListener('swayframe:action', handler);
  },
};
contextBridge.exposeInMainWorld('swayframe', { desktop });
