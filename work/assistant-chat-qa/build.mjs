import { build } from 'esbuild';
import fs from 'node:fs/promises';
const dir = 'work/assistant-chat-qa/.compiled/desktop-dist';
await fs.mkdir(dir, { recursive: true });
await build({
  entryPoints: ['work/assistant-chat-qa/main.ts'],
  outfile: dir + '/main.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
});
await fs.copyFile('desktop-dist/preload.cjs', dir + '/preload.cjs');
await fs.appendFile(
  dir + '/preload.cjs',
  `\nrequire('electron').contextBridge.exposeInMainWorld('sfUnselectedAgent',{call:(...a)=>require('electron').ipcRenderer.invoke('sf-unselected-agent',...a)});`,
);
await build({
  entryPoints: ['work/assistant-chat-qa/renderer.tsx'],
  outfile: 'work/assistant-chat-qa/renderer.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  loader: { '.md': 'text' },
  plugins: [{ name: 'offline-application-manager', setup(b) { b.onLoad({ filter: /src\/ai\/application\.ts$/ }, () => ({ contents: 'export function getAIApplication(){return window.sfAssistantTestManager;}', loader: 'js' })); } }],
  define: { 'import.meta.env.DEV': 'false' },
});
await fs.writeFile(
  'work/assistant-chat-qa/index.html',
  '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="renderer.css"></head><body><div id="root"></div><script src="renderer.js"></script></body></html>',
);

await fs.cp('public/branding', 'work/assistant-chat-qa/branding', {
  recursive: true,
});
