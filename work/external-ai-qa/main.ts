import {app,BrowserWindow,dialog} from 'electron';
import fs from 'node:fs/promises';import path from 'node:path';
import '../../apps/desktop/electron/main';
const out=path.resolve(process.env.SF_EXTERNAL_OUT??'docs/qa/external-ai/run'),project=path.resolve('docs/qa/external-ai/workflow.swayframe'),pkg=path.resolve('docs/qa/external-ai/composition');
let win:BrowserWindow,networkAttempts=0;
const originalLoad=BrowserWindow.prototype.loadFile;BrowserWindow.prototype.loadFile=function(_f,o){return originalLoad.call(this,path.resolve('dist/index.html'),o);};
// A real selected local fixture is returned to the original native dialog handler, which grants access.
(dialog as any).showOpenDialog=async()=>({canceled:false,filePaths:[pkg]});
const wait=(ms=60)=>new Promise(r=>setTimeout(r,ms));const js=(code:string)=>win.webContents.executeJavaScript(code);
async function until(fn:()=>Promise<boolean>){for(let i=0;i<300;i++){if(await fn())return;await wait();}throw Error('UI wait timed out');}
async function settings(){await js("window.dispatchEvent(new Event('swayframe:ai-settings'))");await until(()=>js("!!document.querySelector('[role=dialog]')"));await js("Array.from(document.querySelectorAll('[role=tab]')).find(e=>e.textContent==='MCP').click()");await until(()=>js("!!document.querySelector('section[aria-label=\"MCP 外部工具连接\"]')"));}
async function shot(name:string){if(!/^[a-z0-9-]+$/.test(name))throw Error('Invalid screenshot name');if(!win.webContents.debugger.isAttached())win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});const r=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
async function shortcut(key:string,shift=false){await js('document.activeElement?.blur()');win.focus();for(const type of ['keyDown','keyUp'] as const)win.webContents.sendInputEvent({type,keyCode:key,modifiers:shift?['meta','shift']:['meta']});await wait(120);}
async function perform(task:string,arg:any){
 switch(task){
 case 'authorize':{
  await settings();await js("Array.from(document.querySelectorAll('section[aria-label=\"MCP 外部工具连接\"] input')).filter(e=>e.type==='checkbox'&&!e.readOnly&&!e.checked).forEach(e=>e.click())");await wait();await js("Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='启用本次连接').click()");await until(()=>js("!!document.querySelector('textarea[aria-label=\"MCP 客户端配置\"]')"));await js("Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='选择授权分层包文件夹…').click()");await until(()=>js("document.querySelector('section[aria-label=\"MCP 外部工具连接\"]').textContent.includes('已授权分层包')"));const config=JSON.parse(await js("document.querySelector('textarea[aria-label=\"MCP 客户端配置\"]').value")).mcpServers.swayframe;await js("document.querySelector('button[aria-label=\"关闭设置\"]').click()");return config;
 }
 case 'animation':{
  if(!/^[0-9a-f-]{36}$/.test(arg.layerId))throw Error('Invalid layer');await js(`document.querySelector('[data-layer-id="${arg.layerId}"] .layer-select').click()`);await until(()=>js("!!document.querySelector('[aria-label=\"开启位置动画\"]')"));await shot('subject-selected');await js("document.querySelector('[aria-label=\"开启位置动画\"]').click()");await until(()=>js("!!document.querySelector('[aria-label=\"关闭位置动画\"]')"));await shot('gui-animation-enabled');return {nativeAnimationEnabled:true};
 }
 case 'select':{if(!/^[0-9a-f-]{36}$/.test(arg.layerId))throw Error('Invalid layer');await js(`document.querySelector('[data-layer-id="${arg.layerId}"] .layer-select').click()`);await wait();return {selection:await js("Array.from(document.querySelectorAll('.layer-row.selected')).map(e=>e.dataset.layerId)"),positionX:await js("document.querySelector('input[aria-label=\"位置 X\"]')?.value")};}
 case 'shot':await shot(arg.name);return true;
 case 'undo':await shortcut('z');return true;
 case 'redo':await shortcut('z',true);return true;
 case 'save':await shortcut('s');await until(async()=>JSON.parse(await fs.readFile(project,'utf8')).compositions[0].layers.length===4);return {saved:project};
 case 'reopen':win.webContents.send('swayframe:action','close-project');await until(()=>js("!!document.querySelector('.desktop-start')"));win.webContents.send('swayframe:action','open',project);await until(()=>js("document.querySelectorAll('.layer-row').length===4"));return true;
 case 'finish':await settings();await js("Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='关闭 MCP 并撤销授权')?.click()");await wait();const disabled=await js("document.querySelector('section[aria-label=\"MCP 外部工具连接\"]').textContent.includes('已关闭')");await js("document.querySelector('button[aria-label=\"关闭设置\"]').click()");await shot('final-editor');await fs.writeFile(path.join(out,'electron.json'),JSON.stringify({networkAttempts,disabled,renderer:'actual dist/index.html',preload:'production unmodified'},null,2));return {networkAttempts,disabled};
 case 'quit':app.exit(0);return true;
 default:throw Error('Unknown UI test task');
 }
}
process.on('message',async(m:any)=>{if(m?.kind!=='ui')return;try{const result=await perform(m.task,m.arg);process.send?.({kind:'reply',id:m.id,ok:true,result});}catch(e){process.send?.({kind:'reply',id:m.id,ok:false,error:String(e)});}});
app.on('browser-window-created',(_e,w)=>{win=w;w.setContentSize(1440,900);w.webContents.setBackgroundThrottling(false);w.webContents.session.webRequest.onBeforeRequest((d,cb)=>{if(/^https?:/.test(d.url)){networkAttempts++;cb({cancel:true});}else cb({});});w.webContents.once('did-finish-load',()=>{void (async()=>{await fs.mkdir(out,{recursive:true});await until(()=>js("!!document.querySelector('.editor-app')"));process.send?.({kind:'ready',project,pkg});})().catch(e=>{console.error(e);app.exit(1);});});});
setTimeout(()=>app.exit(3),180000).unref();
