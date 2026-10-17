import {build} from 'esbuild';
await build({entryPoints:['work/agent-v2-7/live-main.ts'],outfile:'work/agent-v2-7/live-main.cjs',bundle:true,platform:'node',format:'cjs',external:['electron']});
await build({entryPoints:['work/agent-v2-7/live-renderer.tsx'],outfile:'work/agent-v2-7/live-renderer.js',bundle:true,platform:'browser',format:'iife',loader:{'.md':'text'},jsx:'automatic',define:{'import.meta.env.DEV':'false'}});
