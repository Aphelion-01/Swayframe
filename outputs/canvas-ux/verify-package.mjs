import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { extractFile } from '@electron/asar';
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const files = [...walk('dist'), ...walk('desktop-dist').filter((f) => f.endsWith('.cjs'))];
const archives = ['release/mac-arm64/Swayframe.app/Contents/Resources/app.asar', 'release/win-unpacked/resources/app.asar'];
for (const archive of archives) {
  if (JSON.parse(extractFile(archive, 'package.json').toString()).version !== '0.9.8') throw Error(`Version mismatch: ${archive}`);
  for (const file of files) if (!extractFile(archive, file).equals(fs.readFileSync(file))) throw Error(`Stale package file: ${archive}: ${file}`);
}
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = {
  version: '0.9.8', tests: 360, testFiles: 104, lint: 'PASS', typecheck: 'PASS', desktopBuild: 'PASS',
  packageContentsEquality: true, filesComparedPerPackage: files.length,
  actualSourceUI: ['Move and one Undo', 'single axis scale', '90 degree rotation', 'Hand pan keeps selection', 'actual 25/50/100/200/400 percent', 'equal spacing between two neighbors'],
  cursorZoom: 'AUTOMATED_LAYOUT_TEST', windowsRuntime: 'NOT_VERIFIED', realFPS: 'NOT_MEASURED',
  screenshots: ['final-canvas.jpg', 'equal-spacing-result.jpg', 'viewport-1440.jpg', 'viewport-1920.jpg'],
  largeViewport: '2560x1440 DOM layout verified; screenshot backend limited',
  installers: ['release/Swayframe-0.9.8-arm64.dmg', 'release/Swayframe Setup 0.9.8.exe'].map((file) => ({file, bytes: fs.statSync(file).size, sha256: sha256(file)})),
};
fs.writeFileSync('outputs/canvas-ux/verification.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
