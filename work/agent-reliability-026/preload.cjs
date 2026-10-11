const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('bench',Object.fromEntries(['settings','has','chat','reference','fixture','save','saveImage','done'].map(k=>[k,(...args)=>ipcRenderer.invoke('bench:'+k,...args)])));
