const fs = require('node:fs');
const product = JSON.parse(fs.readFileSync('build/product.json', 'utf8'));
const has = (file) => (fs.existsSync(file) ? file : undefined);
module.exports = {
  appId: product.applicationId,
  productName: product.name,
  directories: { output: 'release', buildResources: 'build' },
  files: ['dist/**/*', 'desktop-dist/**/*.cjs', 'package.json'],
  asar: true,
  fileAssociations: [
    {
      ext: product.fileExtension,
      name: 'Swayframe Project',
      description: 'Swayframe animation project',
      role: 'Editor',
    },
  ],
  mac: {
    target: ['dir', 'dmg'],
    category: 'public.app-category.graphics-design',
    identity: null,
    icon: has(product.icons.mac),
    hardenedRuntime: false,
  },
  win: {
    target: ['nsis'],
    icon: has(product.icons.win),
    signExecutable: false,
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: true,
    installerIcon: has(product.icons.win),
    uninstallerIcon: has(product.icons.win),
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
  dmg: { sign: false },
};
