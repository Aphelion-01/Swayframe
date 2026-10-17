import {app,BrowserWindow,ipcMain,dialog} from 'electron';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {randomUUID} from 'node:crypto';import fs from 'node:fs/promises';import path from 'node:path';import net from 'node:net';
import {NativeServices} from '../../apps/desktop/electron/native-services';
import {NativeAssets} from '../../apps/desktop/electron/assets';
import '../../apps/desktop/electron/main';
const out=path.resolve(process.env.SF_MCP_QA_OUT??'docs/qa/mcp/real'),project=path.join(out,'mcp.swayframe'),packages=path.join(out,'packages');
let win:BrowserWindow,assets:NativeAssets,networkAttempts=0,modelAttempts=0;
let gate:{promise:Promise<void>;release:()=>void;ready:boolean}|undefined;
const originalDispatch=NativeServices.prototype.dispatch;
NativeServices.prototype.dispatch=async function(request){if(['ai.chat','ai.test','ai.models'].includes(request.method)){modelAttempts++;throw Error('No model API allowed');}const result=await originalDispatch.call(this,request);if(request.method==='assets.layerpack'&&gate){const g=gate;g.ready=true;if(process.env.SF_MCP_CLOSE_ONLY)process.send?.({kind:'reader-ready'});await g.promise;}return result;};
const originalProtocol=NativeAssets.prototype.installProtocol;NativeAssets.prototype.installProtocol=function(){assets=this;return originalProtocol.call(this);};
const load=BrowserWindow.prototype.loadFile;BrowserWindow.prototype.loadFile=function(_file,options){return load.call(this,path.resolve('work/mcp-qa/index.html'),options);};
// The actual folder dialog is selected programmatically for owned fixtures only.
(dialog as any).showMessageBox=async()=>({response:1,checkboxChecked:false});
let chosenFolder=path.join(packages,'B');(dialog as any).showOpenDialog=async()=>({canceled:false,filePaths:[chosenFolder]});
app.on('browser-window-created',(_e,w)=>{win=w;w.setSize(1440,1000);w.hide();w.webContents.setBackgroundThrottling(false);w.webContents.session.webRequest.onBeforeRequest((d,cb)=>{if(/^https?:/.test(d.url)){networkAttempts++;cb({cancel:true});}else cb({});});w.webContents.on('console-message',(_e,...args)=>{console.error('renderer',...args);});});
const wait=(ms=50)=>new Promise(r=>setTimeout(r,ms));
const pending=new Map<string,{resolve:(r:any)=>void;reject:(e:Error)=>void}>();
ipcMain.on('sf-mcp-qa-reply',(_e,id,result)=>{const p=pending.get(id);pending.delete(id);if(result.ok)p?.resolve(result.result);else p?.reject(Error(result.error));});
function task(task:string,arg?:unknown):Promise<any>{const id=randomUUID();return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});win.webContents.send('sf-mcp-qa-task',id,task,arg);setTimeout(()=>{if(pending.delete(id))reject(Error('QA task timeout '+task));},20000).unref();});}
const records:any[]=[],failures:any[]=[];const wireVersions=new Set<string>();
let client:Client|undefined,transport:StdioClientTransport|undefined,config:any,stderr='';
function check(v:unknown,m:string){if(!v)throw Error(m);}
async function test(id:string,fn:()=>Promise<void>){try{await fn();records.push({id,pass:true});}catch(e){records.push({id,pass:false,error:String(e)});}await fs.writeFile(path.join(out,'records.json'),JSON.stringify(records,null,2));console.error(id,records.at(-1));}
async function enable(edit=true,importAssets=true){const r=await task('control',{action:'enable',permissions:{edit,importAssets}});config=JSON.parse(r.config).mcpServers.swayframe;return r.status;}
async function connect(override:any={}){client=new Client({name:'sf-real-sdk-client',version:'0.1.0'},{versionNegotiation:{mode:{pin:'2026-07-28'}}});transport=new StdioClientTransport({...config,...override,stderr:'pipe'});transport.stderr?.on('data',c=>{stderr+=String(c);});const send=transport.send.bind(transport);transport.send=async(message,...rest)=>{const meta=(message as any).params?._meta;for(const [k,v]of Object.entries(meta??{}))if(k.toLowerCase().includes('protocolversion')&&typeof v==='string')wireVersions.add(v);return send(message,...rest);};await client.connect(transport);wireVersions.add(client.getProtocolEra()??'unverified');}
async function close(){await client?.close();client=undefined;await wait();}
async function call(name:string,args:any={},options?:any){check(client,'Client missing');const r=await client!.callTool({name,arguments:args},options);const text=r.content.find(b=>b.type==='text');check(text?.type==='text','Missing JSON response');const data=JSON.parse((text as any).text);if(!data.ok)failures.push({tool:name,error:data.error});return {r,data};}
async function info(){const {data}=await call('sf_project_info');check(data.ok,JSON.stringify(data));return data;}
function arm(){let release!:()=>void;gate={promise:new Promise(r=>release=r),release:()=>release(),ready:false};}
async function until(fn:()=>boolean){for(let i=0;i<200;i++){if(fn())return;await wait(10);}throw Error('Timeout');}
function release(){const g=gate;gate=undefined;g?.release();}
async function screenshot(name:string){
 win.showInactive();await wait(250);const debug=win.webContents.debugger;if(!debug.isAttached())debug.attach('1.3');
 await debug.sendCommand('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const shot=await Promise.race([debug.sendCommand('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),wait(8000).then(()=>{throw Error('Screenshot timeout');})]);
 await fs.writeFile(path.join(out,name),Buffer.from(shot.data,'base64'));
}
ipcMain.once('sf-mcp-qa-ready',()=>{void (process.env.SF_MCP_CLOSE_ONLY?closeOnly():main()).catch(async e=>{console.error(e);await fs.writeFile(path.join(out,'fatal.json'),JSON.stringify({error:String(e)}));app.exit(2);});});
async function main(){
 await fs.mkdir(out,{recursive:true});await fs.cp('docs/qa/ai2comp/packages',packages,{recursive:true});assets.grants.grantWrite(project);
 const ids=await task('init',project);let initial:any,moved:any,owner:any,request:any,imported:any;
 await test('default-off-and-unauthorized-client',async()=>{
  check(!(await task('control',{action:'status'})).status.enabled,'Not default off');await enable();
  const socket=net.connect(Number(config.env.SF_MCP_PORT),'127.0.0.1');const closed=new Promise(r=>socket.once('close',r));socket.on('error',()=>{});socket.on('connect',()=>socket.write(JSON.stringify({type:'authenticate',token:'0'.repeat(64)})+'\n'));await closed;
  check((await task('control',{action:'status'})).status.failure.includes('拒绝'),'No auth rejection');
 });
 await test('real-sdk-connection-and-seven-tools',async()=>{await connect();check((await client!.listTools()).tools.length===7,'Tool count');const i=await info();owner=i.context;const tree=(await call('sf_scene_tree',owner)).data;check(tree.ok&&tree.data.compositions[0].layers[0].id===ids.layerId,'Real tree mismatch');const layer=(await call('sf_inspect_layer',{...owner,layerId:ids.layerId})).data;check(layer.ok&&layer.data.layer.name==='Real MCP target','Inspect mismatch');check((await call('sf_selection',owner)).data.ok,'Selection');initial=await task('snapshot');});
 await test('position-edit-GUI-undo-redo-and-replay',async()=>{request={...owner,requestId:randomUUID(),layerId:ids.layerId,property:'transform.position',value:{x:30,y:25},time:0};check((await call('sf_set_property',request)).data.ok,'Write');await wait();moved=await task('snapshot');check(moved.position.x===30&&moved.undo===initial.undo+1,'Native write');await screenshot('gui-after-mcp-edit.png');await task('undo');check((await task('snapshot')).scene===initial.scene,'Undo');await task('redo');check((await task('snapshot')).scene===moved.scene,'Redo');const current=await info();const duplicate=(await call('sf_set_property',{...request,...current.context})).data;check(!duplicate.ok&&duplicate.error.code==='REPLAY_FORBIDDEN','No replay refusal');});
 await test('invalid-layer-property-and-stale-revision',async()=>{
  const before=await task('snapshot'),i=await info();
  const missing=(await call('sf_set_property',{...request,...i.context,requestId:randomUUID(),layerId:randomUUID()})).data;check(!missing.ok&&missing.error.code==='INVALID_REFERENCE','Invalid layer');
  const bad=(await call('sf_set_property',{...request,...i.context,requestId:randomUUID(),property:'__proto__.polluted'})).data;check(!bad.ok&&bad.error.code==='INVALID_ARGUMENTS','Bad property');
  const stale=(await call('sf_set_property',{...request,requestId:randomUUID()})).data;check(!stale.ok&&stale.error.code==='STALE_BASE','Old revision');check((await task('snapshot')).scene===before.scene,'Failure polluted scene');
 });
 await test('explicit-import-permission-folder-and-bad-path',async()=>{
  await close();await enable();await task('control',{action:'folder'});await connect();
  const i=await info(),before=await task('snapshot');
  const denied=(await call('sf_import_layer_package',{...i.context,requestId:randomUUID(),compositionId:ids.compositionId,directory:'/private/etc'})).data;check(!denied.ok&&denied.error.code==='PERMISSION_DENIED','Unapproved path');check((await task('snapshot')).scene===before.scene,'Path polluted');
  imported=(await call('sf_import_layer_package',{...i.context,requestId:randomUUID(),compositionId:ids.compositionId,directory:chosenFolder})).data;check(imported.ok&&imported.data.layerIds.length===3,'Import failed '+JSON.stringify(imported));
  await task('undo');check((await task('snapshot')).scene===before.scene,'Immediate Undo');await task('redo');
 });
 await test('native-render-PNG-and-pixels',async()=>{
  const i=await info();const {r,data}=await call('sf_render_frame',{...i.context,compositionId:ids.compositionId,time:0,maxDimension:64});check(data.ok,'Render');const image=r.content.find(b=>b.type==='image') as any;check(image&&data.data.width===64&&data.data.height===48,'Image');await fs.writeFile(path.join(out,'mcp-frame.png'),Buffer.from(image.data,'base64'));
  const pixels=await task('pixels','data:image/png;base64,'+image.data);const expected=[[0,0,0,0],[0,0,255,255],[128,0,127,255],[64,128,63,255]];pixels.forEach((p:number[],i:number)=>p.forEach((v,j)=>check(Math.abs(v-expected[i][j])<=2,'Pixel mismatch '+JSON.stringify(pixels))));await fs.writeFile(path.join(out,'pixels.json'),JSON.stringify({pixels,expected,tolerance:2,colorSpace:'srgb'}));
 });
 await test('save-close-reopen-and-edit',async()=>{
  check(await task('save'),'Save');const before=await task('snapshot');await close();const reopened=await task('reopen',project);check(reopened.active&&reopened.scene===before.scene,'Reload');await enable();await connect();const i=await info();check((await call('sf_set_property',{...request,...i.context,requestId:randomUUID(),value:{x:33,y:25}})).data.ok,'Reload edit');await task('undo');check((await task('snapshot')).scene===before.scene,'Reload undo');
 });
 await test('read-only-permissions',async()=>{await close();await enable(false,false);await connect();const i=await info(),before=await task('snapshot');const r=(await call('sf_set_property',{...request,...i.context,requestId:randomUUID()})).data;check(!r.ok&&r.error.code==='PERMISSION_DENIED','Read only edit');const imp=(await call('sf_import_layer_package',{...i.context,requestId:randomUUID(),compositionId:ids.compositionId,directory:chosenFolder})).data;check(!imp.ok&&imp.error.code==='PERMISSION_DENIED','Read only import');check((await task('snapshot')).scene===before.scene,'Read only mutation');});
 await test('client-cancel-late-import',async()=>{await close();await enable();await task('control',{action:'folder'});await connect();const i=await info(),before=await task('snapshot');arm();const c=new AbortController();const work=call('sf_import_layer_package',{...i.context,requestId:randomUUID(),compositionId:ids.compositionId,directory:chosenFolder},{signal:c.signal}).catch(()=>null);await until(()=>!!gate?.ready);c.abort();await wait(100);release();await work;await wait(150);check((await task('snapshot')).scene===before.scene,'Cancel late import polluted');});
 await test('disconnect-cancels-late-import-one-time-session',async()=>{await close();await enable();await task('control',{action:'folder'});await connect();const i=await info(),before=await task('snapshot');arm();const work=call('sf_import_layer_package',{...i.context,requestId:randomUUID(),compositionId:ids.compositionId,directory:chosenFolder}).catch(()=>null);await until(()=>!!gate?.ready);await close();await wait(100);release();await work;await wait(150);check((await task('snapshot')).scene===before.scene,'Disconnect import polluted');let rejected=false;try{await connect();await info();}catch{rejected=true;}check(rejected,'Token reused');await close();});
 await test('project-switch-revokes-old-session',async()=>{await enable();await task('control',{action:'folder'});await connect();const i=await info();arm();const work=call('sf_import_layer_package',{...i.context,requestId:randomUUID(),compositionId:ids.compositionId,directory:chosenFolder}).catch(()=>null);await until(()=>!!gate?.ready);await task('switch');const before=await task('snapshot');release();await work;await wait(150);check((await task('snapshot')).scene===before.scene,'Old import polluted new project');check(!(await task('control',{action:'status'})).status.enabled,'Not revoked');await close();});
 await test('deleted-target-malformed-arguments-and-bad-package',async()=>{
  await task('reopen',project);await enable();chosenFolder=path.join(packages,'C-path');await task('control',{action:'folder'});await connect();let i=await info();const before=await task('snapshot');
  const bad=(await call('sf_import_layer_package',{...i.context,requestId:randomUUID(),compositionId:ids.compositionId,directory:chosenFolder})).data;check(!bad.ok&&bad.error.code==='COMMAND_REJECTION','Bad manifest accepted');check((await task('snapshot')).scene===before.scene,'Bad package pollution');
  const malformed=await client!.callTool({name:'sf_set_property',arguments:{...request,...i.context,requestId:randomUUID(),value:{x:2,y:3},extra:'not-allowed'}});check(malformed.isError,'Unknown field accepted');check((await task('snapshot')).scene===before.scene,'Invalid schema pollution');
  await task('delete');i=await info();const deleted=await task('snapshot');const missing=(await call('sf_set_property',{...request,...i.context,requestId:randomUUID()})).data;check(!missing.ok&&missing.error.code==='INVALID_REFERENCE','Deleted layer edit');check((await task('snapshot')).scene===deleted.scene,'Deleted target pollution');await task('undo');await close();await task('control',{action:'disable'});chosenFolder=path.join(packages,'B');
 });
 await test('duplicate-import-while-pending',async()=>{
  await enable();await task('control',{action:'folder'});await connect();const i=await info();const req={...i.context,requestId:randomUUID(),compositionId:ids.compositionId,directory:chosenFolder};const before=await task('snapshot');arm();const work=call('sf_import_layer_package',req);await until(()=>!!gate?.ready);const duplicate=(await call('sf_import_layer_package',req)).data;check(!duplicate.ok&&duplicate.error.code==='REPLAY_FORBIDDEN','Duplicate import accepted');release();check((await work).data.ok,'First import lost');check((await task('snapshot')).undo===before.undo+1,'Double transaction');await task('undo');check((await task('snapshot')).scene===before.scene,'Import undo mismatch');await close();await task('control',{action:'disable'});
 });
 await test('settings-status-and-clean-shutdown',async()=>{await task('settings');await screenshot('mcp-settings.png');check(!(await task('control',{action:'status'})).status.enabled,'MCP left enabled');});
 const report={pass:records.every(r=>r.pass),records,failures,networkAttempts,modelAttempts,SDK:'@modelcontextprotocol/{server,client}@2.3.1',wireVersions:[...wireVersions],serverInfo:client?.getServerVersion(),protocol:'2026-07-28',stderr:stderr.replace(/[a-f0-9]{64}/g,'[REDACTED]')};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error('MCP_QA',JSON.stringify(report));app.exit(report.pass&&!networkAttempts&&!modelAttempts?0:1);
}
setTimeout(()=>app.exit(3),180000).unref();

async function closeOnly(){
 await fs.mkdir(out,{recursive:true});await fs.cp('docs/qa/ai2comp/packages',packages,{recursive:true});assets.grants.grantWrite(project);
 const ids=await task('init',project);await task('save');await enable();await task('control',{action:'folder'});
 process.on('message',(message:any)=>{if(message.kind==='arm'){arm();process.send?.({kind:'armed'});}if(message.kind==='destroy'){win.destroy();release();}});
 process.send?.({kind:'ready',config,ids,directory:chosenFolder,project});
}
