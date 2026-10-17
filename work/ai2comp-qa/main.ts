import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { NativeServices } from '../../apps/desktop/electron/native-services';
import { NativeAssets } from '../../apps/desktop/electron/assets';
import '../../apps/desktop/electron/main';
import { png } from './fixtures.mjs';
const run = process.env.SF_QA_RUN!;
if (!/^[a-z0-9-]+$/.test(run)) throw Error('Invalid QA run');
const out = path.resolve('docs/qa/ai2comp/runs', run), packages = path.join(out, 'packages'), project = path.join(out, 'layerpack.swayframe');
let win: BrowserWindow, assets: NativeAssets, networkAttempts = 0, modelAttempts = 0;
let gate: { ready: boolean; promise: Promise<void>; release: () => void } | undefined;
globalThis.fetch = async () => { networkAttempts++; throw Error('No external network in Layer Package QA'); };
const original = NativeServices.prototype.dispatch;
NativeServices.prototype.dispatch = async function (request) {
 if (['ai.chat','ai.models','ai.test'].includes(request.method)) { modelAttempts++; throw Error('No model calls'); }
 const value = await original.call(this,request);
 if (request.method === 'assets.layerpack' && gate) { const waiting = gate; waiting.ready = true; await waiting.promise; }
 return value;
};
const protocol = NativeAssets.prototype.installProtocol;
NativeAssets.prototype.installProtocol = function () { assets = this; return protocol.call(this); };
const load = BrowserWindow.prototype.loadFile;
BrowserWindow.prototype.loadFile = function (_file, options) { return load.call(this,path.resolve('work/ai2comp-qa/index.html'), options); };
app.on('browser-window-created',(_e,w) => { win = w; w.webContents.setBackgroundThrottling(false); w.hide(); w.on('show',()=>w.hide()); w.webContents.on('console-message',(_e,...a)=>console.log('renderer',...a)); w.webContents.session.webRequest.onBeforeRequest((d,cb)=>{if(/^https?:/.test(d.url)){networkAttempts++;cb({cancel:true});}else cb({});}); });
ipcMain.handle('sf-layerpack-qa',async(event,method,...args)=>{
 if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted QA');
 if(method==='init') {
  await fs.mkdir(out,{recursive:true});
  const reopen=process.argv.includes('--reopen-only');
  let largeData: string | undefined;
  if(!reopen) {
    await fs.cp('docs/qa/ai2comp/packages',packages,{recursive:true});
    const folder=path.join(packages,'D-budget');await fs.mkdir(path.join(folder,'layers'),{recursive:true});
    const noise=(seed:number)=>{let state=seed;return png(1200,1200,()=>{const pixel=[];for(let i=0;i<4;i++){state^=state<<13;state^=state>>>17;state^=state<<5;pixel.push(state&255);}return pixel;});};
    await fs.writeFile(path.join(folder,'layers/noise.png'),noise(12345));
    largeData='data:image/png;base64,'+noise(54321).toString('base64');
    await fs.writeFile(path.join(folder,'manifest.json'),JSON.stringify({format:'swayframe.layerpack',version:1,canvas:{width:1200,height:1200},layers:[{id:'noise',name:'Noise',type:'raster',asset:'layers/noise.png',bounds:{x:0,y:0,width:1200,height:1200},opacity:1}]}));
  }
  for(const name of ['A','B','C-path','C-corrupt','D-budget','E-opacity'])assets.grants.grantRead(path.join(packages,name));
  assets.grants.grantWrite(project);
  return { out, packages, project, reopen, largeData, expectedData: 'data:image/png;base64,'+(await fs.readFile('docs/qa/ai2comp/packages/expected.png')).toString('base64') };
 }
 if(method==='arm') { if(gate)throw Error('Gate busy');let release!:()=>void;const promise=new Promise<void>(r=>release=r);gate={ready:false,promise,release};return; }
 if(method==='ready')return gate?.ready??false;
 if(method==='release'){const waiting=gate;gate=undefined;waiting?.release();return;}
 if(method==='remove-source'){await fs.rm(path.join(packages,'A'),{recursive:true});return;}
 if(method==='read-project')return fs.readFile(project,'utf8');
 if(method==='capture') { const img=await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });await fs.writeFile(path.join(out,'ui-menu.png'),img.toPNG());return; }
 if(method==='file'||method==='pixels'){if(!/^[a-z0-9.-]+$/.test(args[0]))throw Error('Invalid evidence file');await fs.writeFile(path.join(out,args[0]),method==='pixels'?Buffer.from(args[1].replace(/^data:image\/png;base64,/,''),'base64'):typeof args[1]==='string'?args[1]:JSON.stringify(args[1],null,2)+'\n');return;}
 if(method==='done'){const report={...args[0],networkAttempts,modelAttempts,nativeIPC:true,actualFilesystem:true,actualRenderer:true};await fs.writeFile(path.join(out,process.argv.includes('--reopen-only')?'reopen-report.json':'report.json'),JSON.stringify(report,null,2)+'\n');console.log('LAYERPACK_QA',JSON.stringify({pass:report.pass,records:report.records.length,networkAttempts,modelAttempts}));app.exit(report.pass&&!networkAttempts&&!modelAttempts?0:1);return;}
 throw Error('Unknown QA method');
});
setTimeout(()=>app.exit(2),180000);
