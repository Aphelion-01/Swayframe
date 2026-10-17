import { app, ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import net from 'node:net';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  bridgeCallSchema,
  controlSchema,
  denied,
  toolSchemas,
  type BridgeStatus,
  type BridgeControlResult,
} from '../../../src/mcp/contract';
import type { NativeServices } from './native-services';
/** Private, authenticated loopback transport. Not an HTTP endpoint or editing kernel. */
export function installMCPBridge(
  window: BrowserWindow,
  native: NativeServices,
) {
  const contents = window.webContents;
  let generation = 0;
  let server: net.Server | undefined,
    client: net.Socket | undefined,
    token = '',
    used = false;
  const sockets = new Set<net.Socket>();
  let permissions = { edit: false, importAssets: false },
    directory: string | null = null,
    recent = '',
    failure = '';
  const pending = new Map<
    string,
    { socket: net.Socket; timer: ReturnType<typeof setTimeout> }
  >();
  const status = (): BridgeStatus => ({
    enabled: !!server,
    connected: !!client,
    permissions,
    directory,
    recent,
    failure,
  });
  const send = (socket: net.Socket, data: unknown) => {
    if (!socket.destroyed) socket.write(JSON.stringify(data) + '\n');
  };
  const cancel = (id: string) => {
    const p = pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(id);
    if (!contents.isDestroyed())
      contents.send('sf:mcp:event', { type: 'cancel', id });
  };
  const stop = () => {
    generation++;
    for (const id of [...pending.keys()]) cancel(id);
    for (const socket of sockets) socket.destroy();
    sockets.clear();
    client = undefined;
    const old = server;
    server = undefined;
    old?.close();
    token = '';
    used = false;
    directory = null;
    if (!contents.isDestroyed())
      contents.send('sf:mcp:event', { type: 'revoke' });
  };
  const trusted = (
    event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
  ) =>
    !contents.isDestroyed() &&
    event.sender === contents &&
    event.senderFrame === contents.mainFrame;
  ipcMain.handle(
    'sf:mcp:control',
    async (event, raw: unknown): Promise<BridgeControlResult> => {
      if (!trusted(event)) throw new Error('Untrusted sender');
      const request = controlSchema.parse(raw);
      if (request.action === 'disable') {
        stop();
        return { status: status() };
      }
      if (request.action === 'folder') {
        if (!server || !permissions.importAssets)
          throw new Error('请先启用导入资产权限。');
        const generationAtStart = generation;
        const selected = (await native.dispatch({
          method: 'dialog.folder',
          options: { title: '授权 MCP 导入的分层包文件夹' },
        })) as string | null;
        if (generationAtStart === generation && server) directory = selected;
        return { status: status() };
      }
      if (request.action === 'status') return { status: status() };
      stop();
      permissions = request.permissions;
      recent = '';
      failure = '';
      token = randomBytes(32).toString('hex');
      server = net.createServer((socket) => {
        if (sockets.size >= 8) {
          socket.destroy();
          return;
        }
        sockets.add(socket);
        let authenticated = false,
          buffer = '';
        socket.setEncoding('utf8');
        socket.setTimeout(3000, () => {
          if (!authenticated) socket.destroy();
        });
        socket.on('error', () => {});
        socket.on('close', () => {
          sockets.delete(socket);
          if (client === socket) {
            client = undefined;
            for (const [id, p] of pending) if (p.socket === socket) cancel(id);
            recent = '客户端已断开；重新启用后才能再次连接。';
          }
        });
        socket.on('data', (chunk) => {
          buffer += chunk;
          if (Buffer.byteLength(buffer) > 1_000_000) {
            socket.destroy();
            return;
          }
          let newline: number;
          while ((newline = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newline);
            buffer = buffer.slice(newline + 1);
            try {
              const raw: unknown = JSON.parse(line);
              if (!authenticated) {
                const value = raw as { token?: unknown; type?: unknown };
                const supplied =
                    typeof value?.token === 'string'
                      ? Buffer.from(value.token)
                      : Buffer.alloc(0),
                  expected = Buffer.from(token);
                if (
                  value?.type !== 'authenticate' ||
                  used ||
                  client ||
                  supplied.length !== expected.length ||
                  !timingSafeEqual(supplied, expected)
                ) {
                  failure = '未经授权的连接已拒绝。';
                  socket.destroy();
                  return;
                }
                used = true;
                authenticated = true;
                client = socket;
                socket.setTimeout(0);
                send(socket, { authenticated: true });
                recent = '客户端已连接';
                continue;
              }
              if (typeof raw === 'object' && raw !== null && 'cancel' in raw) {
                const id = (raw as { cancel: unknown }).cancel;
                if (
                  typeof id === 'string' &&
                  pending.get(id)?.socket === socket
                )
                  cancel(id);
                continue;
              }
              const call = bridgeCallSchema.parse(raw);
              toolSchemas[call.tool].parse(call.args);
              if (pending.size >= 8 || pending.has(call.id)) {
                send(socket, {
                  id: call.id,
                  result: denied('请求重复或并发操作超限。'),
                });
                continue;
              }
              if (
                (call.tool === 'sf_set_property' && !permissions.edit) ||
                (call.tool === 'sf_import_layer_package' &&
                  !permissions.importAssets)
              ) {
                send(socket, {
                  id: call.id,
                  result: denied('用户未授权此操作。'),
                });
                failure = '操作缺少权限';
                continue;
              }
              if (call.tool === 'sf_import_layer_package') {
                const args = call.args as { directory: string };
                if (
                  !directory ||
                  path.resolve(args.directory) !== path.resolve(directory)
                ) {
                  send(socket, {
                    id: call.id,
                    result: denied('只能导入用户在 MCP 设置中选定的包目录。'),
                  });
                  failure = '未授权的导入目录';
                  continue;
                }
              }
              recent = call.tool;
              failure = '';
              const timer = setTimeout(() => {
                send(socket, {
                  id: call.id,
                  result: denied('操作超时，已取消尚未提交的工作。'),
                });
                cancel(call.id);
                failure = '操作超时';
              }, 60_000);
              pending.set(call.id, { socket, timer });
              contents.send('sf:mcp:event', { type: 'call', call });
            } catch {
              failure = '非法协议或工具参数';
              socket.destroy();
              return;
            }
          }
        });
      });
      const currentServer = server;
      const enableGeneration = generation;
      await new Promise<void>((resolve, reject) => {
        currentServer!.once('error', reject);
        currentServer!.listen(0, '127.0.0.1', resolve);
      });
      if (generation !== enableGeneration || server !== currentServer) {
        currentServer.close();
        throw new Error('Activation cancelled');
      }
      contents.send('sf:mcp:event', { type: 'authorize' });
      const address = currentServer.address();
      if (!address || typeof address === 'string')
        throw new Error('Bridge unavailable');
      const cli = path.join(__dirname, 'mcp-server.cjs');
      const config = JSON.stringify(
        {
          mcpServers: {
            swayframe: {
              command: process.execPath,
              args: [cli],
              env: {
                ELECTRON_RUN_AS_NODE: '1',
                SF_MCP_PORT: String(address.port),
                SF_MCP_TOKEN: token,
              },
            },
          },
        },
        null,
        2,
      );
      return { status: status(), config };
    },
  );
  ipcMain.on('sf:mcp:reply', (event, id: unknown, result: unknown) => {
    if (!trusted(event) || typeof id !== 'string') return;
    const p = pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(id);
    send(p.socket, { id, result });
    const value = result as { ok?: boolean; error?: { code?: string } };
    if (!value?.ok) failure = value?.error?.code ?? '操作失败';
  });
  contents.on('did-start-loading', stop);
  window.on('closed', stop);
  app.on('before-quit', stop);
  return stop;
}
