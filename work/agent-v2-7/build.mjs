import { build } from 'esbuild';
await build({ entryPoints: ['work/agent-v2-7/editor-main.ts'], outfile: 'work/agent-v2-7/editor-main.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron'] });
await build({ entryPoints: ['work/agent-v2-7/editor-renderer.tsx'], outfile: 'work/agent-v2-7/editor-renderer.js', bundle: true, platform: 'browser', format: 'iife', loader: { '.md': 'text' }, jsx: 'automatic', define: { 'import.meta.env.DEV': 'false' } });

import fs from 'node:fs/promises';
await fs.cp('public/branding', 'work/agent-v2-7/branding', { recursive: true });
