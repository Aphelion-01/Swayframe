import fs from 'node:fs';
import { AgentToolRegistry } from '../../src/agent/tool-registry';
import { registerCoreWriteTools } from '../../src/agent/write-tools';
import { AgentTransaction } from '../../src/agent/transaction';
import { createDefaultProject } from '../../src/core/project-model';
import { CommandSystem } from '../../src/core/command-system';
import { AgentToolRegistry as OldRegistry } from '../../../0.9.27/src/agent/tool-registry';
import { registerCoreWriteTools as oldWrites } from '../../../0.9.27/src/agent/write-tools';
import { AgentTransaction as OldTransaction } from '../../../0.9.27/src/agent/transaction';
const args={layerId:'create_background',color:{r:0,g:0.3,b:1,a:1},gradient:'radial'};
const plan={id:'controlled-reproduction',goal:'Create and fill',risk:'low' as const,steps:[{id:'create_background',label:'create',tool:'createRectangle',arguments:{}},{id:'fill',label:'fill',tool:'setFill',arguments:args}]};
async function check(registry:AgentToolRegistry|OldRegistry, Draft:typeof AgentTransaction|typeof OldTransaction, semantic:boolean) {
 const host=new CommandSystem(createDefaultProject()); const ctx={project:host.getSnapshot(),selection:[],time:0}; const draft=new Draft(host,registry,ctx.project,ctx);
 let error:unknown; try{registry.validatePlan(plan,undefined,ctx);}catch(e){error={message:(e as Error).message,...e as object};}
 const created=await draft.execute('createRectangle',{},new AbortController().signal,'create_background');
 if(semantic) await draft.execute('setFill',{...args,layerId:{kind:'stepResult',stepId:'create_background',output:'layerId'}},new AbortController().signal,'fill');
 return {controlledFixture:true,historicalRawArgumentsUnavailable:true,rawArguments:args,validationError:error,createResult:created,draftLayerIds:draft.getSnapshot().compositions[0]!.layers.map(l=>l.id),formalSceneUnchanged:host.getSnapshot()===ctx.project};
}
const before=await check(oldWrites(new OldRegistry()),OldTransaction,false); const after=await check(registerCoreWriteTools(new AgentToolRegistry()),AgentTransaction,true);
fs.writeFileSync('outputs/object-reference-028/baseline-before-after.json',JSON.stringify({before,after},null,2));
