const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ui', {
  shot: (w, h, label) => ipcRenderer.invoke('ui:shot', w, h, label),
  done: (r) => ipcRenderer.invoke('ui:done', r),
});
