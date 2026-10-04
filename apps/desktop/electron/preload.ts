import { AIError } from '../../../src/ai/contracts';
import type { AIErrorCode } from '../../../src/ai/contracts';
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
    code?: AIErrorCode;
  };
  if (!reply.ok) {
    if (reply.code)
      throw new AIError(reply.code, reply.error ?? 'AI 服务操作未完成');
    throw new Error(reply.error ?? '原生操作失败，请查看日志。');
  }
  return reply.value;
}
const desktop: DesktopAPI = {
  ai: {
    loadSettings: () => call({ method: 'ai.settings.load' }),
    saveSettings: (settings) => call({ method: 'ai.settings.save', settings }),
    setCredentials: (providerId, credentials) =>
      call({ method: 'ai.credentials.set', providerId, credentials }),
    removeCredentials: (providerId) =>
      call({ method: 'ai.credentials.remove', providerId }),
    hasCredentials: (providerId) =>
      call({ method: 'ai.credentials.has', providerId }),
    storageStatus: () => call({ method: 'ai.storage.status' }),
    readData: (key) => call({ method: 'ai.data.read', key }),
    writeData: (key, data) =>
      call({ method: 'ai.data.write', key, data: JSON.stringify(data) }),
    chat: (providerId, requestId, request) =>
      call({ method: 'ai.chat', providerId, requestId, request }),
    cancel: (requestId) => call({ method: 'ai.cancel', requestId }),
    chunks: (requestId) => call({ method: 'ai.chunks', requestId }),
    models: (providerId) => call({ method: 'ai.models', providerId }),
    test: (providerId) => call({ method: 'ai.test', providerId }),
  },
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
