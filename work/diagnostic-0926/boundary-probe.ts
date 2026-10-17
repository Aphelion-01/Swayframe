import fs from 'node:fs';
import { CommandSystem, command, transaction } from '../../src/core/command-system';
import { createDefaultProject, createLayer } from '../../src/core/project-model';
import { AgentToolRegistry } from '../../src/agent/tool-registry';
import { registerCoreWriteTools } from '../../src/agent/write-tools';
const registry = registerCoreWriteTools(new AgentToolRegistry());
const host = new CommandSystem(createDefaultProject());
const layer = createLayer('rectangle');
host.executeTransaction(transaction('诊断用独立图层','agent',[command({type:'layer.create',compositionId:host.getSnapshot().activeCompositionId,layer})]));
const context = {project:host.getSnapshot(),time:0,selection:[]};
const report:any={baseVersion:'0.9.26',originalWorkspaceTouched:false};
const args = {layerId:layer.id,color:{r:0,g:1,b:1,a:1},gradient:'radial',radialParameters:{radius:-1}};
report.radialValidation={preflightPermission:registry.permission('setFill',args)};
try{registry.compile('setFill',args,context);}catch(e){report.radialValidation.compileError={code:(e as any).code,message:(e as Error).message,hasStructuredFields:!!(e as any).details?.issues};}
const frame={id:crypto.randomUUID(),time:0,value:{x:0,y:0},interpolation:{type:'linear' as const}};
const commands=[command({type:'keyframe.add',propertyId:layer.transform.position.id,keyframe:frame}),command({type:'keyframe.update',propertyId:layer.transform.position.id,keyframeId:frame.id,patch:{value:{x:10,y:0}}})];
report.compositeKeyframe={transaction:host.executeTransaction(transaction('添加后调整关键帧','agent',commands))};
try{registry.verifyResults(commands,host.getSnapshot());report.compositeKeyframe.postflight='accepted';}catch(e){report.compositeKeyframe.postflight='rejected';report.compositeKeyframe.error=(e as Error).message;}
fs.writeFileSync('outputs/diagnostic-0926/boundary-probe.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
