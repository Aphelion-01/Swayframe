import {build} from 'esbuild';import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';
await fs.mkdir('work/image-layers-qa/.compiled',{recursive:true});
await build({entryPoints:['apps/desktop/electron/image-layers.ts','apps/desktop/electron/files.ts'],outdir:'work/image-layers-qa/.compiled',bundle:true,platform:'node',format:'esm'});
const {LocalImageLayers}=await import(pathToFileURL(path.resolve('work/image-layers-qa/.compiled/image-layers.js')));
const {FileGrants}=await import(pathToFileURL(path.resolve('work/image-layers-qa/.compiled/files.js')));
const root=path.resolve('docs/qa/segmentation/generated');await fs.mkdir(root,{recursive:true});
const grants=new FileGrants(),generator=new LocalImageLayers(grants,path.resolve('desktop-dist/sf-segment-image'));grants.grantWrite(root);
const records=[];
for(const name of ['A-chelsea','B-astronaut','C-coffee']){
 const input=grants.grantRead(path.resolve('docs/qa/segmentation/inputs/'+name+'.png'));const start=Date.now();
 try{const result=await generator.generate(input,root,randomUUID());records.push({name,pass:true,milliseconds:Date.now()-start,...result});}catch(e){records.push({name,pass:false,error:String(e)});}
}
await fs.writeFile('docs/qa/segmentation/generation.json',JSON.stringify(records,null,2));console.log(records.map(({name,pass,milliseconds,error})=>({name,pass,milliseconds,error})));if(records.some(r=>!r.pass))process.exitCode=1;
