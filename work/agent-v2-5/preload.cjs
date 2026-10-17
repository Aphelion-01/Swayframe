const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'bench',
  Object.fromEntries(
    [
      'mode',
      'matchedRecheck',
      'settings',
      'has',
      'chat',
      'save',
      'saveImage',
      'progress',
      'done',
    ].map((k) => [k, (...args) => ipcRenderer.invoke('bench:' + k, ...args)]),
  ),
);
