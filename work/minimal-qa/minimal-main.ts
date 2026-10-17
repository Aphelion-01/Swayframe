import {app,BrowserWindow,ipcMain} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {NativeServices} from '../../apps/desktop/electron/native-services';
import {NativeAssets} from '../../apps/desktop/electron/assets';
import '../../apps/desktop/electron/main';
const run=process.env.SF_QA_RUN??'run-01';if(!/^[a-z0-9-]+$/.test(run))throw Error('Invalid run');
const out=path.resolve('docs/qa/evidence',run),fixture=path.join(out,'fixture.png'),project=path.join(out,'baseline.swayframe'),missing=path.join(out,'missing.png');
let win:BrowserWindow,assets:NativeAssets,gate:{method:string;ready:boolean;release:()=>void;promise:Promise<void>}|undefined;
let networkAttempts=0,modelAttempts=0;
globalThis.fetch=async()=>{networkAttempts++;throw Error('External network forbidden for minimal acceptance');};
const dispatch=NativeServices.prototype.dispatch;
NativeServices.prototype.dispatch=async function(request){if(['ai.chat','ai.models','ai.test'].includes(request.method)){modelAttempts++;throw Error('Model requests forbidden in QA');}const value=await dispatch.call(this,request);if(gate?.method===request.method){const waiting=gate;waiting.ready=true;await waiting.promise;}return value;};
const protocol=NativeAssets.prototype.installProtocol;NativeAssets.prototype.installProtocol=function(){assets=this;return protocol.call(this);};
const load=BrowserWindow.prototype.loadFile;BrowserWindow.prototype.loadFile=function(_file,options){return load.call(this,path.resolve('work/minimal-qa/minimal.html'),options);};
app.on('browser-window-created',(_e,w)=>{win=w;w.webContents.setBackgroundThrottling(false);w.hide();w.on('show',()=>w.hide());w.webContents.on('console-message',(_e,...args)=>console.log('renderer',...args));w.webContents.session.webRequest.onBeforeRequest((details,cb)=>{if(/^https?:/.test(details.url)){networkAttempts++;cb({cancel:true});}else cb({});});});
for(const method of ['init','file','pixels','arm','ready','release','choose','read','done'])ipcMain.handle('sf-qa:'+method,async(event,...args)=>{
 if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted QA sender');
 if(method==='init'){await fs.mkdir(out,{recursive:true});await fs.writeFile(fixture,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAE0lEQVR4nGP4/5/hPz7MMDIUAADDpr9BtOa4dgAAAABJRU5ErkJggg==','base64'));assets.grants.grantRead(fixture);assets.grants.grantRead(missing);assets.grants.grantWrite(project);return {run,project,fixture,missing,reopen:process.argv.includes('--reopen-only')};}
 if(method==='arm'){if(gate||!['project.save','project.open','assets.import'].includes(args[0]))throw Error('Invalid gate');let release!:()=>void;const promise=new Promise<void>(r=>release=r);gate={method:args[0],ready:false,release,promise};return;}
 if(method==='ready')return gate?.ready??false;
 if(method==='release'){const waiting=gate;gate=undefined;waiting?.release();return;}
 if(method==='choose'){win.webContents.debugger.attach('1.3');try{const doc=await win.webContents.debugger.sendCommand('DOM.getDocument');const node=await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#fixture-file'});await win.webContents.debugger.sendCommand('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[fixture]});}finally{win.webContents.debugger.detach();}return;}
 if(method==='read'){if(args[0]!=='baseline.swayframe')throw Error('Only owned fixture project');return fs.readFile(project,'utf8');}
 if(method==='file'||method==='pixels'){if(!/^[A-Za-z0-9.-]+$/.test(args[0]))throw Error('Invalid artifact name');await fs.writeFile(path.join(out,args[0]),method==='pixels'?Buffer.from(String(args[1]).replace(/^data:image\/png;base64,/,''),'base64'):typeof args[1]==='string'?args[1]:JSON.stringify(args[1],null,2)+'\n');return;}
 const report={...args[0],networkAttempts,modelAttempts,nativeIPC:true,realFilesystem:true,realCanvas:true};await fs.writeFile(path.join(out,process.argv.includes('--reopen-only')?'reopen-report.json':'report.json'),JSON.stringify(report,null,2)+'\n');console.log('QA_COMPLETE',JSON.stringify({pass:report.pass,records:report.records?.length,networkAttempts,modelAttempts}));app.exit(report.pass&&networkAttempts===0&&modelAttempts===0?0:1);
});
setTimeout(()=>app.exit(2),180000);
