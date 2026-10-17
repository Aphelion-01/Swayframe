import { app,BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import '../../apps/desktop/electron/main';
let networkAttempts=0;
const load=BrowserWindow.prototype.loadFile;
BrowserWindow.prototype.loadFile=function(_file,options){return load.call(this,path.resolve('dist/index.html'),options);};
app.on('browser-window-created',(_e,w)=>{w.hide();w.on('show',()=>w.hide());w.webContents.setBackgroundThrottling(false);w.webContents.session.webRequest.onBeforeRequest((d,cb)=>{if(/^https?:/.test(d.url)){networkAttempts++;cb({cancel:true});}else cb({});});w.webContents.once('did-finish-load',async()=>{try{let state:any;for(let i=0;i<100;i++){state=await w.webContents.executeJavaScript('({root:document.querySelector("#root")?.children.length,launcher:!!document.querySelector(".desktop-start"),editor:!!document.querySelector(".editor-app"),native:!!window.swayframe?.desktop})');if(state.native&&(state.launcher||state.editor))break;await new Promise(r=>setTimeout(r,50));}const pass=!!state.native&&!!(state.launcher||state.editor)&&networkAttempts===0;const report={pass,...state,networkAttempts,webPreferences:w.webContents.getLastWebPreferences(),actualDist:true};await fs.writeFile('docs/qa/editor-operations/app-startup.json',JSON.stringify(report,null,2));console.log('APP_SMOKE',JSON.stringify({pass,...state,networkAttempts}));app.exit(pass?0:1);}catch(e){console.error(e);app.exit(1);}});});
setTimeout(()=>app.exit(2),20000);
