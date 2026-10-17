import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NativeAIService } from '../../apps/desktop/electron/ai-service';
async function main() {
const out=path.resolve('outputs/object-reference-028');
app.setName('Swayframe'); app.setPath('userData',path.join(out,'userdata'));
await app.whenReady();
const service=new NativeAIService(path.join(app.getPath('appData'),'Swayframe'));
const calls: Record<string,any>[]=[]; let done=false;
ipcMain.handle('bench:settings',()=>service.settings());
ipcMain.handle('bench:has',(_,id)=>service.dispatch({method:'ai.credentials.has',providerId:id}));
ipcMain.handle('bench:chat',async(_,providerId,request)=>{
 if(calls.length>=7)throw Error('Controlled request budget: 7');
 const used=calls.reduce((sum,c)=>sum+(c.response?.usage?.inputTokens??0),0);
 if(used>=200000 || used+JSON.stringify(request).length/2>240000)throw Error('Controlled input budget');
 if(request.messages.some(m=>m.images?.length))throw Error('Image egress disabled in controlled reference tests');
 const record:any={index:calls.length,model:request.model,request,startedAt:new Date().toISOString()};calls.push(record);
 await fs.writeFile(path.join(out,'live-calls.json'),JSON.stringify(calls,null,2));
 try { const response=await service.dispatch({method:'ai.chat',providerId,requestId:randomUUID(),request});record.response=response; await fs.writeFile(path.join(out,'live-calls.json'),JSON.stringify(calls,null,2));return response; }
 catch(e){record.error={code:(e as any).code,message:(e as Error).message};await fs.writeFile(path.join(out,'live-calls.json'),JSON.stringify(calls,null,2));return {benchError:record.error};}
});
for(const method of ['save','saveImage'])ipcMain.handle('bench:'+method,async(_,name,data)=>{if(!/^[a-z0-9.-]+$/.test(name))throw Error('invalid filename'); await fs.writeFile(path.join(out,name),method==='saveImage'?Buffer.from(data.split(',')[1],'base64'):data);});
ipcMain.handle('bench:progress',(_,message)=>console.log(message));
ipcMain.handle('bench:done',async(_,report)=>{done=true;await fs.writeFile(path.join(out,'live-report.json'),JSON.stringify(report,null,2));app.exit(0);});
const win=new BrowserWindow({width:1280,height:720,show:false,webPreferences:{preload:path.resolve('work/agent-execution-027/preload.cjs'),contextIsolation:true,nodeIntegration:false}});
await win.loadFile(path.resolve('work/object-reference-028/index.html'));
setTimeout(()=>{if(!done)app.exit(1);},900000);

}
void main();
