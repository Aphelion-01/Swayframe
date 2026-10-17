const {app}=require('electron');const fs=require('node:fs/promises');const path=require('node:path');
const out=path.resolve('outputs/agent-stabilization');process.env.SWAYFRAME_USER_DATA=path.join(out,'packaged-smoke-userdata-'+Date.now());
const root=path.resolve('release/mac-arm64/Swayframe.app/Contents/Resources/app.asar');const errors=[];let finished=false;
app.on('browser-window-created',(_,win)=>{win.on('show',()=>win.hide());win.hide();});
app.on('web-contents-created',(_,contents)=>{
 contents.on('render-process-gone',(_e,details)=>errors.push(details));contents.on('did-fail-load',(_e,code,message)=>errors.push({code,message}));
 contents.once('did-finish-load',async()=>{await new Promise(r=>setTimeout(r,1200));try{await contents.executeJavaScript('Array.from(document.querySelectorAll("button")).find(b=>b.textContent?.trim()==="新建工程")?.click()');await new Promise(r=>setTimeout(r,2000));const state=await contents.executeJavaScript('({title:document.title,body:document.body.innerText.slice(0,12000),canvasCount:document.querySelectorAll("canvas").length})');const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;await fs.writeFile(path.join(out,'packaged-smoke.json'),JSON.stringify({version,state,errors,pass:version==='0.10.1'&&state.canvasCount>0&&errors.length===0,scope:'packaged Mac renderer and main/preload; isolated profile; no provider calls; not Windows runtime'},null,2));finished=true;app.exit(0);}catch(e){await fs.writeFile(path.join(out,'packaged-smoke.json'),JSON.stringify({errors:[...errors,String(e)],pass:false}));app.exit(1);}});
});
require(path.join(root,'desktop-dist/main.cjs'));
setTimeout(()=>{if(!finished)app.exit(1);},30000);
