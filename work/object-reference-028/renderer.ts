import { AIError } from '../../src/ai/contracts';
import { EditorStore } from '../../src/ui/editor-store';
import { createNativeAgent } from '../../src/ui/native-agent-controller';
import { AIProviderManager } from '../../src/ai/provider-manager';
import { activeComposition, createDefaultProject, createLayer } from '../../src/core/project-model';
import { command, transaction } from '../../src/core/command-system';
import { saveProject, loadProject } from '../../src/core/project-io';
import { AgentSnapshotRenderer } from '../../src/agent/vision';
const api=(window as any).bench;
async function main(){
 const report:any={version:'0.9.28',testMode:'controlled real provider, one independent scene per task, native Agent/Transaction/Canvas, no images sent, forced submitPlan',budget:{requests:7,inputTokenStop:200000},tasks:[],failures:[]};
 try {
 const settings=await api.settings(); const p=settings.providers.find(p=>p.name==='DeepSeek'&&p.enabled);
 if(!p||p.baseUrl!=='https://api.deepseek.com'||p.defaultModel!=='deepseek-flash'||!await api.has(p.id))throw Error('Expected real DeepSeek flash route not available');
 const route={providerId:p.id,modelId:p.defaultModel}; report.route={name:p.name,model:p.defaultModel}; settings.defaultProviderId=p.id;settings.routing={general:route,planning:route,vision:route};settings.failover={...settings.failover,enabled:false};settings.privacy={...settings.privacy,sendReferences:false,sendRenderPreview:false,saveHistory:false};settings.agent={...settings.agent,visualVerification:false,maxRefinements:0,autoApplySafe:false,streaming:false,mode:'AGENT'};
 const data=new Map(); const manager=new AIProviderManager({loadSettings:async()=>settings,saveSettings:async()=>{},setCredentials:async()=>{},removeCredentials:async()=>{},hasCredentials:id=>api.has(id),storageStatus:async()=>'secure',readData:async k=>data.get(k),writeData:async(k,v)=>{data.set(k,v);}}, {chat:async(p,r,s)=>{s?.throwIfAborted();const request=r.tools?.[0]?.name==='submitPlan'?{...r,tools:[r.tools[0]],toolChoice:'submitPlan'}:r;const res=await api.chat(p.id,request);s?.throwIfAborted();if(res.benchError)throw new AIError(res.benchError.code,res.benchError.message);return res;},listModels:async()=>[],testConnection:async()=>({ok:true,message:'unused'})}); await manager.initialize();
 const tasks=[
 {id:'radial',prompt:'创建名为RefRadial的400x300矩形，用setFill设置蓝色径向渐变（中心RGBA0,0.3,1,1，边缘RGBA0,0,0.1,1，radius0.8），调整位置到800,400。只做这三个步骤。'},
 {id:'two',prompt:'创建两个矩形，分别命名RefA和RefB，尺寸300x200，位置600,540和1200,540。分别用setFill设置纯蓝RGBA0,0,1,1和纯红RGBA1,0,0,1，不要混淆图层。'},
 {id:'text',prompt:'创建文字图层，内容Reference Text，字号64，位置960,540。添加透明度动画：0秒0，1秒1。使用layerId加property=opacity的addKeyframe。只做这些操作。'},
 {id:'glow',prompt:'创建1920x1080背景矩形RefBackground，位置960,540。用setFill设置蓝色径向渐变，添加一个glow效果。再创建文字Reference Glow，字号64，位置960,540。保持文字可编辑，使用原生工具，不要Forge。'},
 {id:'graph',prompt:'对选中图层的节点图，创建一个gaussianBlur节点，连接到已有output节点，把新节点radius设为12。createNode会自动插入到Output之前，不要重复连接。通过真实节点结果引用设置参数，不添加图层。'}
 ];
 for(const task of tasks){
 const store=new EditorStore(createDefaultProject()); if(task.id==='graph'){const layer=createLayer('rectangle',{name:'GraphFixture'});store.commands.executeTransaction(transaction('fixture','system',[command({type:'layer.create',compositionId:store.getSnapshot().project.activeCompositionId,layer})]));store.select(layer.id);}
 const base=saveProject(store.getSnapshot().project),undoBefore=store.commands.undoStack.length; const {agent}=createNativeAgent(store,manager); const result:any={id:task.id};
 try {await agent.run(task.prompt); const preview=agent.getSnapshot(); if(preview.pendingConfirmation)await agent.apply(preview.currentPlan!.id);const session=agent.getSnapshot();result.status=session.status;result.error=session.error;result.resolutionCalls=session.toolCalls.filter(t=>(t.result as any)?.resolution).map(t=>({stepId:t.id,tool:t.tool,resolution:(t.result as any).resolution}));result.toolCallSuccess=session.toolCalls.filter(t=>t.phase==='execute').every(t=>t.status==='completed');result.objectReferenceResolution=result.resolutionCalls.every(t=>t.resolution.status==='RESOLVED'); await api.save(task.id+'-session.json',JSON.stringify(session,null,2));
 const project=store.getSnapshot().project,ls=activeComposition(project).layers;
 result.sceneStateCorrectness=task.id==='radial'?ls.length===1&&ls[0]?.editor?.gradient==='radial'&&JSON.stringify(ls[0]?.transform.position.baseValue)===JSON.stringify({x:800,y:400}):task.id==='two'?ls.length===2&&JSON.stringify(ls.find(l=>l.name==='RefA')?.editor?.properties.fill?.baseValue)===JSON.stringify([0,0,1,1])&&JSON.stringify(ls.find(l=>l.name==='RefB')?.editor?.properties.fill?.baseValue)===JSON.stringify([1,0,0,1]):task.id==='text'?ls.length===1&&ls[0]?.type==='text'&&ls[0].text==='Reference Text'&&ls[0].fontSize===64&&ls[0].transform.opacity.keyframes.length===2:task.id==='glow'?ls.length===2&&ls.some(l=>l.type==='text'&&l.text==='Reference Glow')&&ls.some(l=>l.editor?.gradient==='radial'&&l.editor?.graph?.nodes.some(n=>n.type==='glow')):ls.length===1&&ls[0]?.editor?.graph?.nodes.some(n=>n.type==='gaussianBlur'&&n.params.radius?.baseValue===12)&&ls[0]?.editor?.graph?.edges.some(e=>ls[0]?.editor?.graph?.nodes.find(n=>n.id===e.from.nodeId)?.type==='gaussianBlur'&&ls[0]?.editor?.graph?.nodes.find(n=>n.id===e.to.nodeId)?.type==='output');
 result.executionSuccess=session.status==='completed';result.singleCommit=store.commands.undoStack.length-undoBefore===1;const saved=saveProject(project);result.roundTripEqual=saveProject(loadProject(saved))===saved;await api.save(task.id+'.swayframe',saved);const rendered=await new AgentSnapshotRenderer().render(project,task.id==='text'?1:0,new AbortController().signal);await api.saveImage(task.id+'.png',rendered.image);result.renderCorrectness='Pending independent image review';store.commands.undo();result.undoRestoresBase=saveProject(store.getSnapshot().project)===base;store.commands.redo();result.redoRestoresResult=saveProject(store.getSnapshot().project)===saved;result.taskCompletion='Pending image review'; }
 catch(e){result.failure=String(e);result.formalSceneUnchanged=saveProject(store.getSnapshot().project)===base;}
 report.tasks.push(result);await api.save('live-progress.json',JSON.stringify(report,null,2));await api.progress('LIVE '+JSON.stringify({id:result.id,status:result.status,scene:result.sceneStateCorrectness,error:result.error,failure:result.failure}));agent.stop();
 }
 }catch(e){report.failures.push(String(e));} await api.done(report);
}
void main();
