import { createRoot } from 'react-dom/client';
import { App } from '../../src/ui/App';
import { EditorStore } from '../../src/ui/editor-store';
import { activeComposition, createDefaultProject } from '../../src/core/project-model';
import { evaluateProperty } from '../../src/core/animation-engine';
import { createRenderSnapshot } from '../../src/core/renderer-core';
import { OutputFrameRenderer } from '../../src/renderers/output-frame';
import { defaultOutputSettings } from '../../src/core/output-settings';
import '../../src/ui/design-tokens.css';import '../../src/ui/base.css';import '../../src/ui/editor-theme.css';
const qa=(window as any).sfUnselectedAgent, records:any[]=[];let current='startup';
const pause=(ms=50)=>new Promise(r=>setTimeout(r,ms));const check=(v:unknown,m:string)=>{if(!v)throw Error(m)};
async function main(){
 await qa.call('init');localStorage.clear();localStorage.setItem('motion.canvas-snap','false');await qa.call('viewport',1440,900);
 const store=new EditorStore(createDefaultProject());createRoot(document.getElementById('root')!).render(<App store={store}/>);await pause(400);
 const mouse=async(type:string,x:number,y:number,clickCount=1)=>{await qa.call('mouse',{type,x,y,button:type==='mouseMoved'?'none':'left',buttons:type==='mouseReleased'?0:1,modifiers:0,clickCount:type==='mouseMoved'?0:clickCount});await pause()};
 const click=async(el:Element)=>{check(!!el,'Missing click target');const r=el.getBoundingClientRect();await mouse('mousePressed',r.x+r.width/2,r.y+r.height/2);await mouse('mouseReleased',r.x+r.width/2,r.y+r.height/2)};
 const button=(name:string)=>{const b=[...document.querySelectorAll('button')].find(e=>(e.getAttribute('aria-label')===name||e.textContent?.trim()===name)&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0);check(b,'Missing button '+name);return b!;};
 const key=async(k:string,code=k)=>{await qa.call('key',{type:'keyDown',key:k,code});await qa.call('key',{type:'keyUp',key:k,code});await pause()};
 const input=async(name:string,value:string)=>{const el=document.querySelector(`input[aria-label="${name}"]`) as HTMLInputElement;check(el,'Missing input '+name);await click(el);el.select();await qa.call('text',value);await key('Enter');await pause()};
 const test=async(id:string,f:()=>Promise<void>)=>{current=id;await f();records.push({id,pass:true});await qa.call('capture',id)};
 let trusted=false;document.addEventListener('pointerdown',e=>{trusted ||=e.isTrusted;},true);
 await test('GUI-create-two-position-keyframes',async()=>{
  await click(button('矩形工具'));const canvas=document.querySelector('canvas[aria-label="合成画布"]')!;const r=canvas.getBoundingClientRect();const pt=(x:number,y:number)=>({x:r.left+x*r.width/1920,y:r.top+y*r.height/1080});
  let p=pt(400,300);await mouse('mousePressed',p.x,p.y);p=pt(500,400);await mouse('mouseMoved',p.x,p.y);await mouse('mouseReleased',p.x,p.y);await click(button('选择工具'));
  check(activeComposition(store.commands.getSnapshot()).layers.length===1,'GUI creation failed');
  await click(button('解除位置 X/Y 链接'));await click(button('开启位置动画'));store.setTime(2);await pause();await input('位置 X','1200');
  const l=activeComposition(store.commands.getSnapshot()).layers[0]!;check(l.transform.position.keyframes.length===2,'Expected two position frames');check((l.transform.position.keyframes[1]!.value as any).x===1200,'GUI value edit failed');
 });
 const layer=()=>activeComposition(store.commands.getSnapshot()).layers[0]!;
 const prop=()=>layer().transform.position;
 let before='',after='';
 await test('GUI-draw-accelerating-curve-one-transaction',async()=>{
  store.selectProperties([prop().id]);await click(button('曲线编辑器'));await pause(200);await click(button('手绘速度'));await pause();
  const svg=document.querySelector('svg[aria-label="手绘相对速度曲线"]')!;check(svg,'No native Draw UI');before=store.save();const n=store.commands.undoStack.length,r=svg.getBoundingClientRect();
  const pt=(u:number,v:number)=>({x:r.x+(50+580*u)/680*r.width,y:r.y+(235-205*v/2)/280*r.height});
  let p=pt(0,0);await mouse('mousePressed',p.x,p.y);
  for(let i=1;i<20;i++){p=pt(i/20,i/10);await mouse('mouseMoved',p.x,p.y);}
  check(store.save()===before,'Draft mutated Scene before release');p=pt(1,2);await mouse('mouseReleased',p.x,p.y);
  check(prop().keyframes[0]!.interpolation.type==='custom-speed','Draw mode did not reach native frames');check(store.commands.undoStack.length===n+1,'Gesture did not create one history entry');
  const a=prop().keyframes[0]!.value,b=prop().keyframes[1]!.value,m=evaluateProperty(prop(),1);check(Math.abs(m.x-(a.x+(b.x-a.x)*.25))<3,'Not accelerating integral '+JSON.stringify(m));after=store.save();
 });
 await test('GUI-play-Undo-Redo-file-save-reopen-play',async()=>{
  store.setTime(.1);store.setPlaying(true);await pause(220);check(store.getSnapshot().time>.1,'Shared clock did not play');store.setPlaying(false);
  await click(document.querySelector('.file-actions button[aria-label="撤销"]')!);check(store.save()===before,'GUI Undo mismatch: '+JSON.stringify({undo:store.commands.undoStack.map(x=>x.transaction.label),redo:store.commands.redoStack.map(x=>x.transaction.label),current:prop().keyframes[0]?.interpolation}));await click(document.querySelector('.file-actions button[aria-label="重做"]')!);check(store.save()===after,'GUI Redo mismatch');
  await qa.call('project-write',after);check(store.load(await qa.call('project-read')),'File reload failed');check(store.save()===after,'Saved interpolation changed');store.select(layer().id);store.selectProperties([prop().id]);await pause();
  store.setTime(.1);store.setPlaying(true);await pause(220);check(store.getSnapshot().time>.1,'Reload playback failed');store.setPlaying(false);
 });
 await test('real-Renderer-two-frames-and-reload-pixel-equivalence',async()=>{
  const project=store.commands.getSnapshot(),c=activeComposition(project),render=new OutputFrameRenderer(project,c,defaultOutputSettings(c));await render.init();
  const pixels:Uint8ClampedArray[]=[];for(const t of [0,1,2]){const canvas=await render.draw(t),ctx=canvas.getContext('2d')!,v=evaluateProperty(prop(),t);const at=ctx.getImageData(Math.round(v.x+20),Math.round(v.y+20),1,1).data;check(at[2]!>at[0]!+80,'Shape absent at evaluated position '+t+' '+at);pixels.push(ctx.getImageData(0,0,c.width,c.height).data);await qa.call('pixels',`frame-${t}.png`,canvas.toDataURL());const snapshot=createRenderSnapshot(c,t,[],undefined,project);check(snapshot.layers.length===1,'Timeline snapshot wrong');}
  check(pixels[0]!.some((v,i)=>v!==pixels[1]![i]),'Frames identical');
  check(store.load(await qa.call('project-read')),'Reload for render failed');const reopened=store.commands.getSnapshot(),r2=new OutputFrameRenderer(reopened,activeComposition(reopened),defaultOutputSettings(activeComposition(reopened)));await r2.init();const canvas=await r2.draw(1),again=canvas.getContext('2d')!.getImageData(0,0,c.width,c.height).data;check(again.every((v,i)=>v===pixels[1]![i]),'Reload pixels differ');render.dispose();r2.dispose();
 });
 await test('invalid-speed-file-recovery-real-renderer',async()=>{
  const broken=JSON.parse(after);broken.compositions[0].layers[0].transform.position.keyframes[0].interpolation={type:'custom-speed',points:[{t:0,speed:0},{t:1,speed:0}]};check(store.load(JSON.stringify(broken)),'Damaged speed curve prevented opening');check(prop().keyframes[0]!.interpolation.type==='linear','Recovery did not use documented fallback');const p=store.commands.getSnapshot(),c=activeComposition(p),r=new OutputFrameRenderer(p,c,defaultOutputSettings(c));await r.init();const canvas=await r.draw(1),v=evaluateProperty(prop(),1),pixel=canvas.getContext('2d')!.getImageData(Math.round(v.x+20),Math.round(v.y+20),1,1).data;check(pixel[2]!>pixel[0]!+80,'Recovery renderer invalid');await qa.call('pixels','recovered-linear.png',canvas.toDataURL());r.dispose();check(store.load(after),'Restore after recovery test failed');
 });
 await test('legacy-linear-project-render-remains-correct',async()=>{
  check(store.load(before),'Legacy linear reload failed');const p=store.commands.getSnapshot(),c=activeComposition(p),a=prop().keyframes[0]!.value,b=prop().keyframes[1]!.value,v=evaluateProperty(prop(),1);check(Math.abs(v.x-(a.x+b.x)/2)<1e-9,'Existing Linear evaluation changed');const r=new OutputFrameRenderer(p,c,defaultOutputSettings(c));await r.init();const canvas=await r.draw(1),pixel=canvas.getContext('2d')!.getImageData(Math.round(v.x+20),Math.round(v.y+20),1,1).data;check(pixel[2]!>pixel[0]!+80,'Legacy render pixel mismatch');await qa.call('pixels','legacy-linear.png',canvas.toDataURL());r.dispose();check(store.load(after),'Restore custom curve failed');
 });
 store.select(layer().id);store.selectProperties([prop().id]);await pause(150);if(!document.querySelector('svg[aria-label="手绘相对速度曲线"]'))await click(button('手绘速度'));
 for(const [w,h] of [[1280,720],[1440,900],[1920,1080],[2560,1440]]){await qa.call('viewport',w,h);await pause();await qa.call('capture',`layout-${w}x${h}`)}
 await qa.call('done',{pass:true,records,trustedNativeMouseEvents:trusted,paidApiCalls:0,scope:'Real App; native GUI create/draw/Inspector/Undo/Redo. Shared clock via store; save/reopen via real project file and EditorStore. No native OS save dialog automation.'});
}
void main().catch(e=>qa.call('done',{pass:false,current,error:String(e),stack:e?.stack,records,buttons:[...document.querySelectorAll('button')].map(e=>e.getAttribute('aria-label')||e.textContent),inputs:[...document.querySelectorAll('input')].map(e=>e.getAttribute('aria-label'))}));
