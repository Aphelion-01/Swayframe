import {app,BrowserWindow,ipcMain,dialog} from 'electron';import fs from 'node:fs/promises';import path from 'node:path';import {NativeServices} from '../../apps/desktop/electron/native-services';import {NativeAssets} from '../../apps/desktop/electron/assets';import '../../apps/desktop/electron/main';
const out=path.resolve(process.env.SF_IMAGE_QA_OUT??'docs/qa/segmentation/real'),project=path.join(out,'image-layers.swayframe');
let win:BrowserWindow,assets:NativeAssets,pickers:(string|null)[]=[],networkAttempts=0,paidModelAttempts=0;
const generated:any[]=[],nativeFailures:string[]=[];let gate:{ready:boolean;promise:Promise<void>;release:()=>void}|undefined,injectFailure=false;
const dispatch=NativeServices.prototype.dispatch;
NativeServices.prototype.dispatch=async function(request){
 if(['ai.chat','ai.models','ai.test'].includes(request.method)){paidModelAttempts++;throw Error('Paid API prohibited');}
 if(process.env.SF_IMAGE_FILTER)console.error('NATIVE',request.method);
 try {const result=await dispatch.call(this,request);if(request.method==='imageLayers.generate'){generated.push(result);if(gate){const g=gate;g.ready=true;await g.promise;}}return result;}catch(error){nativeFailures.push(String(error));throw error;}
};
const realWrite=fs.writeFile;
fs.writeFile=async function(file:any,...args:any[]){if(injectFailure&&String(file).includes('.sf-image-layers-')&&String(file).endsWith('main-subject.png')){injectFailure=false;throw Object.assign(new Error('Injected ENOSPC staging write failure'),{code:'ENOSPC'});}return (realWrite as any)(file,...args);};
const protocol=NativeAssets.prototype.installProtocol;NativeAssets.prototype.installProtocol=function(){assets=this;return protocol.call(this);};
const originalLoad=BrowserWindow.prototype.loadFile;BrowserWindow.prototype.loadFile=function(_file,options){return originalLoad.call(this,path.resolve('work/image-layers-qa/index.html'),options);};
(dialog as any).showOpenDialog=async()=>{const file=pickers.shift();return file?{canceled:false,filePaths:[file]}:{canceled:true,filePaths:[]};};
(dialog as any).showMessageBox=async()=>({response:1,checkboxChecked:false});
app.on('browser-window-created',(_e,w)=>{win=w;w.setContentSize(1440,900);w.webContents.setBackgroundThrottling(false);w.webContents.on('console-message',(_e,...a)=>console.error('renderer',...a));w.webContents.session.webRequest.onBeforeRequest((d,cb)=>{if(/^https?:/.test(d.url)){networkAttempts++;cb({cancel:true});}else cb({});});});
ipcMain.handle('sf-image-layers-qa',async(event,method,...args)=>{
 if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted QA');
 if(method==='init'){await fs.mkdir(path.join(out,'exports'),{recursive:true});assets.grants.grantWrite(project);const inputs=path.resolve('docs/qa/segmentation/inputs');await fs.writeFile(path.join(out,'corrupt.png'),Buffer.from([137,80,78,71,13,10,26,10,0,0,99]));return{out,project,inputs,exports:path.join(out,'exports'),filter:process.env.SF_IMAGE_FILTER??''};}
 if(method==='picker'){pickers=args[0];return;}
 if(method==='generated')return generated;
 if(method==='arm'){let release!:()=>void;gate={ready:false,promise:new Promise(r=>release=r),release:()=>release()};return;}
 if(method==='ready')return gate?.ready??false;
 if(method==='release'){const g=gate;gate=undefined;g?.release();return;}
 if(method==='inject-write-failure'){injectFailure=true;return;}
 if(method==='exports'){return fs.readdir(path.join(out,'exports'));}
 if(method==='file'||method==='png'){if(!/^[a-z0-9.-]+$/.test(args[0]))throw Error('Bad evidence filename');await fs.writeFile(path.join(out,args[0]),method==='png'?Buffer.from(args[1].split(',')[1],'base64'):JSON.stringify(args[1],null,2));return;}
 if(method==='reference'){const directory=args[0];if(!generated.some(r=>r.directory===directory))throw Error('Unowned generated path');return 'data:image/png;base64,'+(await fs.readFile(path.join(directory,'reference.png'))).toString('base64');}
 if(method==='viewport'){if(!win.webContents.debugger.isAttached())win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width:args[0],height:args[1],deviceScaleFactor:1,mobile:false});return;}
 if(method==='capture'){if(!win.webContents.debugger.isAttached())win.webContents.debugger.attach('1.3');const shot=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(out,args[0]+'.png'),Buffer.from(shot.data,'base64'));return;}
 if(method==='done'){const report={...args[0],generated,nativeFailures,networkAttempts,paidModelAttempts};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error('IMAGE_LAYERS_QA',JSON.stringify(report));app.exit(report.pass&&!networkAttempts&&!paidModelAttempts?0:1);return;}
 throw Error('Unknown QA method '+method);
});
setTimeout(()=>app.exit(3),180000).unref();
