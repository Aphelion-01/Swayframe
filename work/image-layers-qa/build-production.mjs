import {build} from 'esbuild';import fs from 'node:fs/promises';
const dir='work/image-layers-qa/.compiled/production';await fs.mkdir(dir,{recursive:true});
await build({entryPoints:['work/image-layers-qa/production.ts'],outfile:dir+'/main.cjs',bundle:true,platform:'node',format:'cjs',external:['electron'],target:'node22'});
for(const name of ['preload.cjs','export-worker.cjs','mcp-server.cjs'])await fs.copyFile('desktop-dist/'+name,dir+'/'+name);
await fs.copyFile(process.env.SF_PACKAGED_HELPER??'desktop-dist/sf-segment-image',dir+'/sf-segment-image');await fs.chmod(dir+'/sf-segment-image',0o755);
