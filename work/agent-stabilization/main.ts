import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NativeAIService } from '../../apps/desktop/electron/ai-service';
async function main() {
 const live=process.env.SF_STAB_LIVE==='1',out=path.resolve('outputs/agent-stabilization/'+(live?'live-control':'offline-stable'));
 app.setName('Swayframe');app.setPath('userData',path.join(out,'isolated-userdata'));await app.whenReady();await fs.mkdir(out,{recursive:true});
 const service=new NativeAIService(path.join(app.getPath('appData'),'Swayframe'),undefined,false,async(url,init)=>{const body=JSON.parse(String(init?.body));body.max_tokens=2000;return fetch(url,{...init,body:JSON.stringify(body)});});
 const calls:any[]=live?JSON.parse(await fs.readFile(path.resolve('outputs/agent-stabilization/live-combined-final/live-calls.json'),'utf8')):[];if(live&&calls.length!==10)throw Error('Expected retained 10 paid requests');let inputReserved=calls.reduce((n,c)=>n+(c.response?.usage?.inputTokens??c.inputUpper),0),done=false;
 if(live&&await fs.stat(path.join(out,'live-calls.json')).then(()=>true,()=>false))throw Error('Existing paid ledger: refuse second run');
 ipcMain.handle('bench:settings',()=>service.settings());ipcMain.handle('bench:mode',()=>live);
 ipcMain.handle('bench:has',(_,id)=>service.dispatch({method:'ai.credentials.has',providerId:id}));
 ipcMain.handle('bench:chat',async(_,providerId,request)=>{
  if(!live)throw Error('Offline runner must never call API');const bounded={...request,stream:false};
  if(request.messages.some(m=>m.images?.length))throw Error('Images forbidden in this authorized batch');
  const inputUpper=Buffer.byteLength(JSON.stringify(bounded),'utf8')+5000;
  if(calls.length>=12||inputReserved+inputUpper>200000)throw Error('Authorized request/input cap reached before sending');
  inputReserved+=inputUpper;const record:any={index:calls.length+1,inputUpper,outputLimit:2000,request:bounded,startedAt:new Date().toISOString()};calls.push(record);await fs.writeFile(path.join(out,'live-calls.json'),JSON.stringify(calls,null,2));
  try{const response=await service.dispatch({method:'ai.chat',providerId,requestId:randomUUID(),request:bounded});record.response=response;record.durationMs=Date.now()-Date.parse(record.startedAt);inputReserved+=(response.usage?.inputTokens??inputUpper)-inputUpper;await fs.writeFile(path.join(out,'live-calls.json'),JSON.stringify(calls,null,2));return response;}
  catch(e){record.error={code:(e as any).code,message:(e as Error).message,details:(e as any).details};await fs.writeFile(path.join(out,'live-calls.json'),JSON.stringify(calls,null,2));return {benchError:record.error};}
 });
 for(const method of ['save','saveImage'])ipcMain.handle('bench:'+method,async(_,name,data)=>{if(!/^[a-z0-9.-]+$/.test(name))throw Error('Invalid evidence name');await fs.writeFile(path.join(out,name),method==='saveImage'?Buffer.from(data.split(',')[1],'base64'):data);});
 ipcMain.handle('bench:progress',(_,s)=>console.log(s));
 ipcMain.handle('bench:done',async(_,report)=>{done=true;await fs.writeFile(path.join(out,'report.json'),JSON.stringify({...report,budget:{authorization:'12 requests incl retry / 200000 input / 24000 output; synthetic data only; no images',requests:calls.length,inputReserved,inputTokens:calls.reduce((n,c)=>n+(c.response?.usage?.inputTokens??0),0),outputTokens:calls.reduce((n,c)=>n+(c.response?.usage?.outputTokens??0),0),unknownUsage:calls.filter(c=>!c.response?.usage).length}},null,2));app.exit(0);});
 const win=new BrowserWindow({show:false,width:1280,height:720,webPreferences:{preload:path.resolve('work/agent-stabilization/preload.cjs'),contextIsolation:true,nodeIntegration:false}});
 win.webContents.on('console-message',(_e,...s)=>console.log('renderer',...s));await win.loadFile(path.resolve('work/agent-stabilization/index.html'));setTimeout(()=>{if(!done)app.exit(1);},900000);
}void main();
