import {app,BrowserWindow,ipcMain} from 'electron';
import fs from 'node:fs/promises';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {NativeAIService} from '../../apps/desktop/electron/ai-service';
import {NativeServices} from '../../apps/desktop/electron/native-services';
import '../../apps/desktop/electron/main';

// QA-only executable: retain the production main / preload / sender validation.
// All project data comes from the independent renderer fixture; no key is exported.
const scopedEditRetry=process.argv.includes('--scoped-edit-retry');
const creationRetry=process.argv.includes('--creation-retry');
const titleRetry=process.argv.includes('--title-retry');
const continuation=process.argv.includes('--continuation');
const plannerRecheck=process.argv.includes('--planner-recheck');
const round2=process.argv.includes('--round2'),replay=process.argv.includes('--replay-matched'),recheck=process.argv.includes('--recheck');
if((replay||recheck||plannerRecheck||continuation||titleRetry||creationRetry||scopedEditRetry)&&!round2||replay&&recheck)throw Error('Explicit round2 mode required');
const ledgerDir=path.resolve('outputs/agent-v2-7/live');
const out=round2?path.join(ledgerDir,replay?'round2-matched-replay-fixed':scopedEditRetry?'round2-scoped-edit-retry':creationRetry?'round2-creation-retry':titleRetry?'round2-title-retry':continuation?'round2-continuation':plannerRecheck?'round2-planner-recheck':recheck?'round2-recheck':'round2'):ledgerDir;
const auth=JSON.parse(readFileSync(round2?'outputs/agent-v2-7/authorization-round2.json':'outputs/agent-v2-7/authorization.json','utf8'));
if(!auth.authorized||auth.stage!=='V2-7'||auth.requests!==20||auth.inputTokens!==400000||auth.outputTokens!==40000)throw Error('Current authorization required');
const model=round2?'deepseek-v4-flash':'deepseek-flash';
const catalogOnly=process.argv.includes('--catalog-only');
if(round2&&catalogOnly)throw Error('No catalog request in round2');
if(existsSync(path.join(ledgerDir,'calls.json'))&&!catalogOnly&&!round2)throw Error('Existing ledger; never overwrite');
const caps:Record<string,number>={A:6,B:5,C:3,Matched:6,Models:1};
const calls:any[]=catalogOnly||round2?JSON.parse(readFileSync(path.join(ledgerDir,'calls.json'),'utf8')):[];
if(catalogOnly&&(calls.length!==7||calls.some(c=>c.status!==503||c.response?.error?.code!=='model_not_found')))throw Error('Catalog probe requires the original seven failed requests; no silent repeated probe');
const originalLedger=round2?readFileSync(path.join(ledgerDir,'calls-before-round2.json')):null;
if(round2&&(calls.length!==(scopedEditRetry?27:creationRetry?25:titleRetry?24:continuation?22:plannerRecheck?20:(replay||recheck)?14:8)||auth.modelID!==model||auth.roundId!=='model-correction-round2'||auth.baseRequests!==8||createHash('sha256').update(originalLedger!).digest('hex')!==auth.baseLedgerSHA256||JSON.stringify(calls.slice(0,8))!==JSON.stringify(JSON.parse(originalLedger!.toString()))||existsSync(path.join(out,'report.json'))))throw Error('Round2 requires authorized immutable eight-call baseline; no automatic replay');
const baselineCount=round2?8:calls.length,baselineJSON=JSON.stringify(calls.slice(0,baselineCount));let replayRequests=0;
const sourceReplay=plannerRecheck||continuation?calls.find(c=>c.index===17&&c.turnId==='C1'&&c.status===200):null;
const data=new Map();let caseId='',turnId='',win:BrowserWindow,active=false,stopReason:string|null=null;
const previousLiveDurationMs=scopedEditRetry?JSON.parse(readFileSync(path.join(ledgerDir,'round2-creation-retry/report.json'),'utf8')).activeLiveDurationMs:creationRetry?JSON.parse(readFileSync(path.join(ledgerDir,'round2-title-retry/report.json'),'utf8')).activeLiveDurationMs:titleRetry?JSON.parse(readFileSync(path.join(ledgerDir,'round2-planner-recheck/report.json'),'utf8')).activeLiveDurationMs:continuation?JSON.parse(readFileSync(path.join(ledgerDir,'round2-recheck/report.json'),'utf8')).activeLiveDurationMs+Date.parse(calls.at(-1).finishedAt)-Date.parse(calls[20].startedAt):plannerRecheck?JSON.parse(readFileSync(path.join(ledgerDir,'round2-recheck/report.json'),'utf8')).activeLiveDurationMs:recheck?Math.max(JSON.parse(readFileSync(path.join(ledgerDir,'round2/report.json'),'utf8')).records.reduce((sum:number,r:any)=>sum+(r.elapsedMs??0),0),Date.parse(calls[calls.length-1].finishedAt)-Date.parse(calls[8].startedAt)):0;
const start=Date.now(),sum=(rows:any[],key:string,upper:string)=>rows.reduce((s,c)=>s+(c.usage?.[key]??c[upper]),0),used=(key:string,upper:string)=>sum(calls,key,upper);
const roundCalls=()=>round2?calls.slice(baselineCount):calls;
const saveLedger=async()=>{if(round2&&JSON.stringify(calls.slice(0,baselineCount))!==baselineJSON)throw Error('Historical ledger altered');await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(ledgerDir,'calls.json'),JSON.stringify(calls,null,2)+'\n');};
let settings:any;
const originalSettings=NativeAIService.prototype.settings;
NativeAIService.prototype.settings=async function(){
  if(settings)return settings;
  const cfg=await originalSettings.call(this),p=cfg.providers.find(p=>p.enabled&&p.baseUrl===auth.authorizedEndpoint&&p.defaultModel===model);
  if(!p)throw Error('Authorized route unavailable');
  if(round2&&(cfg.routing.planning?.providerId!==p.id||cfg.routing.planning.modelId!==model))throw Error('Saved planning route does not match authorized model');
  settings={...cfg,providers:[p],defaultProviderId:p.id,routing:{general:{providerId:p.id,modelId:p.defaultModel},planning:{providerId:p.id,modelId:p.defaultModel},vision:null},agent:{...cfg.agent,planTransport:'tools',nativeSkills:false,visualVerification:false,autoApplySafe:false,streaming:false,recovery:{...cfg.agent.recovery,providerRetries:0,visualRequests:0}},privacy:{sendReferences:false,sendRenderPreview:false,saveHistory:false},failover:{enabled:false,maxRetries:0}};
  return settings;
};
const dispatch=NativeAIService.prototype.dispatch;
NativeAIService.prototype.dispatch=async function(request){
  if(request.method==='ai.settings.save'||request.method.startsWith('ai.credentials.')&&request.method!=='ai.credentials.has')throw Error('Formal settings and credentials frozen');
  if(request.method==='ai.data.read')return data.get(request.key);
  if(request.method==='ai.data.write'){data.set(request.key,JSON.parse(request.data));return;}
  const metadata=catalogOnly&&request.method==='ai.models';
  if(request.method==='ai.test'||request.method==='ai.models'&&!metadata||catalogOnly&&request.method==='ai.chat')throw Error('Only mode-specific bounded requests allowed');
  if(request.method!=='ai.chat'&&!metadata)return dispatch.call(this,request);
  if(active)throw Error('No parallel requests');active=true;
  (this as any).fetcher=async(url:any,init:any)=>{
    const approvedURL=metadata?auth.authorizedEndpoint.replace(/\/chat\/completions$/,'/models'):auth.authorizedEndpoint;
    if(!caseId||!turnId||!caps[caseId]||new URL(String(url)).href!==approvedURL)throw Error('Unauthorized route or case');
    const body=metadata?null:JSON.parse(String(init.body));
    if(metadata){if(init.method!=='GET')throw Error('Catalog must be read-only GET');}
    else{body.max_tokens=2000;body.stream=false;if(body.model!==model||body.messages.some((m:any)=>typeof m.content!=='string'))throw Error('Fixed model/text only');}
    const upper=metadata?5000:Buffer.byteLength(JSON.stringify(body),'utf8')+5000;
    if((plannerRecheck||continuation)&&caseId==='C'&&turnId==='C1'){if(!sourceReplay||replayRequests>1)throw Error('Single captured gradient response only');replayRequests++;return new Response(JSON.stringify(sourceReplay.response),{status:200,headers:{'content-type':'application/json'}});}
    if(continuation&&caseId==='B'&&turnId==='B1'){const original=calls.find(c=>c.index===22&&c.turnId==='B1'&&c.status===200);if(!original||replayRequests>1)throw Error('Captured title only');replayRequests++;return new Response(JSON.stringify(original.response),{status:200,headers:{'content-type':'application/json'}});}
    if(replay){const original=calls.find(c=>c.roundId===auth.roundId&&c.turnId===turnId&&c.status===200);if(caseId!=='Matched'||!original||replayRequests>=2)throw Error('Replay restricted to two captured matched fill responses');replayRequests++;return new Response(JSON.stringify(original.response),{status:200,headers:{'content-type':'application/json'}});}
    const rows=roundCalls();
    const exhausted=!!stopReason||rows.length>=20||rows.filter(c=>c.caseId===caseId).length>=caps[caseId]||(caseId==='Matched'&&rows.some(c=>c.turnId===turnId))||sum(rows,'inputTokens','inputUpper')+upper>400000||sum(rows,'outputTokens','outputUpper')+2000>40000||calls.length>=(round2?28:20)||used('inputTokens','inputUpper')+upper>(round2?800000:400000)||used('outputTokens','outputUpper')+2000>(round2?56000:40000)||previousLiveDurationMs+Date.now()-start>1800000;
    if(exhausted){stopReason=stopReason??'Budget or deadline exhausted BEFORE fetch';throw Error(stopReason);}
    const c:any={index:calls.length+1,...(round2?{roundId:auth.roundId,runId:scopedEditRetry?'scoped-edit-retry':creationRetry?'creation-retry':titleRetry?'title-retry':continuation?'continuation':plannerRecheck?'planner-recheck':recheck?'recheck':'initial'}:{}),caseId,turnId,kind:metadata?'model-catalog':'chat',body,inputUpper:upper,outputUpper:2000,endpoint:String(url),startedAt:new Date().toISOString()};calls.push(c);await saveLedger();console.log('REQUEST',c.index,turnId);
    try{
      const response=await fetch(url,{...init,...(metadata?{}:{body:JSON.stringify(body)}),signal:AbortSignal.any([...(init.signal?[init.signal]:[]),AbortSignal.timeout(90000)])});c.status=response.status;
      try{c.response=JSON.parse(await response.clone().text());const u=c.response.usage;if(u&&Number.isFinite(u.prompt_tokens)&&Number.isFinite(u.completion_tokens))c.usage={inputTokens:u.prompt_tokens,outputTokens:u.completion_tokens,cacheHitTokens:u.prompt_cache_hit_tokens??null,cacheMissTokens:u.prompt_cache_miss_tokens??null};}catch{c.invalidResponse=true;}
      if([401,403].includes(c.status)||['model_not_found','invalid_model','model_not_supported'].includes(c.response?.error?.code))stopReason='Shared provider authentication or model configuration rejected; stop all remaining cases';
      c.finishedAt=new Date().toISOString();await saveLedger();console.log('RESPONSE',c.index,c.status,JSON.stringify(c.usage??{unknown:true}));return response;
    }catch(e){c.error='Transport failure or timeout';await saveLedger();throw e;}
  };
  try{return await dispatch.call(this,metadata?request:{...request,request:{...request.request,stream:false,maxOutputTokens:2000}});}finally{active=false;}
};
const desktopDispatch=NativeServices.prototype.dispatch;
NativeServices.prototype.dispatch=async function(request){
  if(['recovery.write','recovery.clear','recent.add','log.error'].includes(request.method))return;
  if(request.method==='startup.read')return null;
  return desktopDispatch.call(this,request);
};
const load=BrowserWindow.prototype.loadFile;
BrowserWindow.prototype.loadFile=function(file,options){return load.call(this,path.resolve(catalogOnly?'work/agent-v2-7/catalog.html':'work/agent-v2-7/live.html'),options);};
app.on('browser-window-created',(_e,w)=>{win=w;win.webContents.setBackgroundThrottling(false);win.hide();win.on('show',()=>win.hide());win.webContents.on('console-message',(_e,...args)=>console.log('renderer',...args));});
for(const method of ['case','turn','save','progress','shot','stopped','mode','remaining','render','done'])ipcMain.handle('live:'+method,async(event,...args)=>{
  if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('QA sender denied');
  if(method==='stopped')return stopReason;
  if(method==='remaining')return caps[caseId]-roundCalls().filter(c=>c.caseId===caseId).length;
  if(method==='mode')return {replay,recheck,plannerRecheck,continuation,titleRetry,creationRetry,scopedEditRetry,scopedBaseline:scopedEditRetry?readFileSync(path.join(ledgerDir,'round2-creation-retry/A1.swayframe'),'utf8'):null,titleBaseline:titleRetry?readFileSync(path.join(ledgerDir,'round2-planner-recheck/B1.swayframe'),'utf8'):null,spentTurns:recheck||plannerRecheck?roundCalls().map(c=>c.turnId):[],replayBaseline:replay?JSON.parse(readFileSync(path.join(ledgerDir,'round2/report.json'),'utf8')).records.find((r:any)=>r.id==='M-fill-legacy-v1').baseline:null};
  if(method==='case'){if(active||!caps[args[0]])throw Error('Invalid case');caseId=args[0];return;}
  if(method==='turn'){if(active||!/^[A-Za-z0-9-]+$/.test(args[0]))throw Error('Invalid turn');turnId=args[0];return;}
  if(method==='progress'){console.log('PROGRESS',args[0]);return;}
  if(method==='render'){if(!/^[A-Za-z0-9.-]+\.png$/.test(args[0])||typeof args[1]!=='string'||!args[1].startsWith('data:image/png;base64,')||args[1].length>14000000)throw Error('Independent PNG only');await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,args[0]),Buffer.from(args[1].slice('data:image/png;base64,'.length),'base64'));return;}
  if(method==='save'||method==='shot'){if(!/^[A-Za-z0-9.-]+$/.test(args[0]))throw Error('Invalid file');await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,args[0]),method==='shot'?(await win.webContents.capturePage()).toPNG():typeof args[1]==='string'?args[1]:JSON.stringify(args[1],null,2)+'\n');return;}
  const report=args[0];report.budget={requests:calls.length,inputTokens:used('inputTokens','inputUpper'),outputTokens:used('outputTokens','outputUpper'),unknownUsage:calls.filter(c=>!c.usage).length,requestsCap:20,inputCap:400000,outputCap:40000};report.providerEndpoint=auth.authorizedEndpoint;report.modelRequested=model;report.stopReason=stopReason;report.roundId=round2?auth.roundId:'initial';report.roundBudget={requests:roundCalls().length,inputTokens:sum(roundCalls(),'inputTokens','inputUpper'),outputTokens:sum(roundCalls(),'outputTokens','outputUpper'),unknownUsage:roundCalls().filter(c=>!c.usage).length,requestsCap:20,inputCap:400000,outputCap:40000};
  if(round2){report.budget.requestsCap=28;report.budget.inputCap=800000;report.budget.outputCap=56000;report.baselinePreserved=JSON.stringify(calls.slice(0,baselineCount))===baselineJSON;}report.imagesSent=0;report.activeLiveDurationMs=previousLiveDurationMs+Date.now()-start;report.maxActiveLiveDurationMs=1800000;report.fixtureReplayRequests=replayRequests;report.scope=scopedEditRetry?'Last authorized A request: reload actual accepted three-shape Scene, select the second actual UUID in GUI, edit-only action schema; no new objects':creationRetry?'Last three authorized round2 requests for creation/fill format example; all old failures retained; fixed model and protocol':titleRetry?'One fresh B2 retry from actual saved B1 Scene; same round2 budget; no prior terminate signal':continuation?'Captured B1/C1 replayed offline; B2/B3/C2 are fresh authorized continuation requests':replay?'Captured real responses replayed offline; not fresh model validation':plannerRecheck?'Same round2 budget; compact semantic planning; C1 captured response replay and C2 fresh model continuation':recheck?'Same authorized round2 budget; historical attempts retained':'Initial live attempts';report.host='Production desktop main/preload/sender validation; frozen settings and independent EditorStore';
  await fs.writeFile(path.join(out,catalogOnly?'catalog-report.json':'report.json'),JSON.stringify(report,null,2)+'\n');await saveLedger();console.log('COMPLETE',JSON.stringify(report.budget));app.exit(report.records?.every((r:any)=>r.pass)?0:1);
});
setTimeout(()=>app.exit(2),Math.max(1,1800000-previousLiveDurationMs));
