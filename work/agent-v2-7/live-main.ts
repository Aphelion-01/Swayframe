import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NativeAIService } from '../../apps/desktop/electron/ai-service';
const out = path.resolve('outputs/agent-v2-7/live');
const caps: Record<string, number> = { A: 6, B: 5, C: 3, Matched: 6 };
const calls: any[] = [];
let caseId = '', turnId = '', active: string | null = null, started = Date.now();
const used = (field: string, upper: string) => calls.reduce((n,c) => n + (c.usage?.[field] ?? c[upper]), 0);
const ledger = () => fs.writeFile(path.join(out,'calls.json'), JSON.stringify(calls,null,2)+'\n');
async function main() {
  const auth = JSON.parse(await fs.readFile('outputs/agent-v2-7/authorization.json','utf8'));
  if (!auth.authorized || auth.stage !== 'V2-7' || auth.requests !== 20 || auth.inputTokens !== 400000 || auth.outputTokens !== 40000) throw Error('Current V2-7 authorization required');
  if (await fs.stat(path.join(out,'calls.json')).then(()=>true,()=>false)) throw Error('Existing ledger: no silent overwrite or repeated paid run');
  app.setName('Swayframe');
  // Keep the OS encryption context in the application's normal user directory.
  // A non-persistent renderer partition isolates the independent test project.
  app.setPath('userData', path.join(app.getPath('appData'),'Swayframe'));
  if (!app.requestSingleInstanceLock()) throw Error('Normal application profile is in use; close the empty instance first');
  await app.whenReady(); await fs.mkdir(out,{recursive:true}); started=Date.now();
  const credentialHost=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await credentialHost.loadURL('about:blank');
  // Match production NativeServices lifecycle: create the BrowserWindow before
  // initializing the OS encryption service, without exposing user credentials.
  const win=new BrowserWindow({show:false,width:1440,height:900,webPreferences:{preload:path.resolve('work/agent-v2-7/live-preload.cjs'),partition:'v2-7-live-memory',contextIsolation:true,nodeIntegration:false}});
  win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>cb({cancel:true}));
  await win.loadURL('about:blank');
  const service = new NativeAIService(path.join(app.getPath('appData'),'Swayframe'), undefined, false, async (url, init) => {
    if (!caseId || !turnId || !active || !caps[caseId]) throw Error('Missing bounded case');
    const endpoint = new URL(String(url));
    if (endpoint.href !== auth.authorizedEndpoint) throw Error('Only explicitly authorized endpoint permitted');
    const body=JSON.parse(String(init?.body)); body.max_tokens=2000; body.stream=false;
    if (body.model !== 'deepseek-flash' || body.messages.some((m:any)=>typeof m.content !== 'string')) throw Error('Fixed route, text only');
    const upper=Buffer.byteLength(JSON.stringify(body),'utf8')+5000;
    if (calls.length>=20 || calls.filter(c=>c.caseId===caseId).length>=caps[caseId] || (caseId==='Matched' && calls.some(c=>c.turnId===turnId)) || used('inputTokens','inputUpper')+upper>400000 || used('outputTokens','outputUpper')+2000>40000 || Date.now()-started>1800000) throw Error('Authorized budget exhausted BEFORE fetch');
    const c:any={index:calls.length+1,caseId,turnId,body,inputUpper:upper,outputUpper:2000,endpoint:String(url),startedAt:new Date().toISOString()};
    calls.push(c); await ledger(); console.log('REQUEST',c.index,caseId,'reserved input',upper);
    try {
      const response=await fetch(url,{...init,body:JSON.stringify(body),signal:AbortSignal.any([...(init?.signal?[init.signal]:[]),AbortSignal.timeout(90000)])});
      c.status=response.status;
      try { c.response=JSON.parse(await response.clone().text()); const u=c.response.usage; if(u && Number.isFinite(u.prompt_tokens) && Number.isFinite(u.completion_tokens)) c.usage={inputTokens:u.prompt_tokens,outputTokens:u.completion_tokens,cacheHitTokens:u.prompt_cache_hit_tokens??null,cacheMissTokens:u.prompt_cache_miss_tokens??null}; } catch { c.invalidResponse=true; }
      c.finishedAt=new Date().toISOString(); await ledger(); console.log('RESPONSE',c.index,c.status,JSON.stringify(c.usage??{unknown:true}));
      return response;
    } catch(e) {c.error='Transport failure or timeout';c.finishedAt=new Date().toISOString();await ledger();throw e;}
  });
  const config=await service.settings();
  const p=config.providers.find(p=>p.enabled && p.type==='openai-compatible' && p.baseUrl===auth.authorizedEndpoint && p.defaultModel==='deepseek-flash');
  if(!p || !await service.dispatch({method:'ai.credentials.has',providerId:p.id})) {
    const diagnostic:any={routeFound:!!p,storageStatus:await service.dispatch({method:'ai.storage.status'}),appData:app.getPath('appData'),credentialReadAttempted:!!p};
    await fs.writeFile(path.join(out,'credential-diagnostic.json'),JSON.stringify(diagnostic,null,2)+'\n');
    throw Error(p ? 'Configured authorized-provider credential unavailable; no request issued' : 'Authorized provider route missing; no credential read or request issued');
  }
  const settings={...config,providers:[p],defaultProviderId:p.id,routing:{general:{providerId:p.id,modelId:'deepseek-flash'},planning:{providerId:p.id,modelId:'deepseek-flash'},vision:null},agent:{...config.agent,planTransport:'tools',nativeSkills:false,visualVerification:false,autoApplySafe:false,streaming:false,recovery:{...config.agent.recovery,providerRetries:0,visualRequests:0}},privacy:{sendReferences:false,sendRenderPreview:false,saveHistory:false},failover:{enabled:false,maxRetries:0}};
  const data=new Map();
  ipcMain.handle('live:ai',async(_e,method,args)=>{
    if(method==='loadSettings') return settings;
    if(method==='hasCredentials') return args[0]===p.id;
    if(method==='storageStatus') return 'secure';
    if(method==='readData') return data.get(args[0]);
    if(method==='writeData') {data.set(args[0],args[1]);return;}
    if(method==='chunks') return [];
    if(method==='models') return p.models;
    if(method==='cancel') return active?service.dispatch({method:'ai.cancel',requestId:active}):null;
    if(method!=='chat') throw Error('Settings and credentials are read-only in validation');
    if(active || args[0]!==p.id || args[2].messages.some((m:any)=>m.images?.length)) throw Error('Parallel requests, changed route or images denied');
    active=randomUUID();
    try {return await service.dispatch({method:'ai.chat',providerId:p.id,requestId:active,request:{...args[2],stream:false,maxOutputTokens:2000}});} finally {active=null;}
  });
  ipcMain.handle('live:case',(_e,id)=>{if(active || !caps[id]) throw Error('Invalid case switch');caseId=id;});
  ipcMain.handle('live:turn',(_e,id)=>{if(active || !/^[A-Za-z0-9-]+$/.test(id))throw Error('Invalid turn switch');turnId=id;});
  ipcMain.handle('live:save',async(_e,name,value)=>{if(!/^[A-Za-z0-9.-]+$/.test(name)) throw Error('Invalid filename');await fs.writeFile(path.join(out,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');});
  ipcMain.handle('live:progress',(_e,message)=>console.log('PROGRESS',message));
  ipcMain.handle('live:shot',async(_e,name)=>{if(!/^[A-Za-z0-9.-]+$/.test(name))throw Error('Invalid filename');await fs.writeFile(path.join(out,name),(await win.webContents.capturePage()).toPNG());});
  ipcMain.handle('live:done',async(_e,report)=>{
    report.budget={requests:calls.length,inputTokens:used('inputTokens','inputUpper'),outputTokens:used('outputTokens','outputUpper'),unknownUsage:calls.filter(c=>!c.usage).length,requestsCap:20,inputCap:400000,outputCap:40000};
    report.paid=true; report.imagesSent=0;report.providerEndpoint=auth.authorizedEndpoint;report.modelRequested='deepseek-flash';report.scope='Real school provider (not official DeepSeek), actual App/AgentPanel/EditorStore/TaskRuntime/Commands/Renderer, independent synthetic projects; matched subset is not full V1 product; official pricing estimate does not apply';
    await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n'); await ledger();console.log('COMPLETE',JSON.stringify(report.budget));app.exit(report.records?.every((r:any)=>r.pass)?0:1);
  });
  win.webContents.on('console-message',(_e,...args)=>console.log('renderer',...args));
  await win.loadFile(path.resolve('work/agent-v2-7/live.html'));
  setTimeout(()=>app.exit(2),1800000);
}
void main().catch(e=>{console.error(String(e));app.exit(2);});
