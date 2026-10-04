import { Modal } from './workspace/primitives';
import { desktopService } from '../desktop/service';
import { useRef, useState } from 'react';
import { activeComposition } from '../core/project-model';
import { exportCurrentFrame, exportPngSequence } from '../renderers/png-export';
import { downloadBlob } from './file-utils';
import type { EditorStore } from './editor-store';
export function ExportDialog({
  store,
  onClose,
}: {
  store: EditorStore;
  onClose: () => void;
}) {
  const view = store.getSnapshot(),
    c = activeComposition(view.project),
    [start, setStart] = useState(0),
    [end, setEnd] = useState(c.duration),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    abort = useRef<AbortController | undefined>(undefined);
  const run = async (sequence: boolean) => {
    setBusy(true);
    abort.current = new AbortController();
    const project = store.getSnapshot().project,
      time = store.getSnapshot().time;
    try {
      const api = desktopService.api;
      const destination = api
        ? await (sequence
            ? api.dialog.openFolder({ title: '选择 PNG 序列输出文件夹' })
            : api.dialog.saveFile({
                title: '导出 PNG',
                defaultPath: c.name + '.png',
                extensions: ['png'],
              }))
        : null;
      if (api && !destination) {
        setProgress('已取消');
        return;
      }
      const blob = sequence
        ? await exportPngSequence(
            project,
            c.id,
            start,
            end,
            (done, total) => setProgress(`${done} / ${total} 帧`),
            abort.current.signal,
          )
        : await exportCurrentFrame(project, c.id, time);
      if (api && destination)
        await api.export.write(
          destination,
          new Uint8Array(await blob.arrayBuffer()),
          sequence,
        );
      else
        downloadBlob(
          blob,
          `${c.name.replace(/[^\p{L}\p{N}_-]/gu, '_')}${sequence ? '_PNG序列.zip' : `_${time.toFixed(3)}.png`}`,
        );
      store.setStatus(sequence ? 'PNG 序列已导出' : '当前帧已导出');
      setProgress('导出完成');
    } catch (e) {
      store.setStatus(e instanceof Error ? e.message : '导出失败', true);
      setProgress('导出未完成');
    } finally {
      setBusy(false);
      abort.current = undefined;
    }
  };
  return (
    <Modal onClose={busy ? undefined : onClose}>
      <section
        className="new-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="导出"
      >
        <h2>导出 PNG</h2>
        <p>导出当前帧，或按时间范围导出 PNG 序列。</p>
        <div className="field-grid">
          <label className="field">
            开始（秒）
            <input
              type="number"
              aria-label="导出开始时间"
              min={0}
              max={c.duration}
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
            />
          </label>
          <label className="field">
            结束（秒）
            <input
              type="number"
              aria-label="导出结束时间"
              min={0}
              max={c.duration}
              value={end}
              onChange={(e) => setEnd(Number(e.target.value))}
            />
          </label>
        </div>
        <p>
          {c.width} × {c.height} · {c.fps} 帧/秒
        </p>
        <p role="status" aria-label="导出进度">
          {progress}
        </p>
        <div className="dialog-actions">
          <button disabled={busy} onClick={() => void run(false)}>
            导出当前帧
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void run(true)}
          >
            导出 PNG 序列
          </button>
        </div>
        <div className="dialog-actions">
          {busy ? (
            <button onClick={() => abort.current?.abort()}>取消导出</button>
          ) : (
            <button onClick={onClose}>关闭导出</button>
          )}
        </div>
        <p className="inspector-note">
          {desktopService.native ? '输出文件夹' : '序列 ZIP'}包含逐帧 PNG
          和帧率清单，不含选择框与编辑手柄。每次最多 3000 帧或 512
          MB，可分段导出。
        </p>
      </section>
    </Modal>
  );
}
