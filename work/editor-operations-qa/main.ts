import { app,BrowserWindow,ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { NativeServices } from '../../apps/desktop/electron/native-services';
import { NativeAssets } from '../../apps/desktop/electron/assets';
import '../../apps/desktop/electron/main';
const out=path.resolve('docs/qa/editor-operations/real'),project=path.join(out,'operations.swayframe');
let win:BrowserWindow,assets:NativeAssets,networkAttempts=0,modelAttempts=0;
let gate:{ready:boolean,promise:Promise<void>,release:()=>void}|undefined;
const dispatch=NativeServices.prototype.dispatch;
NativeServices.prototype.dispatch=async function(request){if(['ai.chat','ai.models','ai.test'].includes(request.method)){modelAttempts++;throw Error('No paid model calls');}const result=await dispatch.call(this,request);if(request.method==='assets.layerpack'&&gate){const wait=gate;wait.ready=true;await wait.promise;}return result;};
const protocol=NativeAssets.prototype.installProtocol;
NativeAssets.prototype.installProtocol=function(){assets=this;return protocol.call(this);};
const load=BrowserWindow.prototype.loadFile;
BrowserWindow.prototype.loadFile=function(_f,options){return load.call(this,path.resolve('work/editor-operations-qa/index.html'),options);};
app.on('browser-window-created',(_e,w)=>{win=w;w.hide();w.on('show',()=>w.hide());w.webContents.setBackgroundThrottling(false);w.webContents.session.webRequest.onBeforeRequest((d,cb)=>{if(/^https?:/.test(d.url)){networkAttempts++;cb({cancel:true});}else cb({});});w.webContents.on('console-message',(_e,...a)=>console.log('renderer',...a));});
ipcMain.handle('sf-ops-qa',async(event,method,...args)=>{
 if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted QA');
 if(method==='init'){await fs.mkdir(out,{recursive:true});const packages=path.join(out,'packages');await fs.cp('docs/qa/ai2comp/packages',packages,{recursive:true});for(const name of ['A','B','C-path','C-corrupt'])assets.grants.grantRead(path.join(packages,name));assets.grants.grantWrite(project);const entry=(await fs.readdir('dist/assets')).find(p=>/^editorOperations-.*\.js$/.test(p));if(!entry)throw Error('Built ESM entry missing');return {project,packages,entryUrl:pathToFileURL(path.resolve('dist/assets',entry)).href};}
 if(method==='arm'){let release!:()=>void;const promise=new Promise<void>(r=>release=r);gate={promise,release,ready:false};return;}
 if(method==='ready')return gate?.ready??false;
 if(method==='release'){const g=gate;gate=undefined;g?.release();return;}
 if(method==='read-project')return fs.readFile(project,'utf8');
 if(method==='file'||method==='pixels'){if(!/^[a-z0-9.-]+$/.test(args[0]))throw Error('Invalid filename');await fs.writeFile(path.join(out,args[0]),method==='pixels'?Buffer.from(args[1].split(',')[1],'base64'):JSON.stringify(args[1],null,2));return;}
 if(method==='done'){const report={...args[0],networkAttempts,modelAttempts};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('OPS_QA',JSON.stringify(report));app.exit(report.pass&&!networkAttempts&&!modelAttempts?0:1);return;}
 throw Error('Unknown QA method');
});
setTimeout(()=>app.exit(2),120000);
