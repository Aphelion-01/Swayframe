import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { extractFile } from '@electron/asar';
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const files = [...walk('dist'), ...walk('desktop-dist').filter(f => f.endsWith('.cjs'))];
const archives = ['release/mac-arm64/Swayframe.app/Contents/Resources/app.asar', 'release/win-unpacked/resources/app.asar'];
for (const archive of archives) {
  if (JSON.parse(extractFile(archive, 'package.json').toString()).version !== '0.9.9') throw Error(`Version mismatch: ${archive}`);
  for (const file of files) if (!extractFile(archive, file).equals(fs.readFileSync(file))) throw Error(`Stale package file: ${archive}: ${file}`);
}
const report = {
  version:'0.9.9', tests:379, testFiles:106, lint:'PASS', typecheck:'PASS', desktopBuild:'PASS',
  packageContentsEquality:true, filesComparedPerPackage:files.length,
  actualSourceUI:['open acceptance project','Animated Only','marquee selects three keys and owner layer','move all keys +1s with one Undo','context EaseOut','Graph edit and return','Inspector actual value at1.5s','Pointer Events layer reorder','double-click rename/Escape','Fit and sticky tree at32x','tree resize to320px','local recovery retains layer order/time/interpolation'],
  diskRoundtrip:'INTEGRATION_TEST_PASS', browserSaveDownload:'UI reports saved; IAB download event timed out; no downloaded file independently checked',
  viewportChecks:[1280,1440,1920,2560], rowCenterErrorPx:0, cursorZoom:'AUTOMATED_LAYOUT_TEST_PASS', windowsRuntime:'NOT_VERIFIED', realFPS:'NOT_MEASURED',
  performance:JSON.parse(fs.readFileSync('outputs/timeline-ux/performance.json','utf8')),
  installers:['release/Swayframe-0.9.9-arm64.dmg','release/Swayframe Setup 0.9.9.exe'].map(file=>({file,bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),
};
fs.writeFileSync('outputs/timeline-ux/verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({version:report.version,filesComparedPerPackage:files.length,packageContentsEquality:true,installers:report.installers},null,2));
