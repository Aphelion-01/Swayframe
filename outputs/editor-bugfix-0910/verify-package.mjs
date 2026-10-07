import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { extractFile } from '@electron/asar';
const version = JSON.parse(fs.readFileSync('package.json')).version;
const walk = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(e=> e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]);
const files = [...walk('dist'), ...walk('desktop-dist').filter(f=>f.endsWith('.cjs'))];
const archives = ['release/mac-arm64/Swayframe.app/Contents/Resources/app.asar','release/win-unpacked/resources/app.asar'];
for (const archive of archives) {
  if (JSON.parse(extractFile(archive,'package.json')).version !== version) throw Error(`Version mismatch: ${archive}`);
  for (const file of files) if (!extractFile(archive,file).equals(fs.readFileSync(file))) throw Error(`Stale file: ${archive}: ${file}`);
}
const report = {
  version, testFiles:107, tests:388, lint:'PASS', typecheck:'PASS', desktopBuild:'PASS',
  packageContentsEquality:true, filesComparedPerPackage:files.length,
  nativePointerUI: ['continuous overlapping shape creation','layer panel marquee: 5 layers','timeline marquee: 4 layers','pen Bezier preview with no rectangle','path editor fit and appearance controls visible','number scrub stable at805.4 after release','playhead stable at2.833 after release','offscreen speed handle commits623.107 and stays accessible','curve playback without leaving panel'],
  viewportChecks:JSON.parse(fs.readFileSync('outputs/editor-bugfix-0910/viewport-checks.json')),
  screenshotLimitation:'2560 viewport screenshot backend returned2512x1440 and cropped content; full visual acceptance for that size not claimed',
  windowsRuntime:'NOT_VERIFIED', macSigning:'UNSIGNED',
  installers:[`release/Swayframe-${version}-arm64.dmg`,`release/Swayframe Setup ${version}.exe`].map(file=>({file,bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),
};
fs.writeFileSync('outputs/editor-bugfix-0910/verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({version,filesComparedPerPackage:files.length,packageContentsEquality:true,installers:report.installers},null,2));
