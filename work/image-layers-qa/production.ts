import {app,BrowserWindow,dialog} from 'electron';import fs from 'node:fs/promises';import path from 'node:path';import '../../apps/desktop/electron/main';
const out=path.resolve(process.env.SF_IMAGE_PRODUCTION_OUT??'docs/qa/segmentation/production'),file=path.resolve(process.argv.find(p=>p.endsWith('.swayframe'))!),input=path.resolve('docs/qa/segmentation/inputs/B-astronaut.png');
const load=BrowserWindow.prototype.loadFile;BrowserWindow.prototype.loadFile=function(_file,options){return load.call(this,path.resolve('dist/index.html'),options);};
(dialog as any).showOpenDialog=async(_window:any,options:any)=>({canceled:false,filePaths:[options.properties.includes('openDirectory')?path.join(out,'exports'):input]});
let win:BrowserWindow,networkAttempts=0;const wait=()=>new Promise(r=>setTimeout(r,40)),records:any[]=[];
const js=(code:string)=>win.webContents.executeJavaScript(code);
async function until(fn:()=>Promise<boolean>){for(let i=0;i<400;i++){if(await fn())return;await wait();}throw Error('Production UI timeout');}
function check(v:unknown,id:string){if(!v)throw Error(id);records.push({id,pass:true});}
app.on('browser-window-created',(_e,w)=>{win=w;w.setContentSize(1440,900);w.webContents.setBackgroundThrottling(false);w.webContents.session.webRequest.onBeforeRequest((d,cb)=>{if(/^https?:/.test(d.url)){networkAttempts++;cb({cancel:true});}else cb({});});w.webContents.once('did-finish-load',()=>{void main().catch(async e=>{await fs.writeFile(path.join(out,'report.json'),JSON.stringify({pass:false,error:String(e),records},null,2));console.error(e);app.exit(1);});});});
async function main(){
 await fs.mkdir(path.join(out,'exports'),{recursive:true});const baseline=JSON.parse(await fs.readFile(file,'utf8'));await until(()=>js("!!document.querySelector('.editor-app')"));
 await js("Array.from(document.querySelectorAll('summary')).find(e=>e.textContent.trim()==='文件').click()");await wait();await js("document.querySelector('[aria-label=\"图片转分层（Mac 本地）…\"]').click()");
 await until(()=>js("document.querySelector('[data-import-phase]')?.dataset.importPhase==='preview'"));check(await js("document.body.textContent.includes('透明缺口') && document.body.textContent.includes('1024')"),'actual-dist-limits-visible');
 await js("document.querySelector('summary').blur()");
 if(!win.webContents.debugger.isAttached())win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});const preview=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(out,'actual-dist-preview.png'),Buffer.from(preview.data,'base64'));
 await js("Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='确认导入').click()");await until(()=>js("!document.querySelector('[data-import-phase]') && document.querySelectorAll('.layer-row').length===2"));check(true,'actual-dist-native-layer-panel');
 await js("document.activeElement?.blur()");win.webContents.sendInputEvent({type:'keyDown',keyCode:'s',modifiers:['meta']});win.webContents.sendInputEvent({type:'keyUp',keyCode:'s',modifiers:['meta']});
 await until(async()=>{const p=JSON.parse(await fs.readFile(file,'utf8'));return p.compositions.length===baseline.compositions.length+1;});const p=JSON.parse(await fs.readFile(file,'utf8'));const c=p.compositions.find((c:any)=>c.id===p.activeCompositionId);check(c.width===512&&c.height===512&&c.layers[1].name==='Main Subject','actual-dist-saved-generated-layers');check(c.layers.every((l:any)=>p.assets.some((a:any)=>a.id===l.assetId&&a.dataUrl.startsWith('data:image/png;base64,'))),'actual-dist-embedded-assets');
 const full=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(out,'actual-dist-imported.png'),Buffer.from(full.data,'base64'));
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify({pass:true,records,networkAttempts,renderer:'actual dist/index.html',preload:'unmodified production preload',files:await fs.readdir(path.join(out,'exports'))},null,2));console.error('IMAGE_PRODUCTION_PASS',JSON.stringify(records));app.exit(networkAttempts?1:0);
}
setTimeout(()=>app.exit(3),120000).unref();
