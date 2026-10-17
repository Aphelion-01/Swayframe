import {build} from 'esbuild';import fs from 'node:fs/promises';
const stage='work/mcp-qa/.compiled/desktop-dist';await fs.mkdir(stage,{recursive:true});
await build({entryPoints:['work/mcp-qa/main.ts'],outfile:stage+'/main.cjs',bundle:true,platform:'node',format:'cjs',external:['electron'],target:'node22'});
await fs.copyFile('desktop-dist/preload.cjs',stage+'/preload.cjs');
await fs.copyFile('desktop-dist/mcp-server.cjs',stage+'/mcp-server.cjs');
await fs.copyFile('desktop-dist/export-worker.cjs',stage+'/export-worker.cjs');
await fs.appendFile(stage+'/preload.cjs',`\nrequire('electron').contextBridge.exposeInMainWorld('sfMCPQA',{ready:()=>require('electron').ipcRenderer.send('sf-mcp-qa-ready'),onTask:f=>require('electron').ipcRenderer.on('sf-mcp-qa-task',(_,id,task,arg)=>f(id,task,arg)),reply:(id,r)=>require('electron').ipcRenderer.send('sf-mcp-qa-reply',id,r)});`);
await build({entryPoints:['work/mcp-qa/renderer.tsx'],outfile:'work/mcp-qa/renderer.js',bundle:true,platform:'browser',format:'iife',jsx:'automatic',loader:{'.md':'text'},define:{'import.meta.env.DEV':'false'}});
await fs.writeFile('work/mcp-qa/index.html','<!doctype html><html><head><meta charset="utf-8"><title>SF MCP real client acceptance</title><link rel="stylesheet" href="renderer.css"></head><body><div id="root"></div><script src="renderer.js"></script></body></html>');
