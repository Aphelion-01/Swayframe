import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createPackage} from '@electron/asar';
const stage='work/agent-v2-7/live-product-stage';
await fs.mkdir(path.join(stage,'desktop-dist'),{recursive:true});
await build({entryPoints:['work/agent-v2-7/live-product-host.ts'],outfile:path.join(stage,'desktop-dist/main.cjs'),bundle:true,platform:'node',format:'cjs',external:['electron'],define:{'import.meta.url':'undefined'}});
await build({entryPoints:['apps/desktop/electron/preload.ts'],outfile:path.join(stage,'desktop-dist/preload.cjs'),bundle:true,platform:'node',format:'cjs',external:['electron']});
await fs.appendFile(path.join(stage,'desktop-dist/preload.cjs'),`\nconst qaElectron=require('electron');qaElectron.contextBridge.exposeInMainWorld('live',Object.fromEntries(['case','turn','save','progress','shot','stopped','mode','remaining','render','done'].map(method=>[method,(...args)=>qaElectron.ipcRenderer.invoke('live:'+method,...args)])));\n`);
await fs.copyFile('desktop-dist/export-worker.cjs',path.join(stage,'desktop-dist/export-worker.cjs'));
await fs.copyFile('package.json',path.join(stage,'package.json'));
await createPackage(stage,'work/agent-v2-7/live-native/Swayframe.app/Contents/Resources/app.asar');

await build({entryPoints:['work/agent-v2-7/live-renderer.tsx'],outfile:'work/agent-v2-7/live-renderer.js',bundle:true,platform:'browser',format:'iife',loader:{'.md':'text'},jsx:'automatic',define:{'import.meta.env.DEV':'false'}});
