import { createServer } from 'vite';
import path from 'node:path';
import { spawn } from 'node:child_process';
import electron from 'electron';
import './build.mjs';
const server = await createServer({
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
});
await server.listen();
const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    SWAYFRAME_DEV_URL: 'http://127.0.0.1:5175',
    SWAYFRAME_USER_DATA: path.resolve('outputs/desktop-dev-userdata'),
  },
});
const close = async () => {
  child.kill();
  await server.close();
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
