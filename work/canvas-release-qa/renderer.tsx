import { createRoot } from 'react-dom/client';
import { App } from '../../src/ui/App';
import { EditorStore } from '../../src/ui/editor-store';
import { createDefaultProject, createLayer, activeComposition } from '../../src/core/project-model';
import { OutputFrameRenderer } from '../../src/renderers/output-frame';
import { defaultOutputSettings } from '../../src/core/output-settings';
import '../../src/ui/design-tokens.css';import '../../src/ui/base.css';import '../../src/ui/editor-theme.css';
const qa=(window as any).sfUnselectedAgent, records:any[]=[];let current='startup';
const pause=()=>new Promise(r=>setTimeout(r,35));const check=(v:unknown,m:string)=>{if(!v)throw Error(m)};
async function main(){
 await qa.call('init');localStorage.setItem('motion.canvas-snap','false');await qa.call('viewport',1440,900);
 const p=createDefaultProject(),l=createLayer('rectangle',{position:{x:600,y:400},width:140,height:100}),store=new EditorStore({...p,compositions:p.compositions.map(c=>({...c,layers:[l]}))});store.setAutoKeyframes(false);store.select(l.id);
 createRoot(document.getElementById('root')!).render(<App store={store}/>);await pause();await pause();
 const canvas=document.querySelector('canvas[aria-label="合成画布"]') as HTMLCanvasElement;check(!!canvas,'No real Canvas');
 const events:any[]=[];for(const kind of ['pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture'])document.addEventListener(kind,e=>{const p=e as PointerEvent;events.push({type:p.type,id:p.pointerId,buttons:p.buttons,button:p.button,target:(p.target as Element)?.tagName,trusted:p.isTrusted,x:p.clientX,y:p.clientY,ctrl:p.ctrlKey})},true);
 let pointer=0;let trusted=false;canvas.addEventListener('pointerdown',e=>{pointer=e.pointerId;trusted=e.isTrusted});
 const pos=()=>activeComposition(store.commands.getSnapshot()).layers[0]!.transform.position.baseValue;
 const screen=(x:number,y:number)=>{const r=canvas.getBoundingClientRect();return{x:r.left+x*r.width/1920,y:r.top+y*r.height/1080}};
 const mouse=async(type:string,x:number,y:number)=>{await qa.call('mouse',{type,...screen(x,y),button:type==='mouseMoved'?'none':'left',buttons:type==='mouseReleased'?0:1,modifiers:0,clickCount:type==='mouseMoved'?0:1});await pause()};
 const test=async(id:string,fn:()=>Promise<void>)=>{current=id;await fn();records.push({id,pass:true});await qa.call('capture',id)};
 const initial=store.save();await qa.call('capture','initial');
 await test('native-capture-loss-global-release',async()=>{
  await mouse('mousePressed',630,425);await mouse('mouseMoved',700,460);check(trusted,'CDP event was not trusted');
  if(canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);else canvas.dispatchEvent(new PointerEvent('lostpointercapture',{bubbles:true,pointerId:pointer}));await pause();check(events.some(e=>e.type==='lostpointercapture'),'Capture loss was not exercised');
  await qa.call('mouse',{type:'mouseMoved',x:1430,y:400,button:'none',buttons:1,modifiers:0});await pause();
  await mouse('mouseMoved',790,500);await mouse('mouseReleased',850,550);
  check(Math.abs(pos().x-820)<0.05&&Math.abs(pos().y-525)<0.05,'Final point lost: '+JSON.stringify(pos()));check(store.commands.undoStack.length===1,'Not exactly one Undo entry');
  const moved=store.save();store.undo();check(store.save()===initial,'Undo mismatch');store.redo();check(store.save()===moved,'Redo mismatch');check(store.load(moved),'Reload failed');check(store.save()===moved,'Reload changed content');
 });
 await test('native-release-newer-than-last-move',async()=>{
  store.load(initial);store.select(l.id);await pause();await mouse('mousePressed',630,425);await mouse('mouseMoved',670,445);await mouse('mouseReleased',760,505);
  check(Math.abs(pos().x-730)<0.05&&Math.abs(pos().y-480)<0.05,'Pointerup sample not committed: '+JSON.stringify(pos()));check(store.commands.undoStack.length===1,'Duplicate commit');
 });
 await test('native-Escape-still-cancels-after-capture-loss',async()=>{
  store.load(initial);store.select(l.id);await pause();await mouse('mousePressed',630,425);await mouse('mouseMoved',710,465);if(canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);else canvas.dispatchEvent(new PointerEvent('lostpointercapture',{bubbles:true,pointerId:pointer}));await pause();
  await qa.call('key',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await qa.call('key',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await mouse('mouseReleased',760,505);
  check(store.save()===initial&&store.commands.undoStack.length===0,'Escape committed draft');
 });
 await test('native-repeat-drags-stay-at-target',async()=>{
  store.load(initial);store.select(l.id);await pause();
  for(let i=0;i<8;i++){const before=pos();const x=before.x+30,y=before.y+25;await mouse('mousePressed',x,y);await mouse('mouseMoved',x+35,y+20);if(i%2===0){if(canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);else canvas.dispatchEvent(new PointerEvent('lostpointercapture',{bubbles:true,pointerId:pointer}));await pause();}await mouse('mouseReleased',x+50,y+30);check(Math.abs(pos().x-before.x-50)<0.05&&Math.abs(pos().y-before.y-30)<0.05,'Repeated drag '+i+' bounced');}
  check(store.commands.undoStack.length===8,'Repeated drags history mismatch');
 });
 const project=store.commands.getSnapshot(),c=activeComposition(project),r=new OutputFrameRenderer(project,c,defaultOutputSettings(c));await r.init();const image=await r.draw(0);await qa.call('pixels','final-frame.png',image.toDataURL());r.dispose();
 await qa.call('done',{pass:true,records,trustedNativeMouseEvents:true,captureLoss:'native release when available; otherwise explicit DOM fault injection (not a physical capture-loss claim)',position:pos(),scope:'Real Electron App + Chromium trusted mouse input + native Command/Undo/save/reload/Renderer; no model calls'});
}
void main().catch(e=>qa.call('done',{pass:false,current,error:String(e),stack:e?.stack,records}));
