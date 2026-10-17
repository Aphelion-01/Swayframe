import {app,BrowserWindow,ipcMain} from 'electron';
import fs from 'node:fs/promises';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {NativeAIService} from '../../apps/desktop/electron/ai-service';
import {NativeServices} from '../../apps/desktop/electron/native-services';
import '../../apps/desktop/electron/main';
// QA only: use the production main, credential service, preload and renderer.
// No captured responses, alternate providers, credentials exports or formal data writes.
const ledgerDir=path.resolve('outputs/agent-v2-7/live'),out=path.join(ledgerDir,'final-repeat');
const auth=JSON.parse(readFileSync('outputs/agent-v2-7/authorization-round3.json','utf8'));
const original=readFileSync(path.join(ledgerDir,'calls-before-round3.json'));
const calls:any[]=JSON.parse(readFileSync(path.join(ledgerDir,'calls.json'),'utf8'));
const baselineCount=28,baselineJSON=JSON.stringify(calls),model='deepseek-v4-flash';
if(!auth.authorized||auth.stage!=='V2-7'||auth.roundId!=='final-repeat-round3'||auth.requests!==20||auth.inputTokens!==400000||auth.outputTokens!==40000||auth.maxOutputPerRequest!==2000||auth.modelID!==model||auth.baseRequests!==28||auth.cumulativeRequestCeiling!==48||auth.cumulativeInputCeiling!==1104968||auth.cumulativeOutputCeiling!==69425||calls.length!==28||createHash('sha256').update(original).digest('hex')!==auth.baseLedgerSHA256||JSON.stringify(JSON.parse(original.toString()))!==baselineJSON||existsSync(path.join(out,'report.json')))throw Error('Explicit fresh authorization and immutable 28-call baseline required');
const caps:Record<string,number>={A:5,B:4,C:2,Matched:9};
if(JSON.stringify(auth.caseCaps)!==JSON.stringify(caps)||auth.matchedMaximumPerVariant!==2)throw Error('Case caps differ from authorization');
const data=new Map();let caseId='',turnId='',win:BrowserWindow,active=false,stopReason:string|null=null;
const start=Date.now(),sum=(rows:any[],key:string,upper:string)=>rows.reduce((s,c)=>s+(c.usage?.[key]??c[upper]),0),rows=()=>calls.slice(baselineCount);
const saveLedger=async()=>{if(JSON.stringify(calls.slice(0,baselineCount))!==baselineJSON)throw Error('Historical ledger altered');await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(ledgerDir,'calls.json'),JSON.stringify(calls,null,2)+'\n');};
let settings:any;const originalSettings=NativeAIService.prototype.settings;
NativeAIService.prototype.settings=async function(){
  if(settings)return settings;const cfg=await originalSettings.call(this),p=cfg.providers.find(p=>p.enabled&&p.baseUrl===auth.authorizedEndpoint&&p.defaultModel===model);
  if(!p||cfg.routing.planning?.providerId!==p.id||cfg.routing.planning.modelId!==model)throw Error('Saved route differs from authorized service/model');
  settings={...cfg,providers:[p],defaultProviderId:p.id,routing:{general:{providerId:p.id,modelId:model},planning:{providerId:p.id,modelId:model},vision:null},agent:{...cfg.agent,planTransport:'tools',nativeSkills:false,visualVerification:false,autoApplySafe:false,streaming:false,recovery:{...cfg.agent.recovery,providerRetries:0,visualRequests:0}},privacy:{sendReferences:false,sendRenderPreview:false,saveHistory:false},failover:{enabled:false,maxRetries:0}};return settings;
};
const dispatch=NativeAIService.prototype.dispatch;
NativeAIService.prototype.dispatch=async function(request){
  if(request.method==='ai.settings.save'||request.method.startsWith('ai.credentials.')&&request.method!=='ai.credentials.has')throw Error('Formal settings/credentials frozen');
  if(request.method==='ai.data.read')return data.get(request.key);
  if(request.method==='ai.data.write'){data.set(request.key,JSON.parse(request.data));return;}
  if(request.method==='ai.test'||request.method==='ai.models')throw Error('Only authorized chat requests allowed');
  if(request.method!=='ai.chat')return dispatch.call(this,request);
  if(active)throw Error('No parallel requests');active=true;
  (this as any).fetcher=async(url:any,init:any)=>{
    if(!caseId||!turnId||!caps[caseId]||new URL(String(url)).href!==auth.authorizedEndpoint)throw Error('Unauthorized route or case');
    const body=JSON.parse(String(init.body));body.max_tokens=2000;body.stream=false;
    if(body.model!==model||body.messages.some((m:any)=>typeof m.content!=='string'))throw Error('Fixed model/text only');
    const upper=Buffer.byteLength(JSON.stringify(body),'utf8')+5000,r=rows();
    const exhausted=!!stopReason||r.length>=20||r.filter(c=>c.caseId===caseId).length>=caps[caseId]||(caseId==='Matched'&&r.filter(c=>c.turnId===turnId).length>=2)||sum(r,'inputTokens','inputUpper')+upper>400000||sum(r,'outputTokens','outputUpper')+2000>40000||calls.length>=48||sum(calls,'inputTokens','inputUpper')+upper>1104968||sum(calls,'outputTokens','outputUpper')+2000>69425||Date.now()-start>1800000;
    if(exhausted){stopReason=stopReason??'Budget or deadline exhausted BEFORE fetch';throw Error(stopReason);}
    const c:any={index:calls.length+1,roundId:auth.roundId,runId:'final-repeat',caseId,turnId,kind:'chat',body,inputUpper:upper,outputUpper:2000,endpoint:String(url),startedAt:new Date().toISOString()};calls.push(c);await saveLedger();console.log('REQUEST',c.index,turnId);
    try{
      const response=await fetch(url,{...init,body:JSON.stringify(body),signal:AbortSignal.any([...(init.signal?[init.signal]:[]),AbortSignal.timeout(90000)])});c.status=response.status;
      try{c.response=JSON.parse(await response.clone().text());const u=c.response.usage;if(u&&Number.isFinite(u.prompt_tokens)&&Number.isFinite(u.completion_tokens))c.usage={inputTokens:u.prompt_tokens,outputTokens:u.completion_tokens,cacheHitTokens:u.prompt_cache_hit_tokens??null,cacheMissTokens:u.prompt_cache_miss_tokens??null};}catch{c.invalidResponse=true;}
      if([401,403].includes(c.status)||['model_not_found','invalid_model','model_not_supported'].includes(c.response?.error?.code))stopReason='Provider authentication or model rejected; halt all remaining cases';
      c.finishedAt=new Date().toISOString();await saveLedger();console.log('RESPONSE',c.index,c.status,JSON.stringify(c.usage??{unknown:true}));return response;
    }catch(e){c.error='Transport failure or timeout';c.finishedAt=new Date().toISOString();await saveLedger();throw e;}
  };
  try{return await dispatch.call(this,{...request,request:{...request.request,stream:false,maxOutputTokens:2000}});}finally{active=false;}
};
const desktopDispatch=NativeServices.prototype.dispatch;
NativeServices.prototype.dispatch=async function(request){if(['recovery.write','recovery.clear','recent.add','log.error'].includes(request.method))return;if(request.method==='startup.read')return null;return desktopDispatch.call(this,request);};
const load=BrowserWindow.prototype.loadFile;
BrowserWindow.prototype.loadFile=function(_file,options){return load.call(this,path.resolve('work/agent-v2-7/live-final.html'),options);};
app.on('browser-window-created',(_e,w)=>{win=w;win.webContents.setBackgroundThrottling(false);win.hide();win.on('show',()=>win.hide());win.webContents.on('console-message',(_e,...args)=>console.log('renderer',...args));});
for(const method of ['case','turn','save','progress','shot','stopped','mode','remaining','render','done'])ipcMain.handle('live:'+method,async(event,...args)=>{
  if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('QA sender denied');
  if(method==='stopped')return stopReason;
  if(method==='remaining')return caps[caseId]-rows().filter(c=>c.caseId===caseId).length;
  if(method==='mode')return {replay:false,recheck:false,plannerRecheck:false,continuation:false,titleRetry:false,creationRetry:false,scopedEditRetry:false,spentTurns:[]};
  if(method==='case'){if(active||!caps[args[0]])throw Error('Invalid case');caseId=args[0];return;}
  if(method==='turn'){if(active||!/^[A-Za-z0-9-]+$/.test(args[0]))throw Error('Invalid turn');turnId=args[0];return;}
  if(method==='progress'){console.log('PROGRESS',args[0]);return;}
  if(method==='shot')throw Error('No hidden-window capturePage waits');
  if(method==='save'||method==='render'){
    if(!/^[A-Za-z0-9.-]+$/.test(args[0]))throw Error('Invalid file');await fs.mkdir(out,{recursive:true});
    if(method==='render'){if(!args[0].endsWith('.png')||typeof args[1]!=='string'||!args[1].startsWith('data:image/png;base64,')||args[1].length>14000000)throw Error('Independent PNG only');await fs.writeFile(path.join(out,args[0]),Buffer.from(args[1].slice('data:image/png;base64,'.length),'base64'));}
    else await fs.writeFile(path.join(out,args[0]),typeof args[1]==='string'?args[1]:JSON.stringify(args[1],null,2)+'\n');return;
  }
  const report=args[0];report.budget={requests:calls.length,inputTokens:sum(calls,'inputTokens','inputUpper'),outputTokens:sum(calls,'outputTokens','outputUpper'),unknownUsage:calls.filter(c=>!c.usage).length,requestsCap:48,inputCap:1104968,outputCap:69425};report.roundBudget={requests:rows().length,inputTokens:sum(rows(),'inputTokens','inputUpper'),outputTokens:sum(rows(),'outputTokens','outputUpper'),unknownUsage:rows().filter(c=>!c.usage).length,requestsCap:20,inputCap:400000,outputCap:40000};report.providerEndpoint=auth.authorizedEndpoint;report.modelRequested=model;report.stopReason=stopReason;report.roundId=auth.roundId;report.baselinePreserved=JSON.stringify(calls.slice(0,baselineCount))===baselineJSON;report.imagesSent=0;report.privateProjectsSent=0;report.activeLiveDurationMs=Date.now()-start;report.fixtureReplayRequests=0;report.scope='Fresh fixed-version A/B/C same-session and matched V1/V2; READ and retries included';report.host='Production main/preload/credential SDK; independent EditorStore; frozen formal settings';
  await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await saveLedger();console.log('COMPLETE',JSON.stringify(report.roundBudget));app.exit(report.records?.length===16&&report.records.every((r:any)=>r.pass)?0:1);
});
setTimeout(()=>app.exit(2),1800000);
