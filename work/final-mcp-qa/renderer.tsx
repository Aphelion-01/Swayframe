import ReactDOM from 'react-dom/client';
import { App } from '../../src/ui/App';
import { EditorStore } from '../../src/ui/editor-store';
import { bindProjectService } from '../../src/desktop/project-service';
import { desktopService } from '../../src/desktop/service';
import { attachMCPHost } from '../../src/mcp/renderer-host';
import { activeComposition,createComposition,createDefaultProject,createLayer } from '../../src/core/project-model';
import { command } from '../../src/core/command-system';
import '../../src/ui/design-tokens.css';import '../../src/ui/base.css';import '../../src/ui/editor-theme.css';import '../../src/ui/ai/ai.css';
const qa=(window as any).sfMCPQA;
const comp=createComposition({width:64,height:48}),layer=createLayer('rectangle',{name:'Real MCP target',width:8,height:8,position:{x:10,y:20}});
const project=createDefaultProject({...comp,layers:[layer]});
const store=new EditorStore(project),api=desktopService.api!,service=bindProjectService(store,api);
attachMCPHost(store,api.mcp!);
ReactDOM.createRoot(document.getElementById('root')!).render(<App store={store}/>);
qa.onTask(async(id:string,task:string,arg:any)=>{
 try {
  let result:any;
  switch(task){
   case 'init': service.recover({data:store.save(),path:arg,timestamp:Date.now()});result={layerId:layer.id,compositionId:comp.id};break;
   case 'control': result=await api.mcp!.control(arg);break;
   case 'snapshot':result={scene:store.save(),undo:store.commands.undoStack.length,redo:store.commands.redoStack.length,position:activeComposition(store.commands.getSnapshot()).layers.find(l=>l.id===layer.id)?.transform.position.baseValue};break;
   case 'undo':store.undo();break;case 'redo':store.redo();break;
   case 'save':result=await service.save();break;
   case 'reopen':await service.closeProject();await service.open(arg);result={active:service.active,scene:store.save()};break;
   case 'switch':store.load(JSON.stringify(createDefaultProject(createComposition({width:64,height:48}))));break;
   case 'delete':store.run('GUI delete',[command({type:'layer.delete',compositionId:comp.id,layerId:layer.id})]);break;
   case 'settings':window.dispatchEvent(new Event('swayframe:ai-settings'));await new Promise(r=>setTimeout(r,100));(Array.from(document.querySelectorAll('[role="tab"]')).find(e=>e.textContent==='MCP') as HTMLElement)?.click();await new Promise(r=>setTimeout(r,100));break;
   case 'pixels':{const image=new Image();image.src=arg;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);result=[[0,0],[4,4],[10,10],[24,20]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data));break;}
   default:throw Error('Unknown QA task');
  }
  qa.reply(id,{ok:true,result});
 }catch(e){qa.reply(id,{ok:false,error:String(e)});}
});
qa.ready();
