const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ui', {
  shot: (w, h) => ipcRenderer.invoke('ui:shot', w, h),
  done: (r) => ipcRenderer.invoke('ui:done', r),
});
