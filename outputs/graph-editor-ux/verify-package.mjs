import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {extractFile} from '@electron/asar';
const version=JSON.parse(fs.readFileSync('package.json')).version;
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=[...walk('dist'),...walk('desktop-dist').filter(f=>f.endsWith('.cjs'))];
const archives=['release/mac-arm64/Swayframe.app/Contents/Resources/app.asar','release/win-unpacked/resources/app.asar'];
for(const archive of archives){
 if(JSON.parse(extractFile(archive,'package.json')).version!==version) throw Error(`Version mismatch: ${archive}`);
 for(const file of files) if(!extractFile(archive,file).equals(fs.readFileSync(file)))throw Error(`Stale file: ${archive}: ${file}`);
}
const tests=fs.readFileSync('outputs/graph-editor-ux/tests.log','utf8');
if(!/108 passed \(108\)/.test(tests)||!/397 passed \(397\)/.test(tests))throw Error('Missing final test result');
const viewportChecks=JSON.parse(fs.readFileSync('outputs/graph-editor-ux/viewport-metrics.json'));
for(const item of viewportChecks) if(item.horizontalOverflow || !item.timelineFooterHidden || item.graph.width<item.main.width*.7 || item.footer.height!==36)throw Error('Invalid workspace geometry');
const report={
 version,executionBaseline:'docs/baseline/V02_GRAPH_EDITOR_UX.txt',testFiles:108,tests:397,
 lint:'PASS',typecheck:'PASS',desktopBuild:'PASS',packageContentsEquality:true,filesComparedPerPackage:files.length,
 viewportChecks,
 screenshots:['graph-1280.jpg','graph-1440.jpg','graph-1920.jpg','graph-2560.jpg','graph-collapsed.jpg','handle-preview.jpg','motion-1440.jpg'],
 browserEvidence:{origin:'http://127.0.0.1:5176/',isolatedFromUserProject:true,inspectorWidthDrag:[250,280],collapsedGraphWidth:1280,handleValueBefore:50,handleValueAfter:34.919,handleUndoValue:50,historyAdded:1,playPause:true,motionContextSegment:'1 -> 2 seconds'},
 nativeRuntime:'NOT_VERIFIED_THIS_ROUND',windowsRuntime:'NOT_VERIFIED',macSigning:'UNSIGNED',windowsSigning:'UNSIGNED',
 installers:[`release/Swayframe-${version}-arm64.dmg`,`release/Swayframe Setup ${version}.exe`].map(file=>({file,bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),
};
fs.writeFileSync('outputs/graph-editor-ux/verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({version,filesComparedPerPackage:files.length,installers:report.installers},null,2));
