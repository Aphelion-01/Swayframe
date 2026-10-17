import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Modal } from './workspace/primitives';
import { importLayerPack } from '../importers/layerpack-import';
import type { PreparedLayerPack } from '../importers/layerpack-manifest';
import { desktopService } from '../desktop/service';
import type { EditorStore } from './editor-store';
import './layerpack-import.css';
type Phase =
  | 'segmenting'
  | 'selecting'
  | 'validating'
  | 'preview'
  | 'importing'
  | 'success'
  | 'failed'
  | 'cancelled';
const titles: Record<Phase, string> = {
  segmenting: '本机分层中',
  selecting: '选择文件夹',
  validating: '校验中',
  preview: '可以导入',
  importing: '导入中',
  success: '导入成功',
  failed: '导入失败',
  cancelled: '已取消',
};
function failureHint(message: string) {
  if (message.includes('不存在') || message.includes('缺失'))
    return '缺少图层图片。请重新选择包含全部图层图片的完整分层包。';
  if (
    message.includes('20 MB') ||
    message.includes('超限') ||
    message.includes('大小限制')
  )
    return '分层包或当前工程超过容量限制。请缩小图片或在较小的工程中重试。';
  return '文件夹格式或图片未通过校验。请选择完整的分层合成文件夹，或重新获取正确的分层包。';
}
/** Presentation only. Preparation and publication remain owned by the existing importer/kernel. */
export function LayerPackImportDialog({ store }: { store: EditorStore }) {
  const [open, setOpen] = useState(false),
    [phase, setPhase] = useState<Phase>('selecting'),
    [prepared, setPrepared] = useState<PreparedLayerPack>(),
    [message, setMessage] = useState('');
  const [imageMode, setImageMode] = useState(false);
  const [generated, setGenerated] =
    useState<import('../desktop/contracts').GeneratedLayerPackage>();
  const visible = useRef(false),
    job = useRef<AbortController | undefined>(undefined),
    decide = useRef<((accept: boolean) => void) | undefined>(undefined);
  const dialog = useRef<HTMLElement>(null);
  const cancel = () => {
    job.current?.abort();
    decide.current?.(false);
    decide.current = undefined;
    setPrepared(undefined);
    setPhase('cancelled');
    setMessage('此次操作未修改工程，可重新选择文件夹。');
  };
  const close = () => {
    cancel();
    visible.current = false;
    setOpen(false);
  };
  const choose = async (directory?: string) => {
    job.current?.abort();
    const controller = new AbortController();
    job.current = controller;
    setPhase('selecting');
    setPrepared(undefined);
    setMessage('请选择收到的分层合成文件夹，无需打开或编辑其中的文件。');
    const active = () => visible.current && job.current === controller;
    try {
      const result = await importLayerPack(store, {
        directory,
        signal: controller.signal,
        onPhase: (next) => {
          if (active()) {
            // Publish the cancellable phase before the importer yields to its commit guard.
            if (next === 'importing') flushSync(() => setPhase(next));
            else setPhase(next);
            setMessage(
              next === 'validating'
                ? '正在检查图片与图层信息，当前工程不会改变。'
                : next === 'importing'
                  ? '正在创建原生合成和图层，请稍候。'
                  : '请选择分层合成文件夹。',
            );
          }
        },
        confirm: (data, signal) =>
          new Promise<boolean>((resolve, reject) => {
            if (!active() || signal.aborted) {
              reject(new Error('已取消'));
              return;
            }
            setPrepared(data);
            setPhase('preview');
            setMessage('校验通过。确认后将新增一个可独立编辑的原生合成。');
            const abort = () => {
              decide.current = undefined;
              reject(signal.reason ?? new Error('已取消'));
            };
            signal.addEventListener('abort', abort, { once: true });
            decide.current = (accept) => {
              signal.removeEventListener('abort', abort);
              decide.current = undefined;
              resolve(accept);
            };
          }),
      });
      if (!active()) return;
      if (!result) {
        setPhase('cancelled');
        setMessage('已取消文件夹选择，工程未更改。');
        return;
      }
      setPhase('success');
      window.dispatchEvent(new Event('motion:show-layers'));
      window.dispatchEvent(new Event('motion:timeline'));
      setPrepared(undefined);
      store.setStatus(
        `分层合成导入成功 · ${result.layerIds.length} 个图层，可在图层、属性和时间轴中编辑。`,
      );
      visible.current = false;
      setOpen(false);
    } catch (error) {
      if (!active()) return;
      const text = error instanceof Error ? error.message : '分层合成未能导入';
      const cancelled =
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError') ||
        text.includes('工程已改变');
      setPhase(cancelled ? 'cancelled' : 'failed');
      setPrepared(undefined);
      setMessage(
        cancelled
          ? '操作已取消或工程已改变，请重新选择文件夹。工程未因本次导入而改变。'
          : text,
      );
    }
  };
  const generate = async () => {
    job.current?.abort();
    decide.current?.(false);
    decide.current = undefined;
    const controller = new AbortController(),
      base = store.commands.getSnapshot();
    job.current = controller;
    setImageMode(true);
    setGenerated(undefined);
    setPrepared(undefined);
    setPhase('segmenting');
    setMessage('正在检查本机分割能力。图片不会外发。');
    const api = desktopService.api,
      id = crypto.randomUUID();
    const unsubscribe = store.commands.subscribe(() => {
      if (store.commands.getSnapshot() !== base) controller.abort();
    });
    controller.signal.addEventListener(
      'abort',
      () => {
        void api?.imageLayers?.cancel(id).catch(() => {});
      },
      { once: true },
    );
    const current = () => visible.current && job.current === controller;
    try {
      if (!api?.imageLayers) throw Error('当前平台未安装本地分层组件。');
      const availability = await api.imageLayers.status();
      controller.signal.throwIfAborted();
      if (!availability.available) throw Error(availability.reason);
      setMessage(
        '选择不透明 PNG / JPEG 照片。最长边超过1024像素时会缩小；被遮挡的背景不会自动补全。',
      );
      const images = await api.dialog.openFile({
        title: '选择本地分层照片',
        extensions: ['png', 'jpg', 'jpeg'],
      });
      controller.signal.throwIfAborted();
      if (!images[0]) {
        if (current()) {
          setPhase('cancelled');
          setMessage('已取消图片选择，工程未更改。');
        }
        return;
      }
      const parent = await api.dialog.openFolder({
        title: '选择分层包输出位置',
      });
      controller.signal.throwIfAborted();
      if (!parent) {
        if (current()) {
          setPhase('cancelled');
          setMessage('已取消输出位置选择，工程未更改。');
        }
        return;
      }
      setMessage(
        '正在本机识别主体并生成真实PNG。背景缺口会保留透明，不会推测隐藏内容。',
      );
      const result = await api.imageLayers.generate(images[0], parent, id);
      controller.signal.throwIfAborted();
      if (!current() || store.commands.getSnapshot() !== base) return;
      unsubscribe();
      setGenerated(result);
      await choose(result.directory);
    } catch (error) {
      if (!current()) return;
      setPrepared(undefined);
      setPhase(controller.signal.aborted ? 'cancelled' : 'failed');
      setMessage(
        controller.signal.aborted
          ? '已取消或工程已改变；未导入当前工程。已完成导出的分层包不会被删除。'
          : error instanceof Error
            ? error.message
            : '本机图片分层失败。',
      );
    } finally {
      unsubscribe();
    }
  };
  const imageStart = useEffectEvent(() => {
    if (visible.current) {
      dialog.current?.focus();
      return;
    }
    visible.current = true;
    setOpen(true);
    void generate();
  });
  const start = useEffectEvent(() => {
    if (visible.current) {
      dialog.current
        ?.querySelector<HTMLElement>('button:not(:disabled)')
        ?.focus();
      return;
    }
    visible.current = true;
    setImageMode(false);
    setGenerated(undefined);
    setOpen(true);
    void choose();
  });
  useEffect(() => {
    const handler = () => start();
    window.addEventListener('motion:import-layerpack', handler);
    const imageHandler = () => imageStart();
    window.addEventListener('motion:image-to-layers', imageHandler);
    const unsubscribe = desktopService.api?.onAction((action) => {
      if (action === 'close-window' || action === 'close-project')
        job.current?.abort();
    });
    return () => {
      window.removeEventListener('motion:import-layerpack', handler);
      window.removeEventListener('motion:image-to-layers', imageHandler);
      unsubscribe?.();
      visible.current = false;
      job.current?.abort();
    };
  }, [store]);
  if (!open) return null;
  const busy = ['selecting', 'validating', 'importing', 'segmenting'].includes(
      phase,
    ),
    manifest = prepared?.manifest;
  const missing =
    phase === 'failed' &&
    (message.includes('不存在') || message.includes('缺失'));
  return (
    <Modal onClose={close}>
      <section
        ref={dialog}
        className="new-dialog layerpack-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="layerpack-title"
        data-import-phase={phase}
      >
        <h2 id="layerpack-title">
          {imageMode ? '图片转分层（本地）' : '导入分层合成'}
        </h2>
        <p role={phase === 'failed' ? 'alert' : 'status'} aria-live="polite">
          <strong>{titles[phase]}</strong> ·{' '}
          {phase === 'failed' && !imageMode ? failureHint(message) : message}
        </p>
        {imageMode && (
          <p>
            实验性分层：输出最长边1024像素，超出会缩小。原图中看不到的背景保留透明缺口，不自动补全。柔边可能带有原背景颜色，需人工检查。不会推断第三层或深度顺序。
          </p>
        )}
        {generated && (
          <details>
            <summary>已导出的分层包与修正提示</summary>
            <p>{generated.warning}</p>
            <p>分层包：{generated.directory}</p>
            <p>原图、模型Alpha和缺口标记：{generated.analysisDirectory}</p>
            <p>
              可在外部修正PNG后，通过“导入分层合成”重新导入。导出文件独立于工程撤销。
            </p>
          </details>
        )}
        {busy && <div role="progressbar" aria-label={titles[phase]} />}
        <dl className="layerpack-summary">
          <div>
            <dt>画布尺寸</dt>
            <dd>
              {manifest
                ? `${manifest.canvas.width} × ${manifest.canvas.height} px`
                : phase === 'failed'
                  ? '无法读取'
                  : '校验后显示'}
            </dd>
          </div>
          <div>
            <dt>图层数量</dt>
            <dd>
              {manifest
                ? manifest.layers.length
                : phase === 'failed'
                  ? '无法读取'
                  : '校验后显示'}
            </dd>
          </div>
          <div>
            <dt>素材状态</dt>
            <dd>
              {manifest
                ? '全部图片完整'
                : missing
                  ? '缺少图片，无法导入'
                  : phase === 'failed'
                    ? '格式或图片无效'
                    : '尚未完成校验'}
            </dd>
          </div>
          <div>
            <dt>是否可以导入</dt>
            <dd>
              {phase === 'preview'
                ? '是，等待确认'
                : phase === 'importing'
                  ? '正在导入'
                  : '否'}
            </dd>
          </div>
        </dl>
        {manifest ? (
          <>
            <p>叠放顺序：上方为顶层，下方为底层。每层图片可独立编辑。</p>
            <ol
              className="layerpack-layers"
              aria-label="图层顺序（从顶层到底层）"
            >
              {[...manifest.layers].reverse().map((layer, index) => (
                <li key={layer.id}>
                  <img
                    src={
                      prepared.images.find((i) => i.asset === layer.asset)
                        ?.dataUrl
                    }
                    alt=""
                  />
                  <span>
                    <strong title={layer.name}>{layer.name}</strong>
                    <small>
                      {layer.bounds.width} × {layer.bounds.height} px · 不透明度{' '}
                      {Math.round(layer.opacity * 100)}%
                    </small>
                  </span>
                  <span>
                    {index === 0
                      ? '顶层'
                      : index === manifest.layers.length - 1
                        ? '底层'
                        : `第 ${manifest.layers.length - index} 层`}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p>尚未获得有效的图层预览。确认导入前不会改变当前工程。</p>
        )}
        {phase === 'failed' && (
          <details>
            <summary>详细原因{missing ? ' · 缺失素材' : ' · 格式错误'}</summary>
            <p className="layerpack-error">{message}</p>
          </details>
        )}
        <div className="dialog-actions">
          <button onClick={busy || phase === 'preview' ? cancel : close}>
            {busy || phase === 'preview' ? '取消' : '关闭'}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setImageMode(false);
              setGenerated(undefined);
              void choose();
            }}
          >
            重新选择文件夹
          </button>
          {imageMode && (
            <button disabled={busy} onClick={() => void generate()}>
              重新选择照片
            </button>
          )}
          <button
            className="primary"
            disabled={phase !== 'preview'}
            onClick={() => decide.current?.(true)}
          >
            确认导入
          </button>
        </div>
      </section>
    </Modal>
  );
}
