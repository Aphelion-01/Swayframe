const {contextBridge,ipcRenderer}=require('electron');
const ai=Object.fromEntries(['loadSettings','hasCredentials','storageStatus','readData','writeData','chat','cancel','models','chunks'].map(method=>[method,(...args)=>ipcRenderer.invoke('live:ai',method,args)]));
contextBridge.exposeInMainWorld('swayframe',{desktop:{ai}});
contextBridge.exposeInMainWorld('live',Object.fromEntries(['case','turn','save','progress','shot','done'].map(method=>[method,(...args)=>ipcRenderer.invoke('live:'+method,...args)])));
