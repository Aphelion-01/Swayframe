const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const asar = require('@electron/asar');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => { const p = path.join(dir, e.name); return e.isDirectory() ? files(p) : [p]; });
const runtime = [...files('dist'), ...files('desktop-dist').filter((p) => p.endsWith('.cjs'))];
const metadata = JSON.parse(fs.readFileSync('package.json')); delete metadata.scripts; delete metadata.devDependencies;
const result = ['release/mac-arm64/Swayframe.app/Contents/Resources/app.asar', 'release/win-unpacked/resources/app.asar'].map((archive) => {
 const mismatches = runtime.filter((p) => { try { return sha(fs.readFileSync(p)) !== sha(asar.extractFile(archive, p)); } catch { return true; } });
 const stored = JSON.parse(asar.extractFile(archive, 'package.json'));
 const metadataMatches = JSON.stringify(stored) === JSON.stringify(metadata);
 return { archive, checkedFiles: runtime.length, mismatches, metadataMatches, pass: !mismatches.length && metadataMatches };
});
fs.writeFileSync('docs/qa/agent-v2-7-1/package-integrity.json', JSON.stringify(result, null, 2)+'\n');
if (result.some((r) => !r.pass)) process.exit(1);
