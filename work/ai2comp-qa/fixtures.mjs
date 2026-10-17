import fs from 'node:fs/promises';
import path from 'node:path';
import {deflateSync} from 'node:zlib';
export const crc32=(bytes)=>{let c=0xffffffff;for(const byte of bytes){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
const chunk=(name,data)=>{const type=Buffer.from(name),r=Buffer.alloc(data.length+12);r.writeUInt32BE(data.length);type.copy(r,4);data.copy(r,8);r.writeUInt32BE(crc32(Buffer.concat([type,data])),r.length-4);return r;};
export function png(w,h,pixel){const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;const rows=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)for(let x=0;x<w;x++)rows.set(pixel(x,y),y*(w*4+1)+x*4+1);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('sRGB',Buffer.from([0])),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
export async function fixtures(root){
 const rects=[{id:'background',name:'Background',bounds:{x:4,y:4,width:56,height:40},rgba:[0,0,255,255]},{id:'subject',name:'Subject',bounds:{x:8,y:9,width:24,height:18},rgba:[255,0,0,128]},{id:'foreground',name:'Foreground',bounds:{x:20,y:18,width:16,height:12},rgba:[0,255,0,128]}];
 const rgbaAt=(r,x,y)=>r.id!=='background'&&(x===r.bounds.x||y===r.bounds.y||x===r.bounds.x+r.bounds.width-1||y===r.bounds.y+r.bounds.height-1)?[...r.rgba.slice(0,3),64]:r.rgba;
 const inside=(x,y,b)=>x>=b.x&&x<b.x+b.width&&y>=b.y&&y<b.y+b.height;
 for(const type of ['A','B','C-path','C-corrupt','E-opacity']){
  const folder=path.join(root,type);await fs.mkdir(path.join(folder,'layers'),{recursive:true});
  const layers=[];
  for(const r of rects){const b=type==='A'?{x:0,y:0,width:64,height:48}:r.bounds;await fs.writeFile(path.join(folder,`layers/${r.id}.png`),png(b.width,b.height,(x,y)=>type==='A'?(inside(x,y,r.bounds)?rgbaAt(r,x,y):[0,0,0,0]):rgbaAt(r,x+b.x,y+b.y)));layers.push({id:r.id,name:r.name,type:'raster',asset:`layers/${r.id}.png`,bounds:b,opacity:1});}
  if(type==='E-opacity')layers[1].opacity=0.5;
  if(type==='C-path')layers[1].asset='../outside.png';
  if(type==='C-corrupt')await fs.writeFile(path.join(folder,'layers/subject.png'),Buffer.from('damaged PNG'));
  const manifest={format:'swayframe.layerpack',version:1,colorSpace:'srgb',alphaMode:'straight',order:'bottom-to-top',canvas:{width:64,height:48},layers};
  await fs.writeFile(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  await fs.writeFile(path.join(folder,'reference.png'),png(64,48,()=>[255,255,255,255]));
 }
 await fs.writeFile(path.join(root,'expected.png'),png(64,48,(x,y)=>{let color=[0,0,0,0];for(const r of rects){if(!inside(x,y,r.bounds))continue;const rgba=rgbaAt(r,x,y);const a=rgba[3]/255,b=color[3]/255,out=a+b*(1-a);color=[...rgba.slice(0,3).map((v,i)=>Math.round((v*a+color[i]*b*(1-a))/out)),Math.round(out*255)];}return color;}));
 return rects;
}
if(process.argv[1]?.endsWith('fixtures.mjs'))void fixtures(process.argv[2]??'docs/qa/ai2comp/packages').catch(error=>{console.error(error);process.exitCode=1;});
