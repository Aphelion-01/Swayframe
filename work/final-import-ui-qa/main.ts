import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { NativeServices } from '../../apps/desktop/electron/native-services';
import { NativeAssets } from '../../apps/desktop/electron/assets';
import '../../apps/desktop/electron/main';
const out=path.resolve(process.env.SF_QA_CLOSE==='1'?'docs/qa/ai-final/import-ui/close-run':process.env.SF_QA_NATIVE==='1'?'docs/qa/ai-final/import-ui/native-final':'docs/qa/ai-final/import-ui/run'),packages=path.join(out,'packages'),project=path.join(out,'editor.swayframe');
let win:BrowserWindow,assets:NativeAssets,networkAttempts=0,modelAttempts=0,pickerCalls=0;
let picker: string|null|undefined, gate:{ready:boolean,promise:Promise<void>,release:()=>void}|undefined;
const logs:any[]=[];let emulated:{width:number,height:number}|undefined;
const original=NativeServices.prototype.dispatch;
NativeServices.prototype.dispatch=async function(request){
 if(['ai.chat','ai.models','ai.test'].includes(request.method)){modelAttempts++;throw Error('No model API');}
 if(request.method==='dialog.folder') { pickerCalls++; if(picker!==undefined){const result=picker;picker=undefined;if(result)assets.grants.grantRead(result);return result;} }
 const value=await original.call(this,request);
 if(request.method==='assets.layerpack'&&gate){const g=gate;g.ready=true;await g.promise;}
 return value;
};
const protocol=NativeAssets.prototype.installProtocol;
NativeAssets.prototype.installProtocol=function(){assets=this;return protocol.call(this);};
const load=BrowserWindow.prototype.loadFile;
BrowserWindow.prototype.loadFile=function(_file,options){return load.call(this,path.resolve('work/final-import-ui-qa/index.html'),options);};
app.on('browser-window-created',(_e,w)=>{win=w;w.setTitle('SF AI2Comp Editor QA');w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',(_e,...a)=>{logs.push(a);console.log('renderer',...a);});w.webContents.session.webRequest.onBeforeRequest((d,cb)=>{if(/^https?:/.test(d.url)){networkAttempts++;cb({cancel:true});}else cb({});});});
ipcMain.handle('sf-editor-qa',async(event,method,...args)=>{
 if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted QA sender');
 if(method==='init'){
 await fs.mkdir(out,{recursive:true});await fs.cp('docs/qa/ai2comp/packages',packages,{recursive:true});
 await fs.cp(path.join(packages,'B'),path.join(packages,'missing'),{recursive:true});await fs.rm(path.join(packages,'missing/layers/subject.png'),{force:true});
 await fs.cp(path.join(packages,'B'),path.join(packages,'invalid'),{recursive:true});await fs.writeFile(path.join(packages,'invalid/manifest.json'),'{broken');
 assets.grants.grantWrite(project);return {out,packages,project,automated:process.env.SF_QA_AUTOMATED==='1',closeCheck:process.env.SF_QA_CLOSE==='1',reopenCheck:process.env.SF_QA_REOPEN==='1'};}
 if(method==='close-window'){const before=await fs.readFile(project,'utf8');win.once('closed',()=>{const same=before===fsSync.readFileSync(project,'utf8');fsSync.writeFileSync(path.join(out,'close-report.json'),JSON.stringify({pass:same,windowClosed:true,savedSceneUnchanged:same,realMainCloseHandler:true,lateNativeResultPrepared:!!gate?.ready,networkAttempts,modelAttempts},null,2));gate?.release();});win.close();return;}
 if(method==='picker'){picker=args[0]===null?null:path.join(packages,args[0]);return;}
 if(method==='picker-count')return pickerCalls;
 if(method==='arm'){let release!:()=>void;const promise=new Promise<void>(r=>release=r);gate={ready:false,promise,release};return;}
 if(method==='ready')return gate?.ready??false;
 if(method==='release'){const g=gate;gate=undefined;g?.release();return;}
 if(method==='stage'){await fs.writeFile(path.join(out,'stage.json'),JSON.stringify(args[0],null,2));console.log('STAGE',JSON.stringify(args[0]));return;}
 if(method==='viewport'){emulated={width:args[0],height:args[1]};win.setContentSize(1280,720);if(!win.webContents.debugger.isAttached())win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width:args[0],height:args[1],deviceScaleFactor:1,mobile:false,screenWidth:args[0],screenHeight:args[1]});return;}
 if(method==='capture'){let png:Buffer;if(emulated){if(!win.webContents.debugger.isAttached())win.webContents.debugger.attach('1.3');const shot=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:true,clip:{x:0,y:0,...emulated,scale:1}});png=Buffer.from(shot.data,'base64');}else png=(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG();await fs.writeFile(path.join(out,args[0]+'.png'),png);return;}
 if(method==='read-project')return fs.readFile(project,'utf8');
 if(method==='file'||method==='pixels'){if(!/^[a-z0-9.-]+$/.test(args[0]))throw Error('Invalid evidence filename');await fs.writeFile(path.join(out,args[0]),method==='pixels'?Buffer.from(args[1].split(',')[1],'base64'):JSON.stringify(args[1],null,2));return;}
 if(method==='done'){const report={...args[0],networkAttempts,modelAttempts,pickerCalls};await fs.writeFile(path.join(out,process.env.SF_QA_REOPEN==='1'?'reopen-report.json':'report.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(out,'console.json'),JSON.stringify(logs,null,2));console.log('EDITOR_QA_DONE',JSON.stringify(report));app.exit(report.pass?0:1);return;}
 throw Error('Unknown method');
});
setTimeout(()=>app.exit(2),1200000);
