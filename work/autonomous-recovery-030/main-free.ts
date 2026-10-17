import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NativeAIService } from '../../apps/desktop/electron/ai-service';
async function main(){
const out=path.resolve('outputs/autonomous-recovery-030');
app.setName('Swayframe');app.setPath('userData',path.join(out,'live-userdata'));await app.whenReady();
const service=new NativeAIService(path.join(app.getPath('appData'),'Swayframe'), undefined, false, async (url,init) => { const body=JSON.parse(String(init?.body)); body.max_tokens=2000; return fetch(url,{...init,body:JSON.stringify(body)}); });
const calls:any[]=JSON.parse(await fs.readFile(path.join(out,'live-calls.json'),'utf8'));let reservedInput=calls.reduce((n,c)=>n+c.inputUpper,0),done=false; const prior=JSON.parse(await fs.readFile(path.join(out,'live-report.json'),'utf8'));
if(calls.length!==3 || prior.tasks.length!==3)throw Error('Unexpected evidence state: refusing continuation');
ipcMain.handle('bench:settings',()=>service.settings());ipcMain.handle('bench:has',(_,id)=>service.dispatch({method:'ai.credentials.has',providerId:id}));
ipcMain.handle('bench:chat',async(_,providerId,request)=>{
 const bounded={...request,stream:false};
 const inputUpper=Buffer.byteLength(JSON.stringify(bounded),'utf8')+5000;
 if(calls.length>=6||reservedInput+inputUpper>300000)throw Error('Authorized request/input budget exhausted before API call');
 if(request.messages.some(m=>m.images?.length))throw Error('Images not needed in controlled recovery tests');
 reservedInput+=inputUpper;const record:any={index:calls.length+1,inputUpper,outputLimit:2000,request:bounded,startedAt:new Date().toISOString()};calls.push(record);
 await fs.writeFile(path.join(out,'live-calls.json'),JSON.stringify(calls,null,2));
 try{const response=await service.dispatch({method:'ai.chat',providerId,requestId:randomUUID(),request:bounded});record.response=response;await fs.writeFile(path.join(out,'live-calls.json'),JSON.stringify(calls,null,2));return response;}
 catch(e){record.error={code:(e as any).code,message:(e as Error).message};await fs.writeFile(path.join(out,'live-calls.json'),JSON.stringify(calls,null,2));return {benchError:record.error};}
});
for(const method of ['save','saveImage'])ipcMain.handle('bench:'+method,async(_,name,data)=>{if(!/^[a-z0-9.-]+$/.test(name))throw Error('Invalid filename');await fs.writeFile(path.join(out,name),method==='saveImage'?Buffer.from(data.split(',')[1],'base64'):data);});
ipcMain.handle('bench:progress',(_,message)=>console.log(message));
ipcMain.handle('bench:done',async(_,report)=>{done=true;await fs.writeFile(path.join(out,'live-report.json'),JSON.stringify({...report,tasks:[...prior.tasks,...report.tasks],budget:{authorizedRequests:6,authorizedInputTokens:300000,authorizedOutputTokens:12000,requests:calls.length,reservedInputUpper:reservedInput,inputTokens:calls.reduce((n,c)=>n+(c.response?.usage?.inputTokens??0),0),outputTokens:calls.reduce((n,c)=>n+(c.response?.usage?.outputTokens??0),0)}},null,2));app.exit(0);});
const win=new BrowserWindow({show:false,width:1280,height:720,webPreferences:{preload:path.resolve('work/agent-execution-027/preload.cjs'),contextIsolation:true,nodeIntegration:false}});await win.loadFile(path.resolve('work/autonomous-recovery-030/index-free.html'));setTimeout(()=>{if(!done)app.exit(1);},600000);
}void main();
