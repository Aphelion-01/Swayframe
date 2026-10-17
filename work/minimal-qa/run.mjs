import {spawn} from 'node:child_process';import fs from 'node:fs/promises';import path from 'node:path';import electron from 'electron';
const run=process.argv[2]??`run-${Date.now()}`;if(!/^[a-z0-9-]+$/.test(run))throw Error('Use a new simple run name');
const out=path.resolve('docs/qa/evidence',run);try{await fs.access(path.join(out,'report.json'));throw Error('Existing run evidence must not be overwritten');}catch(e){if(e.code!=='ENOENT')throw e;}
const execute=(program,args,env=process.env)=>new Promise((resolve,reject)=>{const p=spawn(program,args,{stdio:'inherit',env});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(`${program} exited ${code}`)));});
await execute(process.execPath,['work/minimal-qa/minimal-build.mjs']);
const env={...process.env,SF_QA_RUN:run,SWAYFRAME_USER_DATA:path.resolve('work/minimal-qa/profiles',run)};
await execute(electron,['work/minimal-qa/.compiled/desktop-dist/main.cjs'],env);
await execute(electron,['work/minimal-qa/.compiled/desktop-dist/main.cjs','--reopen-only'],env);
console.log('REAL_ACCEPTANCE_PASS',out);
