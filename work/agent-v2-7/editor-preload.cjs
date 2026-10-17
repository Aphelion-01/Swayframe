const { contextBridge, ipcRenderer } = require('electron');
const ai = Object.fromEntries(['loadSettings', 'saveSettings', 'setCredentials', 'removeCredentials', 'hasCredentials', 'storageStatus', 'readData', 'writeData', 'chat', 'cancel', 'models', 'test', 'chunks'].map(method => [method, (...args) => ipcRenderer.invoke('fixture:ai', method, args)]));
ai.chat=async(...args)=>{const r=await ipcRenderer.invoke('fixture:ai','chat',args);if(r.fixtureError)throw Error(`[SF_AI:${r.fixtureError.code}]${r.fixtureError.message}\n[SF_DETAIL:${encodeURIComponent(JSON.stringify(r.fixtureError.details))}]`);return r;};
contextBridge.exposeInMainWorld('swayframe', { desktop: { ai } });
contextBridge.exposeInMainWorld('fixture', {
  mode: () => ipcRenderer.invoke('fixture:mode'),
  errorMode: () => ipcRenderer.invoke('fixture:errorMode'),
  loadSaved: () => ipcRenderer.invoke('fixture:loadSaved'),
  enqueue: value => ipcRenderer.invoke('fixture:enqueue', value),
  save: content => ipcRenderer.invoke('fixture:save', content),
  shot: (w, h, label) => ipcRenderer.invoke('fixture:shot', w, h, label),
  done: result => ipcRenderer.invoke('fixture:done', result),
});
