import {app,BrowserWindow,ipcMain} from 'electron';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {randomUUID,createHash} from 'node:crypto';import fs from 'node:fs/promises';import path from 'node:path';
import '../../apps/desktop/electron/main';
const out=path.resolve(process.env.SF_MCP_PROD_OUT??'docs/qa/mcp/production'),file=path.resolve(process.argv.find(p=>p.endsWith('.swayframe'))!);
const load=BrowserWindow.prototype.loadFile;
BrowserWindow.prototype.loadFile=function(_f,options){return load.call(this,path.resolve('dist/index.html'),options);};
let win:BrowserWindow,networkAttempts=0;
const records:any[]=[];
const wait=(ms=60)=>new Promise(r=>setTimeout(r,ms));
function check(v:unknown,id:string){if(!v)throw Error(id);records.push({id,pass:true});}
async function until(fn:()=>Promise<boolean>){for(let i=0;i<200;i++){if(await fn())return;await wait();}throw Error('Timed out');}
const js=(s:string)=>win.webContents.executeJavaScript(s);
async function openSettings(){await js("window.dispatchEvent(new Event('swayframe:ai-settings'))");await until(()=>js("!!document.querySelector('[role=dialog]')"));await js("Array.from(document.querySelectorAll('[role=tab]')).find(e=>e.textContent==='MCP').click()");await wait();}
async function enable(){await openSettings();await js("Array.from(document.querySelectorAll('section[aria-label=\"MCP 外部工具连接\"] input')).find(e=>e.parentElement.textContent.includes('编辑图层')).click()");await js("Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='启用本次连接').click()");await until(()=>js("!!document.querySelector('textarea[aria-label=\"MCP 客户端配置\"]')"));const config=JSON.parse(await js("document.querySelector('textarea[aria-label=\"MCP 客户端配置\"]').value")).mcpServers.swayframe;await js("document.querySelector('button[aria-label=\"关闭设置\"]').click()");if(process.env.SF_MCP_PACKAGED_CLI){config.command=path.resolve('release/mac-arm64/Swayframe.app/Contents/MacOS/Swayframe');config.args=[path.resolve('release/mac-arm64/Swayframe.app/Contents/Resources/app.asar/desktop-dist/mcp-server.cjs')];}return config;}
async function shortcut(shift=false,key='z'){win.focus();await js("document.activeElement?.blur()");win.webContents.sendInputEvent({type:'keyDown',keyCode:key,modifiers:shift?['meta','shift']:['meta']});win.webContents.sendInputEvent({type:'keyUp',keyCode:key,modifiers:shift?['meta','shift']:['meta']});await wait(150);}
async function screenshot(){win.show();win.focus();await wait(150);const shot=await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await fs.writeFile(path.join(out,'actual-dist-gui.png'),shot.toPNG());}
app.on('browser-window-created',(_e,w)=>{win=w;w.setSize(1440,1000);w.webContents.setBackgroundThrottling(false);w.webContents.session.webRequest.onBeforeRequest((d,cb)=>{if(/^https?:/.test(d.url)){networkAttempts++;cb({cancel:true});}else cb({});});w.webContents.once('did-finish-load',()=>{void main().catch(async e=>{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify({pass:false,error:String(e),records,networkAttempts},null,2));console.error(e);app.exit(1);});});});
async function main(){
 await fs.mkdir(out,{recursive:true});await until(()=>js("!!document.querySelector('.editor-app')"));check(await js("document.body.textContent.includes('Real MCP target')"),'actual-dist-startup-load');
 const config=await enable();const client=new Client({name:'sf-production-client',version:'0.1.0'},{versionNegotiation:{mode:{pin:'2026-07-28'}}});await client.connect(new StdioClientTransport(config));
 async function call(name:string,args:any={}){const r=await client.callTool({name,arguments:args});const text=r.content.find(b=>b.type==='text') as any;const value=JSON.parse(text.text);if(!value.ok)throw Error(JSON.stringify(value));return {value,r};}
 let info=(await call('sf_project_info')).value;const tree=(await call('sf_scene_tree',info.context)).value;check(tree.data.compositions[0].layers.length===4,'actual-dist-scene-tree-four-layers');const target=tree.data.compositions[0].layers.at(-1),comp=tree.data.compositions[0].id;
 let detail=(await call('sf_inspect_layer',{...info.context,layerId:target.id})).value;const original=detail.data.layer.transform.position.baseValue;
 const before=(await call('sf_render_frame',{...info.context,compositionId:comp,time:0,maxDimension:64})).r.content.find(b=>b.type==='image') as any;
 const desired={x:original.x+12,y:original.y+4};
 await call('sf_set_property',{...info.context,requestId:randomUUID(),layerId:target.id,property:'transform.position',value:desired,time:0});
 info=(await call('sf_project_info')).value;detail=(await call('sf_inspect_layer',{...info.context,layerId:target.id})).value;check(detail.data.layer.transform.position.baseValue.x===desired.x,'actual-dist-native-position-change');
 const after=(await call('sf_render_frame',{...info.context,compositionId:comp,time:0,maxDimension:64})).r.content.find(b=>b.type==='image') as any;check(before.data!==after.data,'actual-dist-real-render-changed');await fs.writeFile(path.join(out,'before.png'),Buffer.from(before.data,'base64'));await fs.writeFile(path.join(out,'after.png'),Buffer.from(after.data,'base64'));await screenshot();
 await shortcut();info=(await call('sf_project_info')).value;detail=(await call('sf_inspect_layer',{...info.context,layerId:target.id})).value;check(detail.data.layer.transform.position.baseValue.x===original.x,'actual-dist-GUI-undo');
 await shortcut(true);await shortcut(false,'s');await until(async()=>{const p=JSON.parse(await fs.readFile(file,'utf8'));return p.compositions[0].layers.at(-1).transform.position.baseValue.x===desired.x;});check(true,'actual-dist-GUI-save-real-file');await client.close();
 win.webContents.send('swayframe:action','close-project');await until(()=>js("!!document.querySelector('.desktop-start')"));win.webContents.send('swayframe:action','open',file);await until(()=>js("!!document.querySelector('.editor-app') && document.body.textContent.includes('Real MCP target')"));
 const config2=await enable();const client2=new Client({name:'sf-production-reopen-client',version:'0.1.0'},{versionNegotiation:{mode:{pin:'2026-07-28'}}});await client2.connect(new StdioClientTransport(config2));
 const result=await client2.callTool({name:'sf_project_info',arguments:{}});const context=JSON.parse((result.content[0] as any).text).context;const read=await client2.callTool({name:'sf_inspect_layer',arguments:{...context,layerId:target.id}});check(JSON.parse((read.content[0] as any).text).data.layer.transform.position.baseValue.x===desired.x,'actual-dist-reopen-preserves-edit');await client2.close();
 await openSettings();await js("Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='关闭 MCP 并撤销授权').click()");await wait();check(await js("document.querySelector('section[aria-label=\"MCP 外部工具连接\"]').textContent.includes('已关闭')"),'actual-dist-user-revokes');
 const report={pass:true,records,networkAttempts,protocolEra:'modern',protocol:'2026-07-28',renderer:'unmodified built dist/index.html',preloadSHA256:createHash('sha256').update(await fs.readFile('desktop-dist/preload.cjs')).digest('hex')};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error('PRODUCTION_MCP',JSON.stringify(report));app.exit(networkAttempts?1:0);
}
setTimeout(()=>app.exit(3),120000).unref();
