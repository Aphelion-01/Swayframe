import { useEffect, useState } from 'react';
import { activeComposition } from '../core/project-model';
import type { Project } from '../core/project-model';
import type { EditorStore } from './editor-store';
import { useEditorSlice } from './use-editor-slice';
export interface RenderPreviewStatus {
  store: EditorStore;
  project: Project;
  times: number[];
  ms: number;
  cached: boolean;
  preview: boolean;
}
const latest = new WeakMap<EditorStore, RenderPreviewStatus>();
export function publishRenderPreview(status: RenderPreviewStatus) {
  latest.set(status.store, status);
  window.dispatchEvent(
    new CustomEvent('motion:render-preview', { detail: status }),
  );
}
export function RenderPreviewBar({ store }: { store: EditorStore }) {
  const view = useEditorSlice(store, ['project', 'time']);
  const c = activeComposition(view.project);
  const [last, setStatus] = useState<RenderPreviewStatus>();
  const status = last;
  useEffect(() => {
    setStatus(latest.get(store));
    const update = (e: Event) => {
      const detail = (e as CustomEvent<RenderPreviewStatus>).detail;
      if (detail.store === store) setStatus(detail);
    };
    window.addEventListener('motion:render-preview', update);
    return () => window.removeEventListener('motion:render-preview', update);
  }, [store]);
  return (
    <div
      className="render-preview-strip"
      aria-label="实时渲染预览条"
      title="绿色：已缓存画面；空白：尚未缓存。修改工程后失效，按内存预算淘汰。"
    >
      <div className="render-preview-track">
        {status?.times.map((time, i) => (
          <i
            key={i}
            style={{
              left: `${(time / c.duration) * 100}%`,
              width: `${Math.max(0.15, 100 / c.duration / c.fps)}%`,
            }}
          />
        ))}
        <b style={{ left: `${(view.time / c.duration) * 100}%` }} />
      </div>
      <span>
        {status
          ? `${status.preview ? '参数实时预览' : status.cached ? '缓存回放' : '已渲染'} · ${status.ms.toFixed(1)} ms · ${status.times.length} 帧缓存`
          : '等待渲染'}
      </span>
    </div>
  );
}
