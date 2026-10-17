import {createRoot} from 'react-dom/client';
import {App} from '../../src/ui/App';
import {EditorStore} from '../../src/ui/editor-store';
import {nativeAgentFor,createNativeAgent} from '../../src/ui/native-agent-controller';
import {coreV2For} from '../../src/ui/core-v2-controller';
import {getAIApplication} from '../../src/ai/application';
import {activeComposition,createDefaultProject,createLayer} from '../../src/core/project-model';
import {saveProject} from '../../src/core/project-io';
import {command} from '../../src/core/command-system';
import {coreExecutionTools} from '../../src/agent-v2/editor-adapter';
import {gradientColor} from '../../src/core/radial-gradient';
import {evaluateProperty} from '../../src/core/animation-engine';
import '../../src/ui/design-tokens.css';
import '../../src/ui/base.css';
import '../../src/ui/editor-theme.css';
const canonical=(value:any):string=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
let mode:any;
const api=(window as any).live,root=createRoot(document.getElementById('root')!);
const delay=(n=50)=>new Promise(r=>setTimeout(r,n));
const check=(v:unknown,m:string)=>{if(!v)throw Error(m);};
async function until(fn:()=>boolean,label:string,limit=240000){const begin=Date.now();while(Date.now()-begin<limit){if(fn())return;await delay();}throw Error('Timeout '+label);}
const button=(text:string)=>[...document.querySelectorAll<HTMLButtonElement>('.agent-v2-editor button')].find(b=>b.textContent===text);
const change=(el:HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement,value:string)=>{const p=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value')!.set!.call(el,value);el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));};
const manager=getAIApplication();
let store:EditorStore,core:ReturnType<typeof coreV2For>;
const records:any[]=[],traces:any[]=[];
const layers=(p=store.commands.getSnapshot())=>activeComposition(p).layers;
const fill=(l:any)=>l.editor?.properties.fill?evaluateProperty(l.editor.properties.fill,0):l.fill;
const near=(a:number,b:number)=>Math.abs(a-b)<.001;
const rgb=(l:any,c:number[])=>fill(l).slice(0,3).every((x:number,i:number)=>near(x,c[i]!));
async function mount(id:string,s=new EditorStore(createDefaultProject()),choice:'core-v2'|'legacy-v1'='core-v2',native?:ReturnType<typeof createNativeAgent>){
  store=s;localStorage.setItem('motion.active-left','助手');
  core=coreV2For(store,manager,native?.agent??nativeAgentFor(store));
  root.render(<div key={id} data-case={id} style={{height:'100%'}}><App store={store}/></div>);
  await until(()=>!!document.querySelector(`[data-case="${id}"] [aria-label="Agent 引擎"]`),'App mount',12000);
  if(choice==='core-v2'){change(document.querySelector('[aria-label="Agent 引擎"]')!,'core-v2');await until(()=>!!document.querySelector('[aria-label="V2 Agent 需求"]'),'Beta choice',12000);}
}
async function send(id:string,goal:string,verify:(p:any)=>void){
  if(await api.remaining()<=0){records.push({id,goal,pass:false,status:'NOT_RUN',error:'Case request cap reached BEFORE send',formalSceneUnchanged:true});await api.save('records.json',records);await api.progress(id+' NOT_RUN case cap');return false;}
  await api.turn(id);
  const before=saveProject(store.commands.getSnapshot()),start=performance.now();
  let error:string|null=null,committed=false,draftValid=false;
  try{
    change(document.querySelector('[aria-label="V2 Agent 需求"]')!,goal);await until(()=>!!button('发送')&&!button('发送')!.disabled,'Send ready '+id,15000);button('发送')!.click();
    await until(()=>core.pending||(!core.running&&(!!core.error||['FAILED','CANCELLED'].includes(core.state?.phase??''))),id);
    check(core.pending,id+': '+core.error+' '+JSON.stringify(core.state?.errors));
    check(saveProject(store.commands.getSnapshot())===before,'Formal scene changed before acceptance');
    const draft=(core.runtime as any).adapter.snapshot();verify(draft);draftValid=true;
    check(core.state?.preview?.foregroundPixels && core.state.preview.image.startsWith('data:image/png'),'Actual preview rendering missing');
    await api.render(id+'-draft.png',core.state!.preview!.image);
    button('接受修改')!.click();await until(()=>core.state?.phase==='COMPLETED','Accept',12000);verify(store.commands.getSnapshot());committed=true;
    await api.save(id+'.swayframe',saveProject(store.commands.getSnapshot()));
  }catch(e){error=String(e);if(core.pending)core.reject();if(core.running)core.cancel();check(saveProject(store.commands.getSnapshot())===before,'Unexpected formal write on failed task');}
  const trace=JSON.parse(core.diagnostic());traces.push({id,...trace});
  const row={id,goal,responseOrigin:(mode.plannerRecheck||mode.continuation)&&id==='C1'||mode.continuation&&id==='B1'?'captured-response-offline-replay':'fresh-live-attempt',pass:committed,draftValid,error,elapsedMs:Math.round(performance.now()-start),phase:core.state?.phase??'PREFLIGHT_FAILED',modelRequests:core.state?.modelRequests??0,actionAttempts:core.state?.actionAttempts??0,recoveryAttempts:core.state?.recoveryAttempts??0,layerIds:layers().map(l=>l.id),inputRetained:committed?null:(document.querySelector('[aria-label="V2 Agent 需求"]') as HTMLTextAreaElement)?.value===goal};
  records.push(row);await api.save('records.json',records);await api.save('traces.json',traces);await api.progress(id+' '+(row.pass?'PASS':'FAIL')+' '+(error??''));return committed;
}
async function sessionA(){
  await api.case('A');await mount('A');
  if(!await send('A1','创建三个矩形，按创建顺序填充红色、绿色、蓝色。每个宽240、高200，位置依次为(400,540)、(800,540)、(1200,540)。',p=>{const ls=layers(p);check(ls.length===3&&ls.every(l=>l.type==='shape'&&l.shapeKind==='rectangle'),'three rectangles');ls.forEach((l,i)=>{check(rgb(l,[[1,0,0],[0,1,0],[0,0,1]][i]!), 'creation order RGB');check(l.width===240&&l.height===200,'dimensions');const pos=evaluateProperty(l.transform.position,0);check(pos.x===[400,800,1200][i]&&pos.y===540,'rectangle initial position');});}))return;
  const ids=layers().map(l=>l.id),first=JSON.stringify(layers()[0]),third=JSON.stringify(layers()[2]);
  if(!await send('A2','把第二个矩形改为紫色，RGB为(0.5,0,0.5)，保持另外两个矩形不变。',p=>{const ls=layers(p);check(ls.length===3&&ls.map(l=>l.id).join()===ids.join(),'stable IDs');check(rgb(ls[1],[.5,0,.5]),'second purple');check(JSON.stringify(ls[0])===first&&JSON.stringify(ls[2])===third,'non-target unchanged');}))return;
  const beforeAnim=saveProject(store.commands.getSnapshot());
  if(!await send('A3','给第二个矩形添加位置动画：0秒位置(800,540)，2秒位置(1000,540)，线性插值。不要新建图层。',p=>{const ls=layers(p),k=ls[1]!.transform.position.keyframes;check(ls.length===3&&ls[1]!.id===ids[1]&&k.length===2,'two keyframes correct target');check(k.some(x=>x.time===0&&x.value.x===800&&x.value.y===540&&x.interpolation==='linear')&&k.some(x=>x.time===2&&x.value.x===1000&&x.value.y===540&&x.interpolation==='linear'),'animation endpoint values');check(JSON.stringify(ls[0])===first&&JSON.stringify(ls[2])===third,'animation protected objects');}))return;
  const afterAnim=saveProject(store.commands.getSnapshot());store.undo();check(saveProject(store.commands.getSnapshot())===beforeAnim,'Undo animation');store.redo();check(saveProject(store.commands.getSnapshot())===afterAnim,'Redo same animation IDs');
  store.setTime(1);
  await send('A4','把第三个矩形移到合成中心(960,540)，保持其他图层及动画不变。',p=>{const ls=layers(p);check(ls.length===3&&ls[2]!.id===ids[2],'third identity');const pos=evaluateProperty(ls[2]!.transform.position,1);check(pos.x===960&&pos.y===540,'center');check(ls[1]!.transform.position.keyframes.length===2&&rgb(ls[1],[.5,0,.5]),'earlier edits retained');});
}
async function sessionB(){
  await api.case('B');await mount('B');
  if(!await send('B1','创建一个文字标题，内容为Cubic，放在合成中心(960,540)，不要添加其他图层。',p=>check(layers(p).length===1&&layers(p)[0]!.type==='text'&&(layers(p)[0] as any).text==='Cubic'&&evaluateProperty(layers(p)[0]!.transform.position,0).x===960&&evaluateProperty(layers(p)[0]!.transform.position,0).y===540,'Cubic title')))return;
  const id=layers()[0]!.id;
  if(!await send('B2','把标题字体改为serif、字号改为96、颜色改为白色、位置改为(960,500)，不要新建文字。',p=>{const l=layers(p)[0] as any;check(layers(p).length===1&&l.id===id&&l.fontFamily==='serif','font and identity');check(evaluateProperty(l.editor.properties.fontSize,0)===96&&rgb(l,[1,1,1]),'font size/color');const pos=evaluateProperty(l.transform.position,0);check(pos.x===960&&pos.y===500,'title position');}))return;
  const titleBeforeSubtitle=JSON.stringify(layers()[0]);
  if(!await send('B3','添加一个中文副标题，内容为立方渐变，位置(960,640)，颜色白色，字号32。保持Cubic标题不变。',p=>{const ls=layers(p);check(ls.length===2&&(ls[1] as any).text==='立方渐变'&&ls[0]!.id===id,'subtitle and prior identity');const sub=ls[1] as any,pos=evaluateProperty(sub.transform.position,0);check(pos.x===960&&pos.y===640&&rgb(sub,[1,1,1])&&evaluateProperty(sub.editor.properties.fontSize,0)===32,'subtitle styling');check(JSON.stringify(ls[0])===titleBeforeSubtitle,'title unchanged');}))return;
  const sub=JSON.stringify(layers()[1]);
  await send('B4','给标题添加透明度动画，0秒为0、2秒为1，线性插值。保持副标题不变。',p=>{const ls=layers(p),k=ls[0]!.transform.opacity.keyframes;check(ls.length===2&&ls[0]!.id===id&&k.length===2,'title animation');check(k.some(x=>x.time===0&&x.value===0&&x.interpolation==='linear')&&k.some(x=>x.time===2&&x.value===1&&x.interpolation==='linear'),'opacity values');check(JSON.stringify(ls[1])===sub,'subtitle preserved');});
}
async function sessionC(){
  await api.case('C');await mount('C');
  if(!await send('C1','创建一个矩形渐变背景，宽1400、高800，位置(960,540)。使用径向渐变，中心蓝色RGB(0,0,1)，边缘白色RGB(1,1,1)。',p=>{const ls=layers(p);check(ls.length===1&&ls[0]!.editor?.gradient==='radial','gradient created');const l=ls[0]!,pos=evaluateProperty(l.transform.position,0);check(l.width===1400&&l.height===800&&pos.x===960&&pos.y===540,'gradient dimensions/position');const stops=evaluateProperty(l.editor!.properties.radial_stops!,0) as readonly number[];check(canonical(gradientColor(stops,0))===canonical([0,0,1,1])&&canonical(gradientColor(stops,1))===canonical([1,1,1,1]),'authoritative radial colors');}))return;
  const id=layers()[0]!.id;store.select(id);await delay(150);
  const x=document.querySelector<HTMLInputElement>('.inspector-panel [aria-label="位置 X"]');check(x,'GUI X input');x!.focus();change(x!,'500');await delay();x!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await delay(100);check(layers()[0]!.transform.position.baseValue.x===500,'GUI edit applied');
  const guiY=evaluateProperty(layers()[0]!.transform.position,0).y,gradientEnd=JSON.stringify(layers()[0]!.editor?.properties.gradientEnd),gradientFill=JSON.stringify(layers()[0]!.editor?.properties.fill),radialState=canonical(Object.fromEntries(Object.entries(layers()[0]!.editor!.properties).filter(([k])=>k.startsWith('radial_'))));
  await send('C2','把刚才手动移动的图层继续向右移动100，保持Y位置和渐变不变，不要新建图层。',p=>{const ls=layers(p);check(ls.length===1&&ls[0]!.id===id,'GUI same identity');check(ls[0]!.transform.position.baseValue.x===600&&ls[0]!.editor?.gradient==='radial','uses latest GUI value');check(evaluateProperty(ls[0]!.transform.position,0).y===guiY&&JSON.stringify(ls[0]!.editor?.properties.gradientEnd)===gradientEnd&&JSON.stringify(ls[0]!.editor?.properties.fill)===gradientFill,'GUI Y/gradient preserved');check(canonical(Object.fromEntries(Object.entries(ls[0]!.editor!.properties).filter(([k])=>k.startsWith('radial_'))))===radialState,'authoritative gradient properties preserved');});
}
async function matched(){
  await api.case('Matched');
  for(const kind of (mode.replay?['fill']:['fill','dimensions','font']) as ('fill'|'dimensions'|'font')[]){
    const target=createLayer(kind==='font'?'text':'rectangle'),protectedLayer=createLayer('ellipse');
    const baseStore=new EditorStore(createDefaultProject()),comp=baseStore.commands.getSnapshot().activeCompositionId;
    baseStore.run('独立对照工程',[command({type:'layer.create',compositionId:comp,layer:target}),command({type:'layer.create',compositionId:comp,layer:protectedLayer})]);
    const baseline=mode.replay?mode.replayBaseline:saveProject(baseStore.commands.getSnapshot());
    const baselineLayers=JSON.parse(baseline).compositions[0].layers;
    const targetId=mode.replay?baselineLayers[0].id:target.id,protectedId=mode.replay?baselineLayers[1].id:protectedLayer.id;
    const protectedState=baselineLayers.find((l:any)=>l.id===protectedId);
    const goal=kind==='fill'?'把当前选中图层改为纯蓝色RGB(0,0,1)，保持其他图层不变。':kind==='dimensions'?'把当前选中图层宽度改为300、高度改为180，保持其他图层不变。':'把当前选中文字字体改为serif，保持其他图层不变。';
    const verify=(p:any)=>{const ls=layers(p),t=ls.find(l=>l.id===targetId) as any;check(ls.length===2&&canonical(ls.find(l=>l.id===protectedId))===canonical(protectedState),'protected object');check(t,'target retained');if(kind==='fill')check(rgb(t,[0,0,1]),'blue fill');else if(kind==='dimensions')check(t.width===300&&t.height===180,'width/height');else check(t.fontFamily==='serif','serif font');};
    for(const engine of ['legacy-v1','core-v2'] as const){
      if(await api.stopped())return;
      const id='M-'+kind+'-'+engine;if(mode.spentTurns.includes(id))continue;const s=new EditorStore(createDefaultProject());check(s.load(baseline),'matched baseline');s.select(targetId);
      const native=createNativeAgent(s,manager);const catalog=native.registry.catalog.bind(native.registry);
      native.registry.catalog=()=>catalog().filter(t=>t.permission==='READ'||(coreExecutionTools as readonly string[]).includes(t.name));
      let ownedDraft:any;const begin=native.runtime.begin.bind(native.runtime);native.runtime.begin=(...args)=>{const tx=begin(...args);ownedDraft=tx;const execute=tx.execute.bind(tx);tx.execute=(name,...rest)=>{if(!(coreExecutionTools as readonly string[]).includes(name))throw Error('Matched subset write denied');return execute(name,...rest);};return tx;};
      await mount(id,s,engine,native);
      if(engine==='core-v2'){await send(id,goal,verify);continue;}
      const started=performance.now();let error:string|null=null,pass=false;
      try{
        await api.turn(id);
        await native.agent.run(goal);let state=native.agent.getSnapshot();
        if(state.pendingConfirmation&&state.currentPlan){await native.agent.preview(state.currentPlan.id);state=native.agent.getSnapshot();if(state.pendingConfirmation&&state.currentPlan){check(ownedDraft,'Actual V1 transaction draft');verify(ownedDraft.getSnapshot());await native.agent.apply(state.currentPlan.id);}}
        state=native.agent.getSnapshot();check(state.status==='completed',state.error??'V1 incomplete');verify(s.commands.getSnapshot());pass=true;await api.save(id+'.swayframe',saveProject(s.commands.getSnapshot()));
      }catch(e){error=String(e);native.agent.stop();check(saveProject(s.commands.getSnapshot())===baseline,'V1 failed formal write');}
      records.push({id,goal,pass,error,elapsedMs:Math.round(performance.now()-started),baseline,engine,matchedWriteTools:13});await api.save('records.json',records);await api.progress(id+' '+(pass?'PASS':'FAIL')+' '+(error??''));
    }
  }
}
async function titleRetry(){
  await api.case('B');const s=new EditorStore(createDefaultProject());check(s.load(mode.titleBaseline),'Actual saved title Scene');await mount('B2-retry',s);
  const id=layers()[0]!.id;
  await send('B2-retry','把标题字体改为serif、字号改为96、颜色改为白色、位置改为(960,500)，不要新建文字。',p=>{const ls=layers(p),l=ls[0] as any;check(ls.length===1&&l.id===id&&l.type==='text'&&l.text==='Cubic'&&l.fontFamily==='serif','same actual text and font');check(evaluateProperty(l.editor.properties.fontSize,0)===96&&rgb(l,[1,1,1]),'font size/color');const pos=evaluateProperty(l.transform.position,0);check(pos.x===960&&pos.y===500,'title position');});
}
async function scopedEditRetry(){
  await api.case('A');const s=new EditorStore(createDefaultProject());check(s.load(mode.scopedBaseline),'Actual accepted three-shape Scene');const before=activeComposition(s.commands.getSnapshot()).layers;check(before.length===3,'Three original objects');const id=before[1]!.id;s.select(id);await mount('A-edit-scope',s);
  await send('A2-scoped-retry','把当前选中的第二个绿色矩形改为紫色，RGB为(0.5,0,0.5)。保持三个图层的ID、尺寸、位置和另外两个矩形不变，不要创建任何图层。',p=>{const ls=layers(p);check(ls.length===3&&ls.map(l=>l.id).join()===before.map(l=>l.id).join(),'Actual IDs unchanged');check(rgb(ls[1],[.5,0,.5]),'Second purple');check(canonical(ls[0])===canonical(before[0])&&canonical(ls[2])===canonical(before[2]),'Non-target objects unchanged');check(ls[1]!.width===before[1]!.width&&ls[1]!.height===before[1]!.height&&canonical(ls[1]!.transform)===canonical(before[1]!.transform),'Dimensions/transform unchanged');});
}
async function main(){
  mode=await api.mode();
  await until(()=>manager.getSnapshot().ready,'Manager ready',12000);
  for(const fn of (mode.replay?[matched]:mode.scopedEditRetry?[scopedEditRetry]:mode.creationRetry?[sessionA]:mode.titleRetry?[titleRetry]:mode.continuation?[sessionB,sessionC]:mode.plannerRecheck?[sessionA,sessionB,sessionC]:[sessionA,sessionB,sessionC,matched])){if(await api.stopped())break;try{await fn();}catch(e){records.push({id:fn.name,pass:false,error:String(e)});await api.progress(fn.name+' FAIL '+String(e));}}
  await api.done({version:'1.0.3',records,traces,defaultRuntime:'legacy-v1',engine:'Actual editor V2 Beta for A/B/C; same matched 13 WRITE subset for V1/V2',automaticFormalWrites:false});
}
void main().catch(async e=>api.done({version:'1.0.3',records,traces,error:String(e)}));
