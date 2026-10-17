import {app,BrowserWindow,safeStorage} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {NativeAIService} from '../../apps/desktop/electron/ai-service';
const out=path.resolve('outputs/agent-v2-7/credential-fixture-userdata');
app.setName('Swayframe');app.setPath('userData',out);
app.whenReady().then(async()=>{
  await fs.mkdir(out,{recursive:true});const win=new BrowserWindow({show:false});await win.loadURL('about:blank');
  const value='NONSECRET_SYNTHETIC_FIXTURE_V27',id='00000000-0000-4000-8000-000000000027';
  const service=new NativeAIService(out,undefined,false,async()=>{throw Error('Network forbidden in credential fixture');});
  const report:any={scope:'Only newly created nonsecret synthetic fixture; no real settings or credentials read; no network',electron:process.versions.electron};
  try{
    report.storage=await service.dispatch({method:'ai.storage.status'});
    report.priorFixtureReadable=await service.dispatch({method:'ai.credentials.has',providerId:id});
    await service.dispatch({method:'ai.credentials.set',providerId:id,credentials:{apiKey:value,headers:{}}});
    report.nativeFixtureReadable=await service.dispatch({method:'ai.credentials.has',providerId:id});
    const encrypted=await safeStorage.encryptStringAsync(value),decrypted:any=await safeStorage.decryptStringAsync(encrypted);
    report.asyncReturnType=typeof decrypted;report.returnKeys=typeof decrypted==='object'?Object.keys(decrypted):[];
    report.stringMatches=decrypted===value;report.resultMatches=decrypted?.result===value;
  }catch(e){report.error=e instanceof Error?e.message:'Fixture failed';}
  await fs.writeFile(path.resolve('outputs/agent-v2-7/credential-fixture-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));win.destroy();app.quit();
});
