import {spawn} from 'node:child_process';import fs from 'node:fs/promises';import path from 'node:path';
const electron=process.env.SF_ELECTRON;if(!electron)throw Error('SF_ELECTRON required');const root=path.resolve('docs/qa/ai-final');const results=[];
async function run(id,cmd,args,env={}){const log=await fs.open(path.join(root,id+'.log'),'w');let child;const start=Date.now();try{const code=await new Promise((resolve,reject)=>{child=spawn(cmd,args,{env:{...process.env,...env},stdio:['ignore',log.fd,log.fd]});child.once('error',reject);const timer=setTimeout(()=>{child.kill('SIGKILL');},150000);child.once('exit',(code,signal)=>{clearTimeout(timer);resolve({code,signal});});});results.push({id,...code,milliseconds:Date.now()-start});await fs.writeFile(path.join(root,'process-results.json'),JSON.stringify(results,null,2));console.log(id,JSON.stringify(code));}finally{await log.close();}}
const profile=id=>({SWAYFRAME_USER_DATA:'/private/tmp/sf-ai-final-'+id});
await run('native',electron,['work/final-native-qa/.compiled/desktop-dist/main.cjs'],{...profile('native'),SF_QA_RUN:'current'});
await run('native-reopen',electron,['work/final-native-qa/.compiled/desktop-dist/main.cjs','--reopen-only'],{...profile('native'),SF_QA_RUN:'current'});
await run('cross-client',process.execPath,['work/final-cross-qa/client.mjs'],{...profile('cross'),SF_EXTERNAL_OUT:'docs/qa/ai-final/cross/run'});
await run('import-ui',electron,['work/final-import-ui-qa/.compiled/desktop-dist/main.cjs'],{...profile('import-ui'),SF_QA_AUTOMATED:'1'});
await run('import-ui-reopen',electron,['work/final-import-ui-qa/.compiled/desktop-dist/main.cjs'],{...profile('import-ui-reopen'),SF_QA_AUTOMATED:'1',SF_QA_REOPEN:'1'});
await run('import-ui-close',electron,['work/final-import-ui-qa/.compiled/desktop-dist/main.cjs'],{...profile('import-ui-close'),SF_QA_AUTOMATED:'1',SF_QA_CLOSE:'1'});
await run('mcp',electron,['work/final-mcp-qa/.compiled/desktop-dist/main.cjs'],{...profile('mcp'),SF_MCP_QA_OUT:'docs/qa/ai-final/mcp/current'});
await run('mcp-close',process.execPath,['work/final-mcp-qa/close-parent.mjs']);
await run('separation',electron,['work/final-separation-qa/.compiled/desktop-dist/main.cjs'],{...profile('separation'),SF_IMAGE_QA_OUT:'docs/qa/ai-final/separation/current'});
if(results.some(r=>r.code!==0))process.exitCode=1;
