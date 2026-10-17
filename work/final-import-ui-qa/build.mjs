import {build} from 'esbuild';import fs from 'node:fs/promises';import path from 'node:path';
const stage='work/final-import-ui-qa/.compiled/desktop-dist';await fs.mkdir(stage,{recursive:true});
await build({entryPoints:['work/final-import-ui-qa/main.ts'],outfile:stage+'/main.cjs',bundle:true,platform:'node',format:'cjs',external:['electron'],target:'node22'});
await build({entryPoints:['apps/desktop/electron/preload.ts'],outfile:stage+'/preload.cjs',bundle:true,platform:'node',format:'cjs',external:['electron'],target:'node22'});
await fs.appendFile(stage+'/preload.cjs',`\nrequire('electron').contextBridge.exposeInMainWorld('sfEditorQA',{call:(...a)=>require('electron').ipcRenderer.invoke('sf-editor-qa',...a)});\n`);
await build({entryPoints:['apps/desktop/electron/export-worker.ts'],outfile:stage+'/export-worker.cjs',bundle:true,platform:'node',format:'cjs',external:['electron'],target:'node22'});
await build({entryPoints:['work/final-import-ui-qa/renderer.tsx'],outfile:'work/final-import-ui-qa/renderer.js',bundle:true,platform:'browser',format:'iife',jsx:'automatic',loader:{'.md':'text'},define:{'import.meta.env.DEV':'false'}});

await fs.cp('public/branding','work/final-import-ui-qa/branding',{recursive:true});
