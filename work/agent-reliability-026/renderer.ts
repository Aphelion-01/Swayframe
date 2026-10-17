import {AIError} from '../../src/ai/contracts';
import {AgentTransaction} from '../../src/agent/transaction';
import {AgentToolRegistry} from '../../src/agent/tool-registry';
import {registerCoreWriteTools} from '../../src/agent/write-tools';
import { EditorStore } from '../../src/ui/editor-store';
import { createNativeAgent } from '../../src/ui/native-agent-controller';
import { AIProviderManager } from '../../src/ai/provider-manager';
import { createDefaultProject, activeComposition } from '../../src/core/project-model';
import { saveProject,loadProject } from '../../src/core/project-io';
import { AgentSnapshotRenderer } from '../../src/agent/vision';
import {audioPreviewUrl} from '../../src/importers/audio-preview';
import { mediaMetadata } from '../../src/importers/media-metadata';
import { decodeAudioBlob } from '../../src/importers/audio-decode';
import { importImageFile } from '../../src/ui/asset-import';
import { mixCompositionAudio } from '../../src/renderers/audio-mix';
const api=(window as any).bench;
async function main(){
 const report:any={realProvider:!new URL(location.href).searchParams.has('offline'),failures:[]};
 try {
  const bytes=new Uint8Array(await api.fixture()); const blob=new Blob([bytes],{type:'audio/flac'});
  report.flac={metadata:await mediaMetadata(blob),decodedDuration:(await decodeAudioBlob(blob)).duration};
  const audioStore=new EditorStore(createDefaultProject());
  await importImageFile(audioStore,new File([blob],'tone.flac',{type:'audio/flac'}));
  const a=audioStore.getSnapshot().project;
  const mix=await mixCompositionAudio(a,activeComposition(a),0,1);
  report.flac.imported=a.assets.length===1 && activeComposition(a).layers.some(l=>l.type==='audio');
  report.flac.exportDuration=mix?.duration;
  report.flac.saveReload=loadProject(saveProject(a)).assets.length===1;
  audioStore.commands.undo();report.flac.undo=audioStore.getSnapshot().project.assets.length===0;
 }catch(e){report.failures.push('FLAC: '+String(e));}
 try {const blob=new Blob([new Uint8Array(await api.fixture('aiff'))],{type:'audio/aiff'});report.aiff={metadata:await mediaMetadata(blob),decodedDuration:(await decodeAudioBlob(blob)).duration};const input=URL.createObjectURL(blob);const preview=await audioPreviewUrl(input,'audio/aiff');const audio=new Audio(preview);await new Promise<void>((resolve,reject)=>{audio.onloadedmetadata=()=>resolve();audio.onerror=()=>reject(Error('PCM preview failed'));setTimeout(()=>reject(Error('audio timeout')),5000);});report.aiff.previewDuration=audio.duration;URL.revokeObjectURL(input);URL.revokeObjectURL(preview);}catch(e){report.failures.push('AIFF: '+String(e));}
 try {const store=new EditorStore(createDefaultProject());const reg=registerCoreWriteTools(new AgentToolRegistry());const tx=new AgentTransaction(store.commands,reg,store.getSnapshot().project,{time:0,selection:[]});const signal=new AbortController().signal;let failed;try{reg.permission('createText',{content:22,fontSize:-1});}catch(e){failed=e;}await tx.execute('createText',{content:'Cubic',fontFamily:'serif',fontSize:90,alignment:'center',position:{x:960,y:480},color:{r:0,g:0.1,b:0.1,a:1}},signal);await tx.execute('createText',{content:'立方渐变',fontSize:28,position:{x:960,y:570},alignment:'center',color:{r:0,g:0.1,b:0.1,a:1}},signal);tx.commit('Benchmark A');const project=store.commands.getSnapshot();await api.save('text-benchmark.swayframe',saveProject(project));const image=(await new AgentSnapshotRenderer().render(project,0,signal)).image;await api.saveImage('text-benchmark.png',image);const canvas=document.createElement('canvas');const bitmap=await createImageBitmap(await(await fetch(image)).blob());canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d')!.drawImage(bitmap,0,0);const pixels=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let changed=0;for(let i=4;i<pixels.length;i+=4)if(pixels[i]!==pixels[0]||pixels[i+1]!==pixels[1]||pixels[i+2]!==pixels[2])changed++;report.textBenchmark={visibleNonuniformPixels:changed,unicode:activeComposition(project).layers.some(l=>l.type==='text'&&l.text==='立方渐变'),saveReload:loadProject(saveProject(project)).compositions.length===1,structuredError:!!failed?.details};}catch(e){report.failures.push('Text adapter: '+String(e));}

 try {
  const store=new EditorStore(createDefaultProject());const reg=registerCoreWriteTools(new AgentToolRegistry());const tx=new AgentTransaction(store.commands,reg,store.getSnapshot().project,{time:0,selection:[]});const signal=new AbortController().signal;
  await tx.execute('createPath',{layerId:'00000000-0000-4000-8000-000000000001',width:400,height:300,position:{x:960,y:540},points:[-200,-150,-200,-150,-200,-150,200,-100,200,-100,200,-100,180,150,180,150,180,150,-200,100,-200,100,-200,100]},signal);
  await tx.execute('setFill',{layerId:'00000000-0000-4000-8000-000000000001',color:{r:0,g:0.5,b:0.5,a:1},gradient:'radial',radialParameters:{center:{x:0.25,y:0.3},radius:0.8,stops:[0,0.1,0.8,0.8,1,1,0,0.1,0.1,1]}},signal);
  tx.commit('原生路径渐变渲染检查');const image=(await new AgentSnapshotRenderer().render(store.getSnapshot().project,0,signal)).image;await api.saveImage('native-fill.png',image);
  const bitmap=await createImageBitmap(await(await fetch(image)).blob());const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0);const sample=(x,y)=>[...ctx.getImageData(Math.round(x*bitmap.width/1920),Math.round(y*bitmap.height/1080),1,1).data];const a=sample(870,475),b=sample(1120,605);report.nativeFill={center:a,edge:b,gradientVisible:a[1]>b[1]+30,geometry:sample(1155,400)};
  if(!report.nativeFill.gradientVisible)throw Error('native gradient not visible');
 }catch(e){report.failures.push('Native fill render: '+String(e));}
 if (new URL(location.href).searchParams.has('offline')) { await api.done(report); return; }

 try {
  const settings=await api.settings();
  const provider=settings.providers.find(p=>p.name==='DeepSeek'&&p.enabled);
  if(!provider)throw Error('已授权的 DeepSeek 服务不存在');
  const route={providerId:provider.id,modelId:'deepseek-flash'};
  settings.defaultProviderId=provider.id;settings.routing={general:route,planning:route,vision:route};
  settings.privacy={...settings.privacy,sendReferences:true,sendRenderPreview:true,saveHistory:false};
  settings.agent={...settings.agent,visualVerification:true,maxRefinements:2,autoApplySafe:false,streaming:false,mode:'AGENT'};
  const data=new Map();
  const manager=new AIProviderManager({loadSettings:async()=>settings,saveSettings:async()=>{},setCredentials:async()=>{},removeCredentials:async()=>{},hasCredentials:(id)=>api.has(id),storageStatus:async()=>'secure',readData:async(k)=>data.get(k),writeData:async(k,v)=>{data.set(k,v);}}, {chat:async(p,r,s)=>{s?.throwIfAborted();const res=await api.chat(p.id,r);s?.throwIfAborted();if(res.benchError)throw new AIError(res.benchError.code,res.benchError.message);return res;},listModels:async()=>[],testConnection:async()=>({ok:true,message:'not tested'})});
  await manager.initialize();
  const vision=manager.resolve('vision');report.visionModel=vision.model;
  const p=createDefaultProject();const base={...p,compositions:p.compositions.map(c=>({...c,width:820,height:460}))};
  const store=new EditorStore(base);const {agent}=createNativeAgent(store,manager);
  agent.setReferences([{id:crypto.randomUUID(),name:'Cubic Gradient',kind:'image',frames:[await api.reference()]}],'overall');
  await agent.run('请依据参考像素复刻这张 Cubic 立方渐变图。先读取参考并分解背景、立方体正面/深色右侧面、渐变、柔边、柔和投影、Cubic 标题及“立方渐变”副标题。查找已有能力。通过原生可编辑透视路径、渐变、Gaussian Blur 和原生文字重建，勿导入参考图冒充结果，勿删除其他作品。合成820×460。原图410×230。包含细线装饰。先完成主体再排版，渲染比对后最多3轮局部修正。');
  await api.save('initial-session.json',JSON.stringify(agent.getSnapshot(),null,2));
  const plan=agent.getSnapshot().currentPlan;
  if(!plan||agent.getSnapshot().error)throw Error(agent.getSnapshot().error??'无计划');
  await agent.preview(plan.id);
  const state=agent.getSnapshot();
  await api.save('preview-session.json',JSON.stringify(state,null,2));
  if(state.error||!state.previewSnapshot)throw Error(state.error??'无实际渲染预览');
  await api.saveImage('cubic-preview.png',state.previewSnapshot);
  await agent.apply(plan.id);
  if(agent.getSnapshot().status!=='completed')throw Error(agent.getSnapshot().error??'提交失败');
  const created=store.getSnapshot().project;
  await api.save('cubic.swayframe',saveProject(created));
  report.reconstruction={status:'completed',layers:activeComposition(created).layers.map(l=>({id:l.id,name:l.name,type:l.type})),assessment:state.verification,saveReload:loadProject(saveProject(created)).compositions.length===created.compositions.length};
  const textBefore=JSON.stringify(activeComposition(created).layers.filter(l=>l.type==='text'));
  await agent.run('立方体右侧太亮了，整体边缘再柔和一些，不要修改文字。仅修改已有右侧图层颜色或渐变参数及已有模糊参数，保留所有文字内容、位置、字体。');
  const refine=agent.getSnapshot().currentPlan;
  if(agent.getSnapshot().error||!refine)throw Error(agent.getSnapshot().error??'无修正计划');
  await agent.preview(refine.id);const correction=agent.getSnapshot();
  await api.save('refinement-session.json',JSON.stringify(correction,null,2));
  if(correction.error)throw Error(correction.error);
  await agent.apply(refine.id);
  const final=store.getSnapshot().project;
  report.refinement={textPreserved:JSON.stringify(activeComposition(final).layers.filter(l=>l.type==='text'))===textBefore};
  await api.save('cubic-refined.swayframe',saveProject(final));
  await api.saveImage('cubic-refined.png',(await new AgentSnapshotRenderer().render(final,0,new AbortController().signal)).image);
  store.commands.undo();report.refinement.undo=JSON.stringify(store.getSnapshot().project)===JSON.stringify(created);
 }catch(e){report.failures.push('Agent: '+String(e));}
 await api.done(report);
}
void main();
