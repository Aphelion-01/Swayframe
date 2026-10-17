import { useEffect, useState } from 'react';
import { desktopService } from '../../desktop/service';
import type { BridgeStatus } from '../../mcp/contract';
export function MCPSettings() {
  const api = desktopService.api?.mcp;
  const [status, setStatus] = useState<BridgeStatus>();
  const [edit, setEdit] = useState(false),
    [importAssets, setImport] = useState(false);
  const [config, setConfig] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!api) return;
    let alive = true;
    const refresh = () => {
      void api
        .control({ action: 'status' })
        .then((result) => {
          if (alive) {
            setStatus(result.status);
            if (result.status.enabled) {
              setEdit(result.status.permissions.edit);
              setImport(result.status.permissions.importAssets);
            }
            if (!result.status.enabled) setConfig('');
          }
        })
        .catch(() => {
          if (alive) setError('无法读取 MCP 状态');
        });
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [api]);
  async function run(action: 'enable' | 'disable' | 'folder') {
    if (!api || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.control(
        action === 'enable'
          ? { action, permissions: { edit, importAssets } }
          : { action },
      );
      setStatus(result.status);
      if (action === 'enable') setConfig(result.config ?? '');
      if (action === 'disable') setConfig('');
    } catch {
      setError('操作失败，请检查桌面应用是否仍在运行。');
    } finally {
      setBusy(false);
    }
  }
  if (!api) return <p>外部工具连接仅支持桌面版。</p>;
  return (
    <section aria-label="MCP 外部工具连接">
      <h3>MCP 外部工具连接</h3>
      <p>
        仅本机连接，默认关闭。授权客户端可以读取当前工程；编辑和导入需分别授权。关闭、切换工程或重启后需重新启用。
      </p>
      <p role="status">
        {status?.enabled
          ? status.connected
            ? '已启用 · 客户端已连接'
            : '已启用 · 等待客户端'
          : '已关闭'}
      </p>
      <label>
        <input type="checkbox" checked readOnly />
        读取工程与渲染（启用后允许）
      </label>
      <label>
        <input
          type="checkbox"
          checked={edit}
          disabled={status?.enabled || busy}
          onChange={(e) => setEdit(e.target.checked)}
        />
        编辑图层属性（可撤销）
      </label>
      <label>
        <input
          type="checkbox"
          checked={importAssets}
          disabled={status?.enabled || busy}
          onChange={(e) => setImport(e.target.checked)}
        />
        导入分层包（仅选定文件夹）
      </label>
      <div className="ai-actions">
        <button
          disabled={busy}
          onClick={() => void run(status?.enabled ? 'disable' : 'enable')}
        >
          {status?.enabled ? '关闭 MCP 并撤销授权' : '启用本次连接'}
        </button>
        {status?.enabled && status.permissions.importAssets && (
          <button
            disabled={busy || status.connected}
            onClick={() => void run('folder')}
          >
            选择授权分层包文件夹…
          </button>
        )}
      </div>
      {status?.directory && <p>已授权分层包：{status.directory}</p>}
      {config && (
        <details>
          <summary>客户端连接配置（含临时密钥，请勿分享）</summary>
          <p>
            将此配置用于可信 MCP
            客户端。每次仅允许连接一次；断开后请重新启用。需要使用应用内附带的
            bridge 文件。
          </p>
          <textarea
            aria-label="MCP 客户端配置"
            readOnly
            rows={12}
            value={config}
          />
        </details>
      )}
      {status?.recent && <p>最近操作：{status.recent}</p>}
      {(error || status?.failure) && (
        <p role="alert">{error || status?.failure}</p>
      )}
    </section>
  );
}
