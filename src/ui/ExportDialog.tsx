import { Modal } from './workspace/primitives';
import { desktopService } from '../desktop/service';
import { useRef, useState, useEffect } from 'react';
import { activeComposition } from '../core/project-model';
import {
  defaultOutputSettings,
  resolutionPresets,
  frameRates,
  type OutputSettings,
} from '../core/output-settings';
import { exportCurrentFrame, exportPngSequence } from '../renderers/png-export';
import { downloadBlob } from './file-utils';
import type { EditorStore } from './editor-store';
import type { VideoFormat } from '../renderers/video-export';
export function ExportDialog({
  store,
  onClose,
}: {
  store: EditorStore;
  onClose: () => void;
}) {
  const c = activeComposition(store.getSnapshot().project);
  const [start, setStart] = useState(0),
    [end, setEnd] = useState(c.duration);
  const [format, setFormat] = useState<'png' | 'sequence' | VideoFormat>('mp4');
  const [settings, setSettings] = useState<OutputSettings>(() =>
    defaultOutputSettings(c),
  );
  const [codec, setCodec] = useState<'avc' | 'hevc' | 'vp9'>('avc');
  const [bitrate, setBitrate] = useState(12),
    [bitrateMode, setBitrateMode] = useState<'variable' | 'constant'>(
      'variable',
    );
  const [keyInterval, setKeyInterval] = useState(2),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState('');
  const abort = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => abort.current?.abort(), []);
  const video = ['mp4', 'webm', 'mov'].includes(format);
  const run = async (override?: 'png' | 'sequence') => {
    const kind = override ?? format,
      sequence = kind === 'sequence',
      isVideo = ['mp4', 'webm', 'mov'].includes(kind);
    setBusy(true);
    abort.current = new AbortController();
    setProgress('准备渲染…');
    try {
      const project = store.getSnapshot().project,
        time = store.getSnapshot().time;
      const api = desktopService.api,
        ext = sequence ? 'zip' : kind;
      const destination = api
        ? await (sequence
            ? api.dialog.openFolder({ title: '选择 PNG 序列输出文件夹' })
            : api.dialog.saveFile({
                title: '导出文件',
                defaultPath: c.name + '.' + ext,
                extensions: [ext],
              }))
        : null;
      if (api && !destination) {
        setProgress('已取消');
        return;
      }
      const status = (done: number, total: number) =>
        setProgress(
          `${done} / ${total} 帧 · ${Math.round((done / total) * 100)}%`,
        );
      const blob = isVideo
        ? await (
            await import('../renderers/video-export')
          ).exportVideo(
            project,
            c.id,
            start,
            end,
            {
              ...settings,
              transparent: false,
              format: kind as VideoFormat,
              codec,
              bitrate,
              bitrateMode,
              keyFrameInterval: keyInterval,
            },
            status,
            abort.current.signal,
          )
        : sequence
          ? await exportPngSequence(
              project,
              c.id,
              start,
              end,
              status,
              abort.current.signal,
              settings,
            )
          : await exportCurrentFrame(project, c.id, time, settings);
      if (abort.current.signal.aborted) throw Error('导出已取消');
      if (api && destination)
        await api.export.write(
          destination,
          new Uint8Array(await blob.arrayBuffer()),
          sequence,
        );
      else
        downloadBlob(
          blob,
          `${c.name.replace(/[^\p{L}\p{N}_-]/gu, '_')}${sequence ? '_PNG序列' : ''}.${ext}`,
        );
      setProgress('导出完成');
      store.setStatus('导出完成');
    } catch (e) {
      const message = e instanceof Error ? e.message : '导出失败';
      setProgress(message);
      store.setStatus(message, true);
    } finally {
      setBusy(false);
      abort.current = undefined;
    }
  };
  const numeric = (key: 'width' | 'height' | 'fps', label: string) => (
    <label className="field">
      {label}
      <input
        type="number"
        aria-label={`导出${label}`}
        value={settings[key]}
        min={key === 'fps' ? 1 : 2}
        max={key === 'fps' ? 240 : 8192}
        step={key === 'fps' ? 0.001 : 1}
        onChange={(e) =>
          setSettings({ ...settings, [key]: Number(e.target.value) })
        }
      />
    </label>
  );
  return (
    <Modal onClose={busy ? undefined : onClose}>
      <section
        className="new-dialog export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="导出"
      >
        <h2>导出媒体</h2>
        <fieldset disabled={busy}>
          <label className="field">
            格式
            <select
              aria-label="导出格式"
              value={format}
              onChange={(e) => {
                const f = e.target.value as typeof format;
                setFormat(f);
                setCodec(f === 'webm' ? 'vp9' : 'avc');
                if (['mp4', 'mov', 'webm'].includes(f))
                  setSettings((s) => ({ ...s, transparent: false }));
              }}
            >
              <option value="mp4">MP4 视频</option>
              <option value="mov">QuickTime MOV 视频</option>
              <option value="webm">WebM 视频</option>
              <option value="sequence">PNG 序列（透明通道）</option>
              <option value="png">PNG 当前帧</option>
            </select>
          </label>
          <label className="field">
            尺寸预设
            <select
              aria-label="导出分辨率预设"
              value={
                resolutionPresets.find(
                  (p) =>
                    p.width === settings.width && p.height === settings.height,
                )?.id ?? 'custom'
              }
              onChange={(e) => {
                const p = resolutionPresets.find(
                  (p) => p.id === e.target.value,
                );
                if (p)
                  setSettings({
                    ...settings,
                    width: p.width,
                    height: p.height,
                  });
              }}
            >
              <option value="custom">自定义 / 匹配合成</option>
              {resolutionPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} · {p.width} × {p.height}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => setSettings(defaultOutputSettings(c))}>
            匹配源合成
          </button>
          <div className="field-grid">
            {numeric('width', '宽度')}
            {numeric('height', '高度')}
            {numeric('fps', '帧率')}
          </div>
          <label className="field">
            帧率预设
            <select
              aria-label="导出帧率预设"
              value={
                frameRates.includes(settings.fps) ? settings.fps : 'custom'
              }
              onChange={(e) => {
                if (e.target.value !== 'custom')
                  setSettings({ ...settings, fps: Number(e.target.value) });
              }}
            >
              <option value="custom">自定义</option>
              {frameRates.map((f) => (
                <option key={f} value={f}>
                  {f} fps
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            画面适配
            <select
              aria-label="导出画面适配"
              value={settings.fit}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  fit: e.target.value as OutputSettings['fit'],
                })
              }
            >
              <option value="contain">完整画面 · 留边</option>
              <option value="cover">填满画面 · 裁切</option>
              <option value="stretch">拉伸</option>
            </select>
          </label>
          <div className="field-grid">
            <label className="field">
              开始（秒）
              <input
                aria-label="导出开始时间"
                type="number"
                min={0}
                max={c.duration}
                step="any"
                value={start}
                onChange={(e) => setStart(Number(e.target.value))}
              />
            </label>
            <label className="field">
              结束（秒）
              <input
                aria-label="导出结束时间"
                type="number"
                min={0}
                max={c.duration}
                step="any"
                value={end}
                onChange={(e) => setEnd(Number(e.target.value))}
              />
            </label>
          </div>
          {video ? (
            <>
              <label className="field">
                视频编码
                <select
                  aria-label="视频编码"
                  value={codec}
                  onChange={(e) => setCodec(e.target.value as typeof codec)}
                >
                  {format === 'webm' ? (
                    <option value="vp9">VP9</option>
                  ) : (
                    <>
                      <option value="avc">H.264 · 高兼容</option>
                      <option value="hevc">H.265 / HEVC · 依设备支持</option>
                    </>
                  )}
                </select>
              </label>
              <div className="field-grid">
                <label className="field">
                  目标码率（Mbps）
                  <input
                    aria-label="目标码率 Mbps"
                    type="number"
                    min={0.1}
                    max={200}
                    step={0.1}
                    value={bitrate}
                    onChange={(e) => setBitrate(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  码率控制
                  <select
                    aria-label="码率控制"
                    value={bitrateMode}
                    onChange={(e) =>
                      setBitrateMode(e.target.value as typeof bitrateMode)
                    }
                  >
                    <option value="variable">VBR 可变码率</option>
                    <option value="constant">CBR 恒定码率</option>
                  </select>
                </label>
                <label className="field">
                  关键帧间隔（秒）
                  <input
                    aria-label="编码关键帧间隔"
                    type="number"
                    min={0.1}
                    max={30}
                    step={0.1}
                    value={keyInterval}
                    onChange={(e) => setKeyInterval(Number(e.target.value))}
                  />
                </label>
              </div>
              <small>
                预计 {((Math.max(0, end - start) * bitrate) / 8).toFixed(1)} MB
                · 逐帧编码 · 无音轨（工程尚无音频） · SDR 8-bit
              </small>
            </>
          ) : (
            <label className="checkbox-field">
              <input
                type="checkbox"
                aria-label="输出透明背景"
                checked={settings.transparent}
                onChange={(e) =>
                  setSettings({ ...settings, transparent: e.target.checked })
                }
              />
              透明背景 / Alpha
            </label>
          )}
          {!settings.transparent && (
            <label className="field">
              留边背景
              <input
                aria-label="导出留边背景"
                type="color"
                value={settings.background}
                onChange={(e) =>
                  setSettings({ ...settings, background: e.target.value })
                }
              />
            </label>
          )}
        </fieldset>
        <p role="status" aria-label="导出进度">
          {progress}
        </p>
        <div className="dialog-actions">
          <button disabled={busy} onClick={() => void run('png')}>
            导出当前帧
          </button>
          <button disabled={busy} onClick={() => void run('sequence')}>
            导出 PNG 序列
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void run()}
          >
            开始导出
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
          输出不含编辑辅助。视频编码能力按设备检查，不支持时明确提示；PNG
          每次最多 3000 帧，视频 18,000 帧，文件上限 512 MB。
        </p>
      </section>
    </Modal>
  );
}
