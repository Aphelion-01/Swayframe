import {build} from 'esbuild';import fs from 'node:fs/promises';
const dir='work/final-separation-qa/.compiled/desktop-dist';await fs.mkdir(dir,{recursive:true});
await build({entryPoints:['work/final-separation-qa/main.ts'],outfile:dir+'/main.cjs',bundle:true,platform:'node',format:'cjs',external:['electron'],target:'node22'});
for(const name of ['preload.cjs','export-worker.cjs','mcp-server.cjs','sf-segment-image'])await fs.copyFile('desktop-dist/'+name,dir+'/'+name);
await fs.chmod(dir+'/sf-segment-image',0o755);
await fs.appendFile(dir+'/preload.cjs',`\nrequire('electron').contextBridge.exposeInMainWorld('sfImageLayersQA',{call:(...args)=>require('electron').ipcRenderer.invoke('sf-image-layers-qa',...args)});`);
await build({entryPoints:['work/final-separation-qa/renderer.tsx'],outfile:'work/final-separation-qa/renderer.js',bundle:true,platform:'browser',format:'iife',jsx:'automatic',loader:{'.md':'text'},define:{'import.meta.env.DEV':'false'}});
await fs.writeFile('work/final-separation-qa/index.html','<!doctype html><html><head><meta charset="utf-8"><title>SF Local Image Layers QA</title><link rel="stylesheet" href="renderer.css"></head><body><div id="root"></div><script src="renderer.js"></script></body></html>');
await fs.cp('public/branding','work/final-separation-qa/branding',{recursive:true});
