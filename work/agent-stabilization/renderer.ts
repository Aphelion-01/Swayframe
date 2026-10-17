import {AIError} from '../../src/ai/contracts';
import {AIProviderManager} from '../../src/ai/provider-manager';
import {createNativeAgent} from '../../src/ui/native-agent-controller';
import {EditorStore} from '../../src/ui/editor-store';
import {createDefaultProject,activeComposition,createLayer} from '../../src/core/project-model';
import {command,transaction} from '../../src/core/command-system';
import {saveProject,loadProject} from '../../src/core/project-io';
import {AgentSnapshotRenderer} from '../../src/agent/vision';
import {evaluateProperty} from '../../src/core/animation-engine';
const api=(window as any).bench;
const ref=stepId=>({kind:'stepResult',stepId,output:'layerId'});
const minimal={id:'fixed-minimal',goal:'创建矩形和Cubic文字淡入',risk:'low',steps:[
{id:'rectangle',label:'矩形',tool:'createRectangle',arguments:{name:'Rectangle',width:400,height:300}},
{id:'fill',label:'填充',tool:'setFill',arguments:{layerId:ref('rectangle'),color:{r:0,g:.7,b:.8,a:1}}},
{id:'text',label:'文本',tool:'createText',arguments:{content:'Cubic',name:'Title',fontSize:64}},
{id:'font',label:'字体',tool:'setFont',arguments:{layerId:ref('text'),fontFamily:'serif'}},
{id:'position',label:'位置',tool:'setPosition',arguments:{layerId:ref('text'),value:{x:960,y:450}}},
{id:'key0',label:'帧0',tool:'addKeyframe',arguments:{layerId:ref('text'),property:'opacity',time:0,value:0}},
{id:'key1',label:'帧1',tool:'addKeyframe',arguments:{layerId:ref('text'),property:'opacity',time:2,value:1}},
]};
async function main(){const live=await api.mode();const report:any={version:'0.10.1',evidence:live?'REAL_PROVIDER':'DETERMINISTIC_FIXED_RESPONSES_AND_REAL_RENDERER',tasks:[],failures:[]};
try {
 const settings=await api.settings(),provider=settings.providers.find(p=>p.name==='DeepSeek'&&p.enabled);
 if(!provider||provider.baseUrl!=='https://api.deepseek.com'||!await api.has(provider.id))throw Error('Configured DeepSeek credential unavailable');
 const route={providerId:provider.id,modelId:provider.defaultModel};report.route={name:provider.name,model:provider.defaultModel};
 settings.defaultProviderId=provider.id;settings.routing={general:route,planning:route,vision:route};settings.failover={...settings.failover,enabled:false,maxRetries:0};settings.privacy={...settings.privacy,sendReferences:false,sendRenderPreview:false,saveHistory:false};settings.agent={...settings.agent,streaming:false,visualVerification:false,autoApplySafe:false,disabledNativeSkills:[],recovery:{providerRetries:0,planModelRepairs:1,stepModelRepairs:1,executionModelRepairs:1,planningRequests:4,proposalRequests:1,visualRequests:0}};
 const data=new Map();const manager=new AIProviderManager({loadSettings:async()=>settings,saveSettings:async()=>{},setCredentials:async()=>{},removeCredentials:async()=>{},hasCredentials:id=>api.has(id),storageStatus:async()=>'secure',readData:async k=>data.get(k),writeData:async(k,v)=>{data.set(k,v);}}, {chat:async(p,r,s)=>{s?.throwIfAborted();if(!live){await api.save('request-size.json',JSON.stringify({utf8Bytes:new TextEncoder().encode(JSON.stringify(r)).length,schemas:r.tools.length,messages:r.messages.map(m=>({role:m.role,characters:m.content.length}))},null,2));return {text:'',model:'fixed-contract-fixture',toolCalls:[{id:'fixed',name:'submitPlan',arguments:minimal}]};}const res=await api.chat(p.id,r);s?.throwIfAborted();if(res.benchError)throw new AIError(res.benchError.code??'invalid_request',res.benchError.message,res.benchError.details);return res;},listModels:async()=>[],testConnection:async()=>({ok:true,message:'unused'})});await manager.initialize();
 const tasks=live?[
 {id:'rectangle',goal:'创建一个原生矩形图层，名称 Rectangle，宽400高300，放在合成中心。只创建这一个图层。',check:ls=>ls.length===1&&ls[0].shapeKind==='rectangle'&&ls[0].width===400&&ls[0].height===300},
 {id:'text',goal:'创建一个原生可编辑文字图层，名称 Title，内容 Cubic，字体 serif，字号64，位置(960,450)。只创建这一层。',check:ls=>ls.length===1&&ls[0].type==='text'&&ls[0].text==='Cubic'&&ls[0].fontFamily==='serif'&&ls[0].fontSize===64},
 {id:'fill',goal:'创建一个矩形 Fill，宽400高300，位置合成中心。设置纯色填充 RGB(0,0.7,0.8)。只创建这一个矩形。',check:ls=>ls.length===1&&Math.abs(ls[0].editor.properties.fill.baseValue[1]-.7)<.001},
 {id:'keyframes',goal:'创建一个矩形 Animated，宽400高300，位置合成中心。不透明度添加线性关键帧：0秒为0，2秒为1。不要创建其他对象。',check:ls=>ls.length===1&&ls[0].transform.opacity.keyframes.length===2&&Math.abs(evaluateProperty(ls[0].transform.opacity,1)-.5)<.001},
 {id:'combined',goal:'创建一个名为 Background 的矩形，宽800高600，位于合成中心(960,540)，设置径向渐变填充，中心青色RGB(0,0.7,0.8)，外围深蓝RGB(0,0.05,0.15)。再创建可编辑文字图层 Title，内容 Cubic，字体 serif，字号96，位置(960,450)。仅创建这两个图层。',check:ls=>ls.length===2&&ls.some(l=>l.type==='shape'&&l.editor.gradient==='radial')&&ls.some(l=>l.type==='text'&&l.text==='Cubic'&&l.fontSize===96)},
 ]:[{id:'a',config:'A',goal:minimal.goal},{id:'b',config:'B',goal:minimal.goal},{id:'c',config:'C',goal:minimal.goal},{id:'d',config:'D',goal:minimal.goal}];
 if(live){tasks.splice(0,4);tasks[0]={...tasks[0],id:'combined-no-skills',noSkills:true};}
 for(const task of tasks){await api.progress((live?'DeepSeek ':'Offline ')+task.id);await manager.update(s=>({...s,agent:{...s.agent,nativeSkills:task.config==='D'||(live&&!task.noSkills)}}));
 const store=new EditorStore(createDefaultProject()),base=store.commands.getSnapshot(),native=createNativeAgent(store,manager);const start=performance.now();let session:any;
 if(task.config==='A'){
 const rect=createLayer('rectangle',{name:'Rectangle',width:400,height:300,position:{x:960,y:540}}),text=createLayer('text',{name:'Title',position:{x:960,y:450}});if(text.type!=='text')throw Error('Text fixture');
 store.commands.executeTransaction(transaction('Direct Commands','agent',[command({type:'layer.create',compositionId:base.activeCompositionId,layer:rect}),command({type:'property.setBase',propertyId:rect.editor!.properties.fill.id,value:[0,.7,.8,1]}),command({type:'layer.create',compositionId:base.activeCompositionId,layer:{...text,text:'Cubic',fontSize:64,fontFamily:'serif'}}),command({type:'property.setBase',propertyId:text.editor!.properties.fontSize.id,value:64}),...[0,2].map((time,i)=>command({type:'keyframe.add',propertyId:text.transform.opacity.id,keyframe:{id:crypto.randomUUID(),time,value:i,interpolation:{type:'linear' as const}}}))]));
 }else if(task.config==='B'){
 native.runtime.context(task.goal);const p=native.runtime.preparePlan!(minimal as any);native.runtime.validate(p);const tx=native.runtime.begin(base);for(const step of p.steps)await tx.execute(step.tool,step.arguments,new AbortController().signal,step.id);const validation=await native.runtime.verifyExecution!(base,tx.getSnapshot(),tx.evidence!(),new AbortController().signal);await api.save('b-verification.json',JSON.stringify(validation,null,2));tx.commit('Fixed adapter');
 }else{await native.agent.run(task.goal);session=native.agent.getSnapshot();if(session.pendingConfirmation&&session.currentPlan){await native.agent.preview(session.currentPlan.id);session=native.agent.getSnapshot();if(session.pendingConfirmation&&session.creationProposal)await native.agent.apply(session.currentPlan.id);}session=native.agent.getSnapshot();await api.save(task.id+'-session.json',JSON.stringify(session,null,2));}
 const next=store.commands.getSnapshot(),ls=activeComposition(next).layers;const image=await new AgentSnapshotRenderer().render(next,1,new AbortController().signal,undefined,undefined,true);await api.saveImage(task.id+'.png',image.image);await api.save(task.id+'.swayframe',saveProject(next));
 const normalized=ls.map(l=>({name:l.name,type:l.type,shapeKind:l.shapeKind,text:l.text,fontFamily:l.fontFamily,fontSize:l.fontSize,position:l.transform.position.baseValue,width:l.width,height:l.height,fill:l.editor.properties.fill.baseValue,opacityAt1:evaluateProperty(l.transform.opacity,1)}));
 const stateCorrect=live?task.check(ls):ls.length===2&&ls.some(l=>l.type==='text'&&l.text==='Cubic'&&evaluateProperty(l.transform.opacity,1)===.5);
 const row:any={id:task.id,config:task.config??(task.noSkills?'C-live':'D-live'),status:session?.status??'completed',stateCorrect,commits:store.commands.undoStack.length,durationMs:performance.now()-start,render:image.pixelEvidence,normalized,trace:session?.trace,error:session?.executionError,roundTrip:saveProject(loadProject(saveProject(next)))===saveProject(next)};
 const final=saveProject(next);store.commands.undo();row.undoRestores=saveProject(store.commands.getSnapshot())===saveProject(base);store.commands.redo();row.redoRestores=saveProject(store.commands.getSnapshot())===final;
 row.pass=row.status==='completed'&&row.stateCorrect&&row.commits===1&&row.roundTrip&&row.undoRestores&&row.redoRestores&&(image.pixelEvidence?.foregroundPixels??0)>0;report.tasks.push(row);await api.save('progress.json',JSON.stringify(report,null,2));
 if(live&&session?.error?.includes('cap reached'))break;
 }
 if(!live){report.allScenesEquivalent=report.tasks.every(t=>JSON.stringify(t.normalized)===JSON.stringify(report.tasks[0].normalized));}
}catch(e){report.failures.push(String(e));}await api.done(report);
}void main();
