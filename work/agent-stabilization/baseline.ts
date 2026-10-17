import fs from 'node:fs/promises';
import { AgentOrchestrator } from '../../../0.10/src/agent/orchestrator';
import { AgentToolRegistry } from '../../../0.10/src/agent/tool-registry';
import { registerCoreWriteTools } from '../../../0.10/src/agent/write-tools';
import { creationCapabilities, resolveCreationDetails } from '../../../0.10/src/agent/creation-planner';
import { defaultAISettings } from '../../../0.10/src/ai/contracts';
import { createDefaultProject } from '../../../0.10/src/core/project-model';
const project = createDefaultProject(), registry = registerCoreWriteTools(new AgentToolRegistry());
const declarations: unknown[] = [], settings = defaultAISettings();
const runtime = { project: () => project, context: () => ({}), tools: () => registry.definitions(), readTools: () => [], inspect: async () => ({}), permission: (name: string, args: unknown) => registry.permission(name,args), validate: () => {}, begin: () => { throw Error('Must not write'); }, executionMetadata: () => ({skillIds: [], selectedCapabilities: registry.catalog().map(t=>t.name)}) };
const agent = new AgentOrchestrator(runtime, {chat: async (_task, request) => { declarations.push(request.tools?.map(t=>t.name)); return {text:'',model:'isolated-fixed-response',toolCalls:[{id:'write',name:'createRectangle',arguments:{}}]}; }}, () => settings);
await agent.run('创建一个矩形');
const plan = { id:'baseline',goal:'创建一个矩形',risk:'low' as const,steps:[{id:'rectangle',label:'矩形',tool:'createRectangle',arguments:{}}],creation:{intent:'创建一个矩形',tasks:[{id:'task',description:'矩形',executionDomain:'scene' as const,strategy:'reuse' as const,capabilityId:'shape.rectangle',stepIds:['rectangle'],dependencies:[]}],warnings:[]}};
let failure: unknown;
try {resolveCreationDetails(plan,registry,creationCapabilities(registry));} catch(e) { failure={...e as object,message:(e as Error).message}; }
await fs.writeFile('outputs/agent-stabilization/before.json',JSON.stringify({baseline:'d73a33e',evidence:'ISOLATED_FIXED_RESPONSE_REPRODUCTION; historical user request trace unavailable; not real Provider',A:{request:'创建一个矩形',provider:'fixture',model:'isolated-fixed-response',declarations,requestedTool:'createRectangle',reads:0,readLimit:12,session:agent.getSnapshot()},B:{request:'创建一个矩形',producer:'controlled submitPlan fixture',plan,registeredIds:creationCapabilities(registry).map(c=>c.id),failure}},null,2));
