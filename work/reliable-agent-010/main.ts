import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NativeAIService } from '../../apps/desktop/electron/ai-service';
async function main(){
const out=path.resolve('outputs/agent-010/live');
app.setName('Swayframe');app.setPath('userData',path.join(out,'live-userdata'));await app.whenReady();
const service=new NativeAIService(path.join(app.getPath('appData'),'Swayframe'), undefined, false, async (url,init) => { const body=JSON.parse(String(init?.body)); body.max_tokens=2000; return fetch(url,{...init,body:JSON.stringify(body)}); });
const calls:any[]=[];let reservedInput=0,done=false;
await fs.mkdir(out,{recursive:true});
if(await fs.stat(path.join(out,'live-calls.json')).then(()=>true,()=>false))throw Error('Existing evidence: do not rerun paid batch');
ipcMain.handle('bench:settings',()=>service.settings());ipcMain.handle('bench:has',(_,id)=>service.dispatch({method:'ai.credentials.has',providerId:id}));
ipcMain.handle('bench:chat',async(_,providerId,request)=>{
 const bounded={...request,stream:false};
 const inputUpper=Buffer.byteLength(JSON.stringify(bounded),'utf8')+5000;
 if(calls.length>=32||reservedInput+inputUpper>600000)throw Error('Authorized request/input budget exhausted before API call');
 if(request.messages.some(m=>m.images?.length))throw Error('Images not needed in controlled recovery tests');
 reservedInput+=inputUpper;const record:any={index:calls.length+1,inputUpper,outputLimit:2000,request:bounded,startedAt:new Date().toISOString()};calls.push(record);
 await fs.writeFile(path.join(out,'live-calls.json'),JSON.stringify(calls,null,2));
 try{const response=await service.dispatch({method:'ai.chat',providerId,requestId:randomUUID(),request:bounded});record.durationMs=Date.now()-Date.parse(record.startedAt);record.response=response;await fs.writeFile(path.join(out,'live-calls.json'),JSON.stringify(calls,null,2));return response;}
 catch(e){record.error={code:(e as any).code,message:(e as Error).message};await fs.writeFile(path.join(out,'live-calls.json'),JSON.stringify(calls,null,2));return {benchError:{...record.error,details:(e as any).details}};}
});
for(const method of ['save','saveImage'])ipcMain.handle('bench:'+method,async(_,name,data)=>{if(!/^[a-z0-9.-]+$/.test(name))throw Error('Invalid filename');await fs.writeFile(path.join(out,name),method==='saveImage'?Buffer.from(data.split(',')[1],'base64'):data);});
ipcMain.handle('bench:progress',(_,message)=>console.log(message));
ipcMain.handle('bench:done',async(_,report)=>{done=true;await fs.writeFile(path.join(out,'live-report.json'),JSON.stringify({...report,budget:{authorizedRequests:32,authorizedInputTokens:600000,authorizedOutputTokens:64000,requests:calls.length,reservedInputUpper:reservedInput,inputTokens:calls.reduce((n,c)=>n+(c.response?.usage?.inputTokens??0),0),outputTokens:calls.reduce((n,c)=>n+(c.response?.usage?.outputTokens??0),0)}},null,2));app.exit(0);});
const win=new BrowserWindow({show:false,width:1280,height:720,webPreferences:{preload:path.resolve('work/reliable-agent-010/preload.cjs'),contextIsolation:true,nodeIntegration:false}});await win.loadFile(path.resolve('work/reliable-agent-010/index.html'));setTimeout(()=>{if(!done)app.exit(1);},3600000);
}void main();
