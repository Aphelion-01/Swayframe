const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'bench',
  Object.fromEntries(
    [
      'live',
      'mode',
      'replay',
      'settings',
      'chat',
      'cancel',
      'save',
      'image',
      'progress',
      'done',
    ].map((k) => [k, (...args) => ipcRenderer.invoke('bench:' + k, ...args)]),
  ),
);
