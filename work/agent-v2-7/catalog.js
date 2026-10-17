async function main(){
  let result;
  try{
    await window.live.case('Models');await window.live.turn('model-catalog');
    const s=await window.swayframe.desktop.ai.loadSettings(),p=s.providers[0];
    const models=await window.swayframe.desktop.ai.models(p.id);
    const ids=models.map(m=>m.id);
    result={id:'model-catalog',pass:true,modelIDs:ids,containsRequested:ids.includes('deepseek-flash'),note:'READ-only catalog; no model changed and no Scene sent'};
    await window.live.save('model-catalog.json',result);
  }catch(e){result={id:'model-catalog',pass:false,error:String(e)};}
  await window.live.done({version:'1.0.3',records:[result],purpose:'Authorized school-service catalog probe after model_not_found; not an Agent success'});
}
void main();
