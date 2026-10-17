import {spawn} from 'node:child_process';import fs from 'node:fs/promises';import path from 'node:path';import electron from 'electron';
const run=process.argv[2]??`run-${Date.now()}`;if(!/^[a-z0-9-]+$/.test(run))throw Error('Invalid run');
const out=path.resolve('docs/qa/ai2comp/runs',run);try{await fs.access(out);throw Error('Never overwrite existing QA evidence');}catch(e){if(e.code!=='ENOENT')throw e;}
const exec=(cmd,args,env=process.env)=>new Promise((resolve,reject)=>{const p=spawn(cmd,args,{stdio:'inherit',env});p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error(`${cmd} exited ${c}`)));});
await exec(process.execPath,['work/ai2comp-qa/fixtures.mjs']);await exec(process.execPath,['work/ai2comp-qa/build.mjs']);
const env={...process.env,SF_QA_RUN:run,SWAYFRAME_USER_DATA:path.resolve('work/ai2comp-qa/profiles',run)};
await exec(electron,['work/ai2comp-qa/.compiled/desktop-dist/main.cjs'],env);
await exec(electron,['work/ai2comp-qa/.compiled/desktop-dist/main.cjs','--reopen-only'],env);
console.log('LAYERPACK_REAL_ACCEPTANCE_PASS',out);
