import {spawn} from 'node:child_process';import {Client} from '@modelcontextprotocol/client';import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';import {randomUUID} from 'node:crypto';import fs from 'node:fs/promises';import path from 'node:path';import net from 'node:net';
const out=path.resolve('docs/qa/segmentation/mcp-exit-regression/window-close'),electron=process.env.SF_ELECTRON;
if(!electron)throw Error('SF_ELECTRON required');
await fs.mkdir(out,{recursive:true});
const child=spawn(electron,['work/image-layers-exit-qa/.compiled/desktop-dist/main.cjs'],{cwd:process.cwd(),env:{...process.env,SF_MCP_CLOSE_ONLY:'1',SF_MCP_QA_OUT:out,SWAYFRAME_USER_DATA:'/private/tmp/sf-v01-close-parent'},stdio:['ignore','pipe','pipe','ipc']});
const events=[],waiting=new Map();let logs='';child.stderr.on('data',c=>logs+=String(c));child.stdout.on('data',c=>logs+=String(c));
child.on('message',m=>{events.push(m);waiting.get(m.kind)?.(m);waiting.delete(m.kind);});
function event(kind){const existing=events.find(e=>e.kind===kind);if(existing)return Promise.resolve(existing);return new Promise((resolve,reject)=>{waiting.set(kind,resolve);setTimeout(()=>reject(Error('Event timeout '+kind)),15000).unref();});}
const exited=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
const limit=(p,ms,label)=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(Error(label)),ms).unref())]);
let client;const records=[];
try{
 const cfg=await event('ready'),before=await fs.readFile(cfg.project,'utf8');
 client=new Client({name:'sf-independent-close-client',version:'0.1.0'},{versionNegotiation:{mode:{pin:'2026-07-28'}}});await client.connect(new StdioClientTransport(cfg.config));
 const info=await client.callTool({name:'sf_project_info',arguments:{}});const context=JSON.parse(info.content[0].text).context;records.push('independent-node-client-connected');
 child.send({kind:'arm'});await event('armed');
 const pending=client.callTool({name:'sf_import_layer_package',arguments:{...context,requestId:randomUUID(),compositionId:cfg.ids.compositionId,directory:cfg.directory}}).then(()=>({returned:true}),error=>({rejected:true,error:String(error)}));
 await event('reader-ready');records.push('real-native-import-return-paused');child.send({kind:'destroy'});
 const exit=await limit(exited,10000,'Editor did not exit');records.push('editor-exited');
 await limit(client.close(),8000,'Client close hung');const outcome=await limit(pending,2000,'Late request unresolved');
 const refused=await new Promise(resolve=>{const socket=net.connect(Number(cfg.config.env.SF_MCP_PORT),'127.0.0.1');socket.once('error',()=>resolve(true));socket.once('connect',()=>{socket.destroy();resolve(false);});});if(!refused)throw Error('Listener retained');records.push('listener-released');
 if(await fs.readFile(cfg.project,'utf8')!==before)throw Error('Closed import changed saved project');records.push('saved-project-unchanged');
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify({pass:true,records,exit,outcome,protocol:'2026-07-28',topology:'independent Node client -> stdio child -> Electron editor'},null,2));
 console.log('WINDOW_CLOSE_PASS',records);
}catch(error){child.kill('SIGKILL');await client?.close().catch(()=>{});await fs.writeFile(path.join(out,'report.json'),JSON.stringify({pass:false,records,error:String(error)},null,2));process.exitCode=1;}
await fs.writeFile(path.join(out,'client.log'),logs.replace(/[a-f0-9]{64}/g,'[HASH]'));
