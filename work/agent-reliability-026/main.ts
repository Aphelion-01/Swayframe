import {app,BrowserWindow,ipcMain} from 'electron';
import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {NativeAIService} from '../../apps/desktop/electron/ai-service';
async function main(){
app.setName('Swayframe');app.setPath('userData',path.resolve('outputs/agent-reliability-026/userdata'));
await app.whenReady();
const out=path.resolve('outputs/agent-reliability-026');
const service=new NativeAIService(path.join(app.getPath('appData'),'Swayframe'));
const calls:any[]=[];let done=false;
ipcMain.handle('bench:settings',()=>service.settings());
ipcMain.handle('bench:has',(_,providerId)=>service.dispatch({method:'ai.credentials.has',providerId}));
ipcMain.handle('bench:chat',async(_,providerId,request)=>{ let response:any;try{response=await service.dispatch({method:'ai.chat',providerId,requestId:randomUUID(),request});}catch(e){calls.push({error:{code:(e as any).code,message:String(e)},images:request.messages.filter(m=>m.images).map(m=>m.images.length)});await fs.writeFile(path.join(out,'real-calls.json'),JSON.stringify(calls,null,2));return {benchError:{code:(e as any).code??'network',message:(e as Error).message}};} calls.push({names:response.toolCalls?.map(c=>c.name),arguments:response.toolCalls?.map(c=>({name:c.name,arguments:c.arguments})),images:request.messages.filter(m=>m.images).map(m=>m.images.length)});await fs.writeFile(path.join(out,'real-calls.json'),JSON.stringify(calls,null,2));return response; });
ipcMain.handle('bench:reference',async()=> 'data:image/png;base64,'+(await fs.readFile(path.join(out,'reference.png'))).toString('base64'));
ipcMain.handle('bench:fixture',async(_,kind='flac')=>[...await fs.readFile(kind==='aiff'?'tests/fixtures/media/tone.aiff':'tests/fixtures/media/tone.flac')]);
for(const method of ['save','saveImage'])ipcMain.handle('bench:'+method,async(_,name,data)=>{if(!/^[a-z0-9.-]+$/.test(name))throw Error('invalid filename');await fs.writeFile(path.join(out,name),method==='saveImage'?Buffer.from(data.split(',')[1],'base64'):data);});
ipcMain.handle('bench:done',async(_,report)=>{done=true;await fs.writeFile(path.join(out,'live-report.json'),JSON.stringify(report,null,2));app.exit(report.failures.length?1:0);});
const win=new BrowserWindow({width:1280,height:720,show:false,webPreferences:{preload:path.resolve('work/agent-reliability-026/preload.cjs'),contextIsolation:true,nodeIntegration:false}});
win.webContents.on('console-message',(_e,...args)=>console.log(args.slice(0,2)));await win.loadFile(path.resolve('work/agent-reliability-026/index.html'), process.argv.includes('--offline') ? {query:{offline:'true'}} : {});
setTimeout(async()=>{if(!done){await fs.writeFile(path.join(out,'live-report.json'),JSON.stringify({failed:true,reason:'8 minute bounded benchmark timeout',calls:calls.length}));app.exit(1);}},480000);

}
void main();
