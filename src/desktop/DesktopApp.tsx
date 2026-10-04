import { Modal } from '../ui/workspace/primitives';
import { Icon } from '../ui/workspace/icons';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { EditorStore } from '../ui/editor-store';
import { App } from '../ui/App';
import type { ProjectService } from './project-service';
import type { RecentProject, Recovery } from './contracts';
import { ProductMetadata } from './product';
export function DesktopApp({
  store,
  service,
}: {
  store: EditorStore;
  service: ProjectService;
}) {
  useSyncExternalStore(service.subscribe, service.getSnapshot);
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [recents, setRecents] = useState<RecentProject[]>([]),
    [recovery, setRecovery] = useState<Recovery | null>(null),
    [startupPath, setStartupPath] = useState<string | null>(null),
    [about, setAbout] = useState(false),
    [initialized, setInitialized] = useState(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const snapshot = await service.api.recovery.read();
      const startup = await service.api.startup();
      if (!alive) return;
      if (snapshot) {
        setRecovery(snapshot);
        setStartupPath(startup);
      } else if (startup) await service.open(startup);
      setInitialized(true);
    })().catch(() => {
      store.setStatus('启动数据读取失败，可手动打开工程。', true);
      setInitialized(true);
    });
    return () => {
      alive = false;
    };
  }, [service, store]);
  useEffect(() => {
    if (!service.active)
      void service.api.recentProjects
        .list()
        .then(setRecents)
        .catch(() => store.setStatus('无法读取最近工程。', true));
  }, [service, service.active, store]);
  useEffect(() => {
    const show = () => setAbout(true);
    window.addEventListener('motion:about', show);
    const error = (event: ErrorEvent) => {
      void service.api.log('Renderer', event.message);
    };
    const rejection = (event: PromiseRejectionEvent) => {
      void service.api.log('Renderer', String(event.reason));
    };
    window.addEventListener('error', error);
    window.addEventListener('unhandledrejection', rejection);
    return () => {
      window.removeEventListener('motion:about', show);
      window.removeEventListener('error', error);
      window.removeEventListener('unhandledrejection', rejection);
    };
  }, [service]);
  return (
    <>
      {service.active ? (
        <App store={store} />
      ) : (
        <main className="desktop-start">
          <div>
            <div className="launcher-heading">
              <Icon name="comp" />
              <h1>{ProductMetadata.displayName}</h1>
              <span>{ProductMetadata.version}</span>
            </div>
            <p className="launcher-subtitle">动态设计与合成工作区</p>
            <div className="dialog-actions">
              <button
                className="primary"
                disabled={!initialized}
                onClick={() => void service.newProject()}
              >
                新建工程
              </button>
              <button
                disabled={!initialized}
                onClick={() => void service.open()}
              >
                打开工程…
              </button>
            </div>
            <h2>最近工程</h2>
            {recents.length ? (
              recents.map((recent) => (
                <div className="recent-project" key={recent.path}>
                  <button
                    disabled={recent.missing}
                    onClick={() => void service.open(recent.path)}
                  >
                    {recent.displayName}
                    <small>
                      {recent.path}
                      {recent.missing ? ' · 文件失联' : ''}
                    </small>
                  </button>
                  <button
                    aria-label={`移除最近工程 ${recent.displayName}`}
                    onClick={() =>
                      void service.api.recentProjects
                        .remove(recent.path)
                        .then(() => service.api.recentProjects.list())
                        .then(setRecents)
                    }
                  >
                    移除
                  </button>
                </div>
              ))
            ) : (
              <p>这里将显示最近打开的工程。</p>
            )}
            <p role={view.error ? 'alert' : 'status'}>{view.status}</p>
            <small>
              {ProductMetadata.version} · {ProductMetadata.build}
            </small>
          </div>
        </main>
      )}
      {recovery && (
        <Modal>
          <section
            className="new-dialog"
            aria-modal="true"
            role="dialog"
            aria-label="恢复工程"
          >
            <h2>发现未保存的恢复版本</h2>
            <p>上次会话可能异常结束。正式工程文件未被覆盖。</p>
            <p>
              {new Date(recovery.timestamp).toLocaleString()} ·{' '}
              {recovery.path ?? '未命名工程'}
            </p>
            <div className="dialog-actions">
              <button
                onClick={() => {
                  void service.api.recovery.clear().then(async () => {
                    setRecovery(null);
                    if (startupPath) await service.open(startupPath);
                    setStartupPath(null);
                  });
                }}
              >
                丢弃恢复版本
              </button>
              <button
                className="primary"
                onClick={() => {
                  service.recover(recovery);
                  setRecovery(null);
                }}
              >
                恢复工程
              </button>
            </div>
          </section>
        </Modal>
      )}
      {about && (
        <Modal onClose={() => setAbout(false)}>
          <section
            className="new-dialog"
            aria-modal="true"
            role="dialog"
            aria-label="关于 Swayframe"
          >
            <h2>{ProductMetadata.displayName}</h2>
            <p>版本 {ProductMetadata.version}</p>
            <p>Build {ProductMetadata.build}</p>
            <small>{ProductMetadata.company}</small>
            <div className="dialog-actions">
              <button onClick={() => setAbout(false)}>关闭</button>
            </div>
          </section>
        </Modal>
      )}
    </>
  );
}
