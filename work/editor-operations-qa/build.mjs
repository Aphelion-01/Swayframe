import {build} from 'esbuild';import fs from 'node:fs/promises';import path from 'node:path';
const stage='work/editor-operations-qa/.compiled/desktop-dist';await fs.mkdir(stage,{recursive:true});
await build({entryPoints:['work/editor-operations-qa/main.ts'],outfile:stage+'/main.cjs',bundle:true,platform:'node',format:'cjs',external:['electron'],target:'node22'});
await build({entryPoints:['apps/desktop/electron/preload.ts'],outfile:stage+'/preload.cjs',bundle:true,platform:'node',format:'cjs',external:['electron'],target:'node22'});
await fs.appendFile(stage+'/preload.cjs',`\nrequire('electron').contextBridge.exposeInMainWorld('sfOpsQA',{call:(...a)=>require('electron').ipcRenderer.invoke('sf-ops-qa',...a)});\n`);
await build({entryPoints:['apps/desktop/electron/export-worker.ts'],outfile:stage+'/export-worker.cjs',bundle:true,platform:'node',format:'cjs',external:['electron'],target:'node22'});
await build({entryPoints:['work/editor-operations-qa/renderer.tsx'],outfile:'work/editor-operations-qa/renderer.js',bundle:true,platform:'browser',format:'iife',jsx:'automatic',loader:{'.md':'text'},define:{'import.meta.env.DEV':'false'}});


