const fs=require('node:fs'),crypto=require('node:crypto'),asar=require('@electron/asar'),path=require('node:path');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(d,e.name)):[path.join(d,e.name)]);
const payload=[...files('dist'),...files('desktop-dist').filter(f=>f.endsWith('.cjs'))];
const metadata=JSON.parse(fs.readFileSync('package.json'));delete metadata.devDependencies;delete metadata.scripts;
const reports=['release/mac-arm64/Swayframe.app/Contents/Resources/app.asar','release/win-unpacked/resources/app.asar'].map(archive=>{const mismatches=payload.filter(f=>sha(fs.readFileSync(f))!==sha(asar.extractFile(archive,f)));const qaEmbedded=asar.listPackage(archive).some(p=>/^\/(work|docs\/qa)\//.test(p)||p.includes('sf-ops-qa')||p.includes('sf-mcp-qa'));const metadataMatches=JSON.stringify(metadata)===JSON.stringify(JSON.parse(asar.extractFile(archive,'package.json')));return{archive,files:payload.length,mismatches,metadataMatches,qaEmbedded,pass:!mismatches.length&&metadataMatches&&!qaEmbedded};});
fs.writeFileSync('docs/qa/external-ai/package-integrity.json',JSON.stringify(reports,null,2)+'\n');if(reports.some(r=>!r.pass))process.exit(1);
const installers=['release/Swayframe-1.0.3-arm64.dmg','release/Swayframe Setup 1.0.3.exe'].map(f=>{const b=fs.readFileSync(f);return{path:f,bytes:b.length,sha256:sha(b),candidate:'External AI workflow validation on 1.0.3',signed:false,...(f.endsWith('.exe')?{PE:b.subarray(0,2).toString()==='MZ'&&b.subarray(b.readUInt32LE(60),b.readUInt32LE(60)+4).toString()==='PE\0\0',runtimeVerified:false}:{notarized:false})};});fs.writeFileSync('docs/qa/external-ai/installers.json',JSON.stringify(installers,null,2)+'\n');if(installers.some(i=>i.PE===false))process.exit(1);console.log('Installer payload integrity PASS',reports.map(r=>r.files));

const macHelper='release/mac-arm64/Swayframe.app/Contents/Resources/sf-segment-image';
const helperReport={macHash:sha(fs.readFileSync(macHelper)),sourceHash:sha(fs.readFileSync('desktop-dist/sf-segment-image')),macExecutable:!!(fs.statSync(macHelper).mode&0o111),windowsHelperAbsent:!fs.existsSync('release/win-unpacked/resources/sf-segment-image')};
helperReport.pass=helperReport.macHash===helperReport.sourceHash&&helperReport.macExecutable&&helperReport.windowsHelperAbsent;
fs.writeFileSync('docs/qa/external-ai/helper-integrity.json',JSON.stringify(helperReport,null,2)+'\n');if(!helperReport.pass)process.exit(1);
