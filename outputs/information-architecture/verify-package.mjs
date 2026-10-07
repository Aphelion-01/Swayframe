import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { extractFile } from '@electron/asar';
const version = JSON.parse(fs.readFileSync('package.json')).version;
const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
const files = [
  ...walk('dist'),
  ...walk('desktop-dist').filter((f) => f.endsWith('.cjs')),
];
const archives = [
  'release/mac-arm64/Swayframe.app/Contents/Resources/app.asar',
  'release/win-unpacked/resources/app.asar',
];
for (const archive of archives) {
  if (JSON.parse(extractFile(archive, 'package.json')).version !== version)
    throw Error(`Version mismatch: ${archive}`);
  for (const file of files)
    if (!extractFile(archive, file).equals(fs.readFileSync(file)))
      throw Error(`Stale file: ${archive}: ${file}`);
}
const tests = fs.readFileSync(
  'outputs/information-architecture/tests-final.log',
  'utf8',
);
if (!/109 passed \(109\)/.test(tests) || !/411 passed \(411\)/.test(tests))
  throw Error('Missing final test result');
const viewportChecks = JSON.parse(
  fs.readFileSync('outputs/information-architecture/viewport-metrics.json'),
);
for (const item of viewportChecks)
  if (item.document[0] > item.viewport[0])
    throw Error('Horizontal viewport overflow');
const report = {
  version,
  executionBaseline: 'docs/baseline/INFORMATION_ARCHITECTURE.txt',
  testFiles: 109,
  tests: 411,
  lint: 'PASS',
  typecheck: 'PASS',
  desktopBuild: 'PASS',
  packageContentsEquality: true,
  filesComparedPerPackage: files.length,
  viewportChecks,
  screenshots: [
    'final-editor.jpg',
    'ease-out.jpg',
    'parent.jpg',
    'precompose.jpg',
    'camera.jpg',
    'image-blur.jpg',
    'export.jpg',
    'narrow-file-menu.jpg',
    'viewport-1280.jpg',
    'viewport-1440.jpg',
    'viewport-1920.jpg',
    'viewport-2560.jpg',
  ],
  browserEvidence: {
    origin: 'http://127.0.0.1:5177/',
    isolatedFromUserProject: true,
    position: [400, 1100],
    keyframeTimes: [0, 1],
    easeOut: [0, 0, 0.58, 1],
    blurRadius: 18,
    parentPrecomposeCamera3D: true,
    curvePlaybackObservedTime: 1.219,
    exportStatus: '当前帧已导出',
    downloadFileObserved: false,
    downloadEvent: 'TIMEOUT_10000MS',
    narrowViewport: [650, 760],
    narrowMenuClippingFixed: true,
  },
  nativeRuntime: 'NOT_VERIFIED_THIS_ROUND',
  windowsRuntime: 'NOT_VERIFIED',
  macSigning: 'UNSIGNED',
  windowsSigning: 'UNSIGNED',
  installers: [
    `release/Swayframe-${version}-arm64.dmg`,
    `release/Swayframe Setup ${version}.exe`,
  ].map((file) => ({
    file,
    bytes: fs.statSync(file).size,
    sha256: crypto
      .createHash('sha256')
      .update(fs.readFileSync(file))
      .digest('hex'),
  })),
};
fs.writeFileSync(
  'outputs/information-architecture/verification.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      version,
      filesComparedPerPackage: files.length,
      installers: report.installers,
    },
    null,
    2,
  ),
);
