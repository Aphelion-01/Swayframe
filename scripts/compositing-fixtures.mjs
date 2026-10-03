import { build } from 'esbuild';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const code = `
import {writeFileSync, mkdirSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {createDefaultProject,createComposition,createLayer} from './src/core/project-model';
import {createEffect} from './src/core/effect-model';
import {newId} from './src/core/core-types';
import {saveProject} from './src/core/project-io';
import {insertGraphNode,addGraphNode,connectPorts,disconnectEdge} from './src/core/compositing-operations';
import {createNode} from './src/core/compositing-registry';
import {crc32} from './src/core/zip-archive';
const width=400,height=240,scan=Buffer.alloc(height*(width*4+1));
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const i=y*(width*4+1)+1+x*4,inside=(x>35&&x<365&&y>35&&y<205),checker=(Math.floor(x/24)+Math.floor(y/24))%2;
 scan[i]=checker?110:35;scan[i+1]=checker?50:100;scan[i+2]=checker?80:145;scan[i+3]=inside?255:0;
}
function chunk(type,data){const tag=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,data])));return Buffer.concat([size,tag,data,crc]);}
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
const asset={id:newId(),name:'节点验收图.png',mimeType:'image/png' as const,dataUrl:'data:image/png;base64,'+png.toString('base64')};
const composition=createComposition({name:'合成节点验收',width:960,height:540,duration:3}),p=createDefaultProject(composition),l=createLayer('image',{assetId:asset.id,name:'节点验收图',width,height,position:{x:480,y:270}});
const base={...p,name:'合成节点验收示例',assets:[asset],compositions:[{...composition,layers:[l]}]};
mkdirSync('outputs/compositing',{recursive:true});
const save=(name,layer)=>writeFileSync('outputs/compositing/'+name+'.swayframe',saveProject({...base,compositions:[{...composition,layers:[layer]}]}));
save('source',l);
const a=insertGraphNode(l.editor!.graph!,'exposure'),b=insertGraphNode(a.graph,'gaussianBlur');
const animated={...b.graph,nodes:b.graph.nodes.map(n=>n.id===a.node.id?{...n,params:{exposure:{...n.params.exposure!,baseValue:0.5}}}:n.id===b.node.id?{...n,params:{radius:{...n.params.radius!,keyframes:[{id:newId(),time:0,value:0,interpolation:{type:'linear' as const}},{id:newId(),time:1,value:30,interpolation:{type:'linear' as const}}]}}}:n)};
save('linear',{...l,editor:{...l.editor!,graph:animated}});
const solid={...createNode('solid',{x:260,y:200}),params:{color:{...createNode('solid').params.color!,baseValue:[0.08,0.16,0.22,1]}}},merge=createNode('merge',{x:500,y:80});
let g=disconnectEdge(l.editor!.graph!,l.editor!.graph!.edges[0]!.id);g=addGraphNode(addGraphNode(g,solid),merge);
for(const [from,fp,to,tp] of [[g.nodes[0]!.id,'out',merge.id,'a'],[solid.id,'out',merge.id,'b'],[merge.id,'out',g.outputNodeId,'in']])g=connectPorts(g,{nodeId:from,portId:fp},{nodeId:to,portId:tp});
save('merge',{...l,editor:{...l.editor!,graph:g}});
const effects=[createEffect('exposure'),createEffect('gaussianBlur')];
effects[0]={...effects[0],parameters:{exposure:{...effects[0]!.parameters.exposure!,baseValue:0.5}}};effects[1]={...effects[1],parameters:{radius:{...effects[1]!.parameters.radius!,baseValue:12}}};
writeFileSync('outputs/compositing/legacy-effects.swayframe',JSON.stringify({...base,schemaVersion:'0.4.0',compositions:[{...composition,layers:[{...l,editor:{...l.editor,graph:undefined,effects}}]}]},null,2));
writeFileSync('outputs/compositing/节点验收图.png',png);
`;
const result = await build({
  stdin: { contents: code, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const path = join(tmpdir(), 'swayframe-compositing-fixtures.mjs');
await mkdir('outputs/compositing', { recursive: true });
await writeFile(path, result.outputFiles[0].contents);
await import(path);
