import {build} from 'esbuild';import fs from 'node:fs/promises';
await build({entryPoints:['work/mcp-qa/production.ts'],outfile:'work/mcp-qa/.compiled/desktop-dist/production.cjs',bundle:true,platform:'node',format:'cjs',target:'node22',external:['electron']});
for(const name of ['preload','export-worker','mcp-server'])await fs.copyFile('desktop-dist/'+name+'.cjs','work/mcp-qa/.compiled/desktop-dist/'+name+'.cjs');
