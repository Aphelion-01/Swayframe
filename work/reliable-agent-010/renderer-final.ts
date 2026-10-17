import { AIError } from '../../src/ai/contracts';
import { AIProviderManager } from '../../src/ai/provider-manager';
import { createNativeAgent } from '../../src/ui/native-agent-controller';
import { EditorStore } from '../../src/ui/editor-store';
import { createDefaultProject, activeComposition } from '../../src/core/project-model';
import { saveProject, loadProject } from '../../src/core/project-io';
import { AgentSnapshotRenderer } from '../../src/agent/vision';
import { evaluateProperty } from '../../src/core/animation-engine';
import { compileGraph } from '../../src/core/compositing-compiler';
import { providerCapabilityProfile } from '../../src/ai/provider-profile';
import { exportAgentDiagnostic } from '../../src/agent/working-memory';
const api=(window as any).bench;
const col=(r,g,b)=>({r,g,b,a:1});
function layerFill(l){const p=l?.editor?.properties?.fill?.baseValue;return Array.isArray(p)?{r:p[0],g:p[1],b:p[2],a:p[3]}:l?.fill;}
function sameColor(actual,expected){return !!actual && ['r','g','b','a'].every(k=>Math.abs(actual[k]-expected[k])<0.01);}
async function main(){
const report:any={version:'0.10.0',design:'post-fix semantic easing smoke; one remaining authorized request, NOT part of paired Skill comparison',tasks:[],failures:[]};
try{
const settings=await api.settings(),provider=settings.providers.find(p=>p.name==='DeepSeek'&&p.enabled);
if(!provider || provider.baseUrl!=='https://api.deepseek.com' || !await api.has(provider.id))throw Error('Configured DeepSeek credential unavailable');
const route={providerId:provider.id,modelId:provider.defaultModel};report.route={name:provider.name,model:provider.defaultModel,profile:providerCapabilityProfile(provider)};
settings.defaultProviderId=provider.id;settings.routing={general:route,planning:route,vision:route};settings.failover={...settings.failover,enabled:false,maxRetries:0};settings.privacy={...settings.privacy,sendReferences:false,sendRenderPreview:false,saveHistory:false};settings.agent={...settings.agent,streaming:false,visualVerification:false,autoApplySafe:false,recovery:{providerRetries:0,planModelRepairs:1,stepModelRepairs:1,executionModelRepairs:1,planningRequests:1,proposalRequests:2,visualRequests:0},disabledNativeSkills:[]};
const data=new Map(); const manager=new AIProviderManager({loadSettings:async()=>settings,saveSettings:async()=>{},setCredentials:async()=>{},removeCredentials:async()=>{},hasCredentials:id=>api.has(id),storageStatus:async()=>'secure',readData:async k=>data.get(k),writeData:async(k,v)=>{data.set(k,v);}}, {chat:async(p,r,s)=>{s?.throwIfAborted();const res=await api.chat(p.id,r);s?.throwIfAborted();if(res.benchError)throw new AIError(res.benchError.code??'invalid_request',res.benchError.message,res.benchError.details);return res;},listModels:async()=>[],testConnection:async()=>({ok:true,message:'unused'})});await manager.initialize();
const tasks=[
{id:'a',goal:'创建三个矩形图层，名称分别 Red、Green、Blue，纯色分别红 RGB(1,0,0)、绿 RGB(0,1,0)、蓝 RGB(0,0,1)。位置分别(480,540)、(960,540)、(1440,540)，宽高240。只创建这三个矩形。',follow:'只把名称 Green 的第二个矩形改为紫色 RGB(0.5,0,0.5)，其余对象保持不变。不要创建对象。',check:ls=>ls.length===3&&sameColor(layerFill(ls.find(l=>l.name==='Red')),col(1,0,0))&&sameColor(layerFill(ls.find(l=>l.name==='Green')),col(.5,0,.5))&&sameColor(layerFill(ls.find(l=>l.name==='Blue')),col(0,0,1))},
{id:'b',goal:'创建两个文字图层：标题名称 Title，内容 Cubic，Times New Roman 字体，字号96，位置(960,450)；中文副标题名称 Subtitle，内容 立方渐变，字体 sans-serif，字号32，位置(960,590)。保持可编辑，只创建这两个图层。',check:ls=>ls.length===2&&ls.some(l=>l.type==='text'&&l.text==='Cubic'&&l.fontSize===96&&l.fontFamily==='Times New Roman'&&l.transform.position.baseValue.x===960)&&ls.some(l=>l.type==='text'&&l.text==='立方渐变'&&l.fontSize===32)},
{id:'c',goal:'创建一个矩形图层 Background，1920x1080，位于合成中心，径向渐变填充，从中心青色 RGB(0,0.7,0.8)到外围深蓝 RGB(0,0.05,0.15)。渐变中心(0.5,0.5)，radius=0.8。不要新增合成或无关对象，使用实际原生填充。',check:ls=>ls.length===1&&ls[0].editor?.gradient==='radial'&&Math.abs(ls[0].editor?.properties.radial_radius?.baseValue-.8)<.001},
{id:'d',goal:'创建一个矩形 Animated。为位置属性添加两个关键帧：0秒位置(480,540)，2秒位置(1440,540)，设置为缓入缓出贝塞尔曲线。不要创建其他对象。',check:ls=>ls.length===1&&ls[0].transform.position.keyframes.length===2&&Math.abs(evaluateProperty(ls[0].transform.position,1).x-960)<3&&ls[0].transform.position.keyframes.some(k=>k.interpolation.type==='bezier')},
{id:'e',goal:'创建矩形图层 Graph，1920x1080。创建合成节点径向渐变 radialGradient、发光 glow 和 Output，连接使渐变经过发光再输出。保留默认 source/output，不新增重复 Output。让实际画面可见。需要时按真实工具契约查询能力，不要创建未知节点。',check:ls=>ls.length===1&&ls[0].editor?.graph?.nodes.some(n=>n.type==='radialGradient')&&ls[0].editor?.graph?.nodes.some(n=>n.type==='glow')&&compileGraph(ls[0].editor.graph).valid},
{id:'f',goal:'创建背景矩形 Background（1920x1080，中心(960,540)，纯色蓝 RGB(0,0,1)）与文字图层 Title，内容 Cubic，字号96，位置(960,540)。文字不透明度关键帧：0秒为0，2秒为1，线性。只创建这两个对象。',follow:'只将背景 Background 改为红色 RGB(1,0,0)。保留 Title 的内容、位置以及全部文字动画，不新增图层，不删除或修改文字图层。',check:ls=>ls.length===2&&sameColor(layerFill(ls.find(l=>l.name==='Background')),col(1,0,0))&&ls.find(l=>l.type==='text')?.transform.opacity.keyframes.length===2&&evaluateProperty(ls.find(l=>l.type==='text').transform.opacity,1)===.5},
{id:'g',goal:'创建一个名为 FaultShape 的矩形，随后将该矩形纯色填充改为红色 RGB(1,0,0)，不要创建其他对象。',check:ls=>ls.length===1&&sameColor(layerFill(ls[0]),col(1,0,0))},
];
const originalChatOnce=manager.chatOnce.bind(manager);
for(const nativeSkills of [true]){
await manager.update(s=>({...s,agent:{...s.agent,nativeSkills}}));
for(const task of tasks.filter(t=>t.id==='d')){
const store=new EditorStore(createDefaultProject()),base=store.commands.getSnapshot(),native=createNativeAgent(store,manager);let injected=false;
manager.chatOnce=async(...args)=>{const response=await originalChatOnce(...args);if(task.id==='g'&&!injected){const call=response.toolCalls.find(c=>c.name==='submitPlan');if(call && (call.arguments as any).steps?.length>1){(call.arguments as any).steps.reverse();injected=true;}}return response;};
const r:any={id:task.id,condition:nativeSkills?'with-skills':'without-skills',sessions:[],durationMs:0,injected:false};const start=performance.now();await api.progress('DeepSeek '+r.condition+' '+task.id);
for(const [index,goal] of [task.goal,...(task.follow?[task.follow]:[])].entries()){
await native.agent.run(goal);let session=native.agent.getSnapshot();if(session.pendingConfirmation&&session.currentPlan){await native.agent.preview(session.currentPlan.id);session=native.agent.getSnapshot();if(session.pendingConfirmation&&session.creationProposal)await native.agent.apply(session.currentPlan!.id);}
session=native.agent.getSnapshot();r.sessions.push({status:session.status,error:session.error,trace:session.trace,skillContextEnabled:(session.selectedContext as any)?.nativeSkills?.length>0,recoveries:session.recoveries,recoveryTrace:session.recoveryTrace});await api.save(task.id+'-'+r.condition+'-'+index+'-session.json',JSON.stringify(session,null,2));await api.save(task.id+'-'+r.condition+'-'+index+'-diagnostic.json',exportAgentDiagnostic(session));
if(session.status!=='completed')break;
}
r.durationMs=performance.now()-start;r.injected=injected;const next=store.commands.getSnapshot(),ls=activeComposition(next).layers;r.layerCount=ls.length;r.stateCorrect=task.check(ls);r.completed=r.sessions.every(s=>s.status==='completed')&&r.stateCorrect;r.roundTrip=saveProject(loadProject(saveProject(next)))===saveProject(next);r.commits=store.commands.undoStack.length;
const image=await new AgentSnapshotRenderer().render(next,1,new AbortController().signal,undefined,undefined,true);r.render={width:image.width,height:image.height,...image.pixelEvidence};await api.saveImage(task.id+'-'+r.condition+'.png',image.image);await api.save(task.id+'-'+r.condition+'.swayframe',saveProject(next));while(store.commands.undoStack.length)store.commands.undo();r.undoRestoresBase=saveProject(store.commands.getSnapshot())===saveProject(base);report.tasks.push(r);await api.save('progress-report.json',JSON.stringify(report,null,2));
}
}
report.complexReference={id:'h',toolExecution:'NOT_TESTED',sceneStructure:'NOT_TESTED',visual:'NOT_VERIFIED',reason:'Configured DeepSeek profile has no vision capability; no reference image transmitted. Never treats textual approximation as visual reconstruction.'};
}catch(e){report.failures.push(String(e));}await api.done(report);
}void main();
