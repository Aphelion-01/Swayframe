/** Isolated QA entry. Operate the real editor UI; diagnostics only observe snapshots. */
import { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../ui/App';
import { EditorStore } from '../ui/editor-store';
import { activeComposition } from '../core/project-model';
import { createRenderSnapshot } from '../core/renderer-core';
import { boundsCenter, getWorldBounds } from '../core/layer-bounds';
import { transformFixture } from './transform-fixtures';
import '../ui/design-tokens.css';
import '../ui/base.css';
import '../ui/editor-theme.css';
function makeStore(kind: string) {
  const s = new EditorStore(transformFixture(kind));
  s.setAutoKeyframes(false);
  const layers = activeComposition(s.getSnapshot().project).layers;
  if (kind !== 'dense') for (const l of layers) s.select(l.id, true);
  return s;
}
function Diagnostics({ store }: { store: EditorStore }) {
  const v = useSyncExternalStore(store.subscribe, store.getSnapshot),
    c = activeComposition(v.project),
    snap = createRenderSnapshot(c, v.time, [], undefined, v.project);
  return (
    <pre aria-label="验收状态">
      {JSON.stringify({
        settings: v.transformSettings,
        undo: store.commands.undoStack.length,
        layers: snap.layers.map((item) => ({
          name: item.source.name,
          position: item.source.transform.position.baseValue,
          scale: item.source.transform.scale.baseValue,
          rotation: item.source.transform.rotation.baseValue,
          anchor: item.anchor,
          center: boundsCenter(getWorldBounds(item, v.time, store.textMeasure)),
          accent: item.source.ui?.accentColorId,
        })),
      })}
    </pre>
  );
}
function Review() {
  const [size, setSize] = useState('1280,720');
  const [width, height] = size.split(',').map(Number);
  const [kind, setKind] = useState('single'),
    [store, setStore] = useState(() => makeStore('single'));
  return (
    <>
      <header className="qa-toolbar">
        <strong>真实编辑器验收</strong>
        <select
          aria-label="验收场景"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setStore(makeStore(e.target.value));
          }}
        >
          <option value="single">左上锚点矩形</option>
          <option value="multi">多选对象</option>
          <option value="axis">45°轴向</option>
          <option value="parent">父级轴向</option>
          <option value="dense">25图层 / 100属性</option>
        </select>
        <select
          aria-label="验收窗口尺寸"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        >
          <option value="1280,720">1280 × 720</option>
          <option value="1920,1080">1920 × 1080</option>
        </select>
        <button onClick={() => setStore(makeStore(kind))}>恢复场景</button>
        <span>独立开发页面，不进入产品入口</span>
      </header>
      <div className="qa-editor" style={{ width, height: height! - 96 }}>
        <App key={store.getSnapshot().project.id} store={store} />
      </div>
      <Diagnostics store={store} />
    </>
  );
}
const style = document.createElement('style');
style.textContent =
  '.qa-toolbar{height:32px;display:flex;gap:12px;align-items:center;padding:0 12px}.qa-toolbar select{width:180px}.qa-toolbar strong,.qa-toolbar button{white-space:nowrap;flex:none}.qa-toolbar span{color:var(--text-muted)}.qa-editor .editor-app{height:100%}pre[aria-label="验收状态"]{height:64px;margin:0;padding:6px 12px;overflow:auto;font:10px monospace;white-space:pre-wrap;box-sizing:border-box}';
document.head.appendChild(style);
createRoot(document.getElementById('root')!).render(<Review />);
