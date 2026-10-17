const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const asar = require('@electron/asar');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? files(p) : [p];
});
// Match electron-builder.config.cjs: desktop source maps are intentionally excluded.
const sourceFiles = [...files('dist'), ...files('desktop-dist').filter((p) => p.endsWith('.cjs'))];
const sourceMetadata = JSON.parse(fs.readFileSync('package.json'));
delete sourceMetadata.scripts;
delete sourceMetadata.devDependencies;
const packages = [
  ['mac-arm64', 'release/mac-arm64/Swayframe.app/Contents/Resources/app.asar'],
  ['win-x64', 'release/win-unpacked/resources/app.asar'],
].map(([platform, archive]) => {
  const mismatches = sourceFiles.filter((p) => {
    try { return sha(fs.readFileSync(p)) !== sha(asar.extractFile(archive, p)); }
    catch { return true; }
  });
  const metadata = JSON.parse(asar.extractFile(archive, 'package.json'));
  // electron-builder strips development-only package fields from shipped metadata.
  const metadataMatches = JSON.stringify(metadata) === JSON.stringify(sourceMetadata);
  return { platform, version: metadata.version, metadataMatches,
    checkedFiles: sourceFiles.length, mismatches, pass: mismatches.length === 0 && metadataMatches };
});
const peFiles = ['release/win-unpacked/Swayframe.exe', 'release/Swayframe Setup 1.0.3.exe'];
const windowsPE = peFiles.map((p) => {
  const b = fs.readFileSync(p);
  const peOffset = b.readUInt32LE(0x3c);
  return { path: p, pass: b.subarray(0, 2).toString() === 'MZ' &&
    b.subarray(peOffset, peOffset + 4).equals(Buffer.from([80, 69, 0, 0])) };
});
const report = { packages, windowsPE, windowsRuntime: 'NOT VERIFIED',
  expectedPackagingTransforms: 'desktop .map excluded; package scripts/devDependencies stripped by electron-builder',
  pass: packages.every((p) => p.pass && p.version === '1.0.3') && windowsPE.every((p) => p.pass) };
fs.writeFileSync('outputs/agent-v2-7/package-integrity.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (!report.pass) process.exitCode = 1;
