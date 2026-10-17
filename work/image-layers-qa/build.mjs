import {build} from 'esbuild';import fs from 'node:fs/promises';
const dir='work/image-layers-qa/.compiled/desktop-dist';await fs.mkdir(dir,{recursive:true});
await build({entryPoints:['work/image-layers-qa/main.ts'],outfile:dir+'/main.cjs',bundle:true,platform:'node',format:'cjs',external:['electron'],target:'node22'});
for(const name of ['preload.cjs','export-worker.cjs','mcp-server.cjs','sf-segment-image'])await fs.copyFile('desktop-dist/'+name,dir+'/'+name);
await fs.chmod(dir+'/sf-segment-image',0o755);
await fs.appendFile(dir+'/preload.cjs',`\nrequire('electron').contextBridge.exposeInMainWorld('sfImageLayersQA',{call:(...args)=>require('electron').ipcRenderer.invoke('sf-image-layers-qa',...args)});`);
await build({entryPoints:['work/image-layers-qa/renderer.tsx'],outfile:'work/image-layers-qa/renderer.js',bundle:true,platform:'browser',format:'iife',jsx:'automatic',loader:{'.md':'text'},define:{'import.meta.env.DEV':'false'}});
await fs.writeFile('work/image-layers-qa/index.html','<!doctype html><html><head><meta charset="utf-8"><title>SF Local Image Layers QA</title><link rel="stylesheet" href="renderer.css"></head><body><div id="root"></div><script src="renderer.js"></script></body></html>');
await fs.cp('public/branding','work/image-layers-qa/branding',{recursive:true});
