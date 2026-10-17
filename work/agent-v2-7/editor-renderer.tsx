import { createRoot } from 'react-dom/client';
import { App } from '../../src/ui/App';
import { EditorStore } from '../../src/ui/editor-store';
import { nativeAgentFor } from '../../src/ui/native-agent-controller';
import { coreV2For } from '../../src/ui/core-v2-controller';
import { getAIApplication } from '../../src/ai/application';
import { activeComposition, createDefaultProject } from '../../src/core/project-model';
import { saveProject } from '../../src/core/project-io';
import { command } from '../../src/core/command-system';
import { validateIntent } from '../../src/agent-v2/planner';
import { AgentSnapshotRenderer } from '../../src/agent/vision';
import { modelUnavailableMessage } from '../../src/ai/provider-diagnostics';
import '../../src/ui/design-tokens.css';
import '../../src/ui/base.css';
import '../../src/ui/editor-theme.css';
const api = (window as any).fixture, root = createRoot(document.getElementById('root')!);
const delay = (n = 40) => new Promise(r => setTimeout(r, n));
const check = (v: unknown, message: string) => { if (!v) throw Error(message); };
async function until(fn: () => boolean, label: string) { for (let i = 0; i < 300; i++) { if (fn()) return; await delay(); } throw Error(label + ': ' + document.querySelector('.agent-v2-editor')?.textContent); }
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('.agent-v2-editor button')].find(b => b.textContent === text);
const change = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
};
const ex = (id: string) => ({ kind: 'existing', id }), res = (actionId: string) => ({ kind: 'result', actionId });
const color = (r: number, g: number, b: number) => ({ r, g, b, a: 1 });
let store: EditorStore, core: ReturnType<typeof coreV2For>;
const layers = () => activeComposition(store.commands.getSnapshot()).layers;
const records: any[] = [], traces: any[] = [];
async function fresh(id: string) {
  localStorage.setItem('motion.active-left', '助手');
  store = new EditorStore(createDefaultProject());
  root.render(<div key={id} data-case={id} style={{height:'100%'}}><App store={store} /></div>);
  await until(() => !!document.querySelector(`[data-case="${id}"] [aria-label="Agent 引擎"]`), 'real App mount');
  core = coreV2For(store, getAIApplication(), nativeAgentFor(store));
  check(document.querySelector('.agent-heading')?.textContent?.includes('Legacy V1'), 'must default V1');
  change(document.querySelector('[aria-label="Agent 引擎"]')!, 'core-v2');
  await until(() => !!document.querySelector('[aria-label="V2 Agent 需求"]'), 'explicit Beta');
}
async function send(request: string, actions?: any[], accept = true) {
  if (actions) await api.enqueue(validateIntent({ goal: 'Offline V2-7 fixture', actions }));
  change(document.querySelector('[aria-label="V2 Agent 需求"]')!, request); await delay();
  button('发送')!.click();
  await until(() => core.pending || (!core.running && !!core.error) || core.state?.phase === 'FAILED', request);
  check(core.pending, request + ': ' + JSON.stringify(core.state?.errors) + core.error);
  check(core.state?.preview?.foregroundPixels && core.state.preview.image.startsWith('data:image/png'), 'real renderer pixels');
  if (accept) { button('接受修改')!.click(); await until(() => core.state?.phase === 'COMPLETED', 'actual UI Accept'); }
  traces.push(JSON.parse(core.diagnostic()));
}
async function stale(request: string) {
  const before = saveProject(store.commands.getSnapshot());
  change(document.querySelector('[aria-label="V2 Agent 需求"]')!, request); await delay(); button('发送')!.click();
  await until(() => !!core.error && !core.running, 'stale reference');
  check(/删除|撤销|不存在|不能确定|没有/.test(core.error), 'explicit invalid reference: ' + core.error);
  check(saveProject(store.commands.getSnapshot()) === before, 'stale request must not mutate');
  check((document.querySelector('[aria-label="V2 Agent 需求"]') as HTMLTextAreaElement).value === request, 'failed input retained');
}
async function main() {
  try {
    const manager = getAIApplication(); await until(() => manager.getSnapshot().ready, 'AI fixture ready');
    if(await api.errorMode()){
      await fresh('model-error');
      change(document.querySelector('[aria-label="V2 Agent 需求"]')!,'创建矩形');await delay();button('发送')!.click();
      await until(()=>core.state?.phase==='FAILED','model missing replay');
      check(document.querySelector('.agent-v2-editor [role="alert"]')?.textContent?.includes(modelUnavailableMessage),'actionable model guidance');
      check((document.querySelector('[aria-label="V2 Agent 需求"]') as HTMLTextAreaElement).value==='创建矩形','input retained');
      check(layers().length===0&&store.commands.undoStack.length===0&&!button('接受修改'),'formal scene unchanged');
      check(core.state?.errors[0]?.recoverable===false&&core.state?.providerRetries===0,'no pointless provider retry');
      for(const [w,h]of [[1280,720],[1440,900],[1920,1080],[2560,1440]])await api.shot(w,h,'model-error');
      await api.done({pass:true,scope:'OFFLINE replay of observed model_not_found / HTTP503; actual App/AgentPanel, no credentials or network; not real model success',inputRetained:true,formalSceneUnchanged:true,providerRetries:0,traces:[JSON.parse(core.diagnostic())]});return;
    }
    if(await api.mode()) {
      await fresh('restart'); check(store.load(await api.loadSaved()),'new process loads disk project');
      const title=layers().find(l=>l.type==='text')!; check(title,'saved title'); const id=title.id;
      await send('把标题透明度改成0.6',[{id:'o',type:'setProperty',target:ex(id),property:'opacity',value:.6}]);
      check(layers().find(l=>l.id===id)?.transform.opacity.baseValue===.6,'new process same identity');
      check(layers().length===2,'no duplication after process restart');
      await api.shot(1440,900,'restarted');
      await api.done({pass:true,scope:'Actual second Electron process / new ephemeral profile / disk reload / offline provider fixture',identity:id,restartContinued:true,inFlightResume:'NOT SUPPORTED',traces}); return;
    }
    await fresh('S1');
    await send('创建三个不同颜色的矩形', [0,1,2].flatMap(n => [{ id: 'r'+n, type: 'createShape', shape: 'rectangle', position: { x: 400+n*400, y: 540 }, width: 240, height: 200 }, { id: 'f'+n, type: 'setFill', target: res('r'+n), color: color(n===0?1:0,n===1?1:0,n===2?1:0) }]), false);
    check(layers().length === 0, 'draft isolation');
    for (const [w,h] of [[1280,720],[1440,900],[1920,1080],[2560,1440]]) await api.shot(w,h,'pending');
    button('接受修改')!.click(); await delay();
    const ids = layers().map(l=>l.id);
    await send('把第二个矩形改为紫色',[{id:'f',type:'setFill',target:ex(ids[1]!),color:color(.5,0,.5)}]);
    await send('给第二个矩形添加位置动画',[0,2].map(time=>({id:'k'+time,type:'addKeyframe',target:ex(ids[1]!),property:'position',time,value:{x:800+time*100,y:540}})));
    await send('把第三个矩形移到中心',[{id:'p',type:'setProperty',target:ex(ids[2]!),property:'position',value:{x:960,y:540}}]);
    store.setTime(1);
    await send('修改第一个矩形宽高',[{id:'d',type:'setDimensions',target:ex(ids[0]!),width:300,height:180}]);
    check(layers().length===3 && layers()[0]!.width===300 && layers()[1]!.transform.position.keyframes.length===2, 'S1 scene');
    const saved = saveProject(store.commands.getSnapshot()); store.undo(); store.redo(); check(saveProject(store.commands.getSnapshot())===saved,'S1 undo redo');
    const pixels = await new AgentSnapshotRenderer().render(store.commands.getSnapshot(),1,new AbortController().signal,undefined,undefined,true); check(pixels.pixelEvidence!.foregroundPixels>0,'animation renderer');
    records.push({id:'S1',pass:true,acceptedTurns:5,layers:3,animationPixels:pixels.pixelEvidence});
    await api.shot(1440,900,'completed');
    await fresh('S2'); await send('创建Cubic标题',[{id:'t',type:'createText',content:'Cubic',position:{x:960,y:540}}]); const title=layers()[0]!.id;
    await send('修改标题字体和字号',[{id:'f',type:'setFont',target:ex(title),fontFamily:'serif'},{id:'s',type:'setProperty',target:ex(title),property:'fontSize',value:96}]);
    await send('添加中文副标题',[{id:'sub',type:'createText',content:'立方渐变',position:{x:960,y:640}}]);
    await send('移动标题',[{id:'p',type:'setProperty',target:ex(title),property:'position',value:{x:960,y:500}}]);
    await send('修改标题透明度',[{id:'o',type:'setProperty',target:ex(title),property:'opacity',value:.7}]);
    check(layers().length===2 && layers()[0]!.id===title && layers()[0]!.type==='text' && layers()[0]!.editor?.properties.fontSize?.baseValue===96,'S2 title identity'); records.push({id:'S2',pass:true,acceptedTurns:5});
    await fresh('S3'); await send('创建矩形',[{id:'r',type:'createShape',shape:'rectangle',position:{x:400,y:500}}]); const gui=layers()[0]!; store.select(gui.id); await delay(150);
    const x=document.querySelector<HTMLInputElement>('.inspector-panel [aria-label="位置 X"]'); check(x,'actual inspector position field'); x!.focus(); change(x!,'500'); await delay(); x!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); await delay(100);
    check(layers()[0]!.transform.position.baseValue.x===500,'actual GUI field commits');
    const y=layers()[0]!.transform.position.baseValue.y;
    await send('把刚才移动的图层继续向右移动',[{id:'p',type:'setProperty',target:ex(gui.id),property:'position',value:{x:800,y}}]);
    await send('把当前选中图层透明度改为0.5',[{id:'o',type:'setProperty',target:{kind:'selection'},property:'opacity',value:.5}]);
    check(layers()[0]!.transform.position.baseValue.x===800,'GUI followed by Agent'); records.push({id:'S3',pass:true,acceptedTurns:3,actualInspectorInput:true});
    await fresh('S4'); await send('创建矩形',[{id:'r',type:'createShape',shape:'rectangle'}]); store.select(layers()[0]!.id); store.run('删除图层',[command({type:'layer.delete',compositionId:store.commands.getSnapshot().activeCompositionId,layerId:layers()[0]!.id})]); await stale('把刚才的矩形改成蓝色'); check(layers().length===0,'no recreation'); records.push({id:'S4',pass:true,acceptedTurns:1,invalidReferenceStopped:true});
    await fresh('S5'); await send('创建渐变背景矩形',[{id:'r',type:'createShape',shape:'rectangle',width:1400,height:800,position:{x:960,y:540}},{id:'g',type:'setFill',target:res('r'),color:color(0,0,1),gradient:'radial'}]);
    await send('添加标题',[{id:'t',type:'createText',content:'Cubic',position:{x:960,y:540}}]); const anim=layers()[1]!.id;
    await send('给标题添加透明度动画',[0,2].map(time=>({id:'k'+time,type:'addKeyframe',target:ex(anim),property:'opacity',time,value:time?1:0})));
    await send('撤销刚才的动画，保留渐变'); check(layers()[0]!.editor?.gradient==='radial' && layers()[1]!.transform.opacity.keyframes.length===0,'S5 precise inverse'); store.undo(); check(layers()[1]!.transform.opacity.keyframes.length===2,'inverse itself undoable'); store.redo(); records.push({id:'S5',pass:true,acceptedTurns:4,newInverseTransaction:true});
    const disk = await api.save(saveProject(store.commands.getSnapshot())); check(store.load(disk),'real file save/load'); const reloadID=layers()[1]!.id; core.newSession();
    await send('把标题改成白色',[{id:'f',type:'setFill',target:ex(reloadID),color:color(1,1,1)}]); check(layers()[1]!.id===reloadID,'reload identity'); records.push({id:'S6',pass:true,acceptedTurns:1,fileReload:true,newSession:true});
    await fresh('S7'); await send('创建标题',[{id:'t',type:'createText',content:'Rejected'}],false); button('拒绝草稿')!.click(); await delay(); await stale('把刚才的标题改为蓝色'); check(layers().length===0 && core.session.references.length===0,'rejected draft not referenced'); records.push({id:'S7',pass:true,acceptedTurns:0,rejectedDraftSafe:true});
    await fresh('S8'); await send('创建矩形',[{id:'r',type:'createShape',shape:'rectangle'}]); await send('再创建矩形',[{id:'r',type:'createShape',shape:'rectangle',position:{x:1200,y:540}}]); const undone=layers()[1]!.id; store.undo(); await stale('把第二个矩形改成蓝色'); store.redo();
    await send('把第二个矩形改成蓝色',[{id:'f',type:'setFill',target:ex(undone),color:color(0,0,1)}]); check(layers()[1]!.id===undone,'Undo tombstone / Redo same identity'); records.push({id:'S8',pass:true,acceptedTurns:3});
    await api.done({pass:true,scope:'OFFLINE fixture transport only; actual App/AgentPanel/EditorStore/TaskRuntime/Commands/Renderer; no real LLM evidence',records,traces});
  } catch(e) { await api.done({pass:false,error:String(e),records,traces,body:document.querySelector('.agent-v2-editor')?.textContent}); }
}
void main();
