import type { Layer } from '../core/project-model';
import { activeComposition } from '../core/project-model';
import {
  parentCommands,
  precomposeCommands,
  splitLayerCommands,
} from '../core/composition-editing';
import { command } from '../core/command-system';
import { NumberField } from './fields';
import type { EditorStore } from './editor-store';
export function StructureControls({
  store,
  layer,
}: {
  store: EditorStore;
  layer: Layer;
}) {
  const view = store.getSnapshot(),
    c = activeComposition(view.project),
    editor = layer.editor;
  if (!editor) return null;
  const run = (label: string, fn: () => Parameters<EditorStore['run']>[1]) => {
    try {
      store.run(label, fn());
    } catch (e) {
      store.setStatus(e instanceof Error ? e.message : '编辑失败', true);
    }
  };
  return (
    <>
      <div className="section-label">层级与时间</div>
      <label className="field">
        父级
        <select
          aria-label="父级图层"
          value={editor.parentId ?? ''}
          onChange={(e) =>
            run('设置父级', () =>
              parentCommands(
                view.project,
                layer.id,
                e.target.value || null,
                view.time,
              ),
            )
          }
        >
          <option value="">无</option>
          {c.layers
            .filter((l) => l.id !== layer.id && l.type !== 'camera')
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </select>
      </label>
      <div className="field-grid">
        <NumberField
          label="图层入点"
          value={editor.inPoint}
          min={0}
          max={c.duration}
          onCommit={(n) =>
            run('修改入点', () => [
              command({
                type: 'layer.replace',
                compositionId: c.id,
                layer: { ...layer, editor: { ...editor, inPoint: n } },
              }),
            ])
          }
          onError={(m) => store.setStatus(m, true)}
        />
        <NumberField
          label="图层出点"
          value={Math.min(c.duration, editor.outPoint)}
          min={0}
          max={c.duration}
          onCommit={(n) =>
            run('修改出点', () => [
              command({
                type: 'layer.replace',
                compositionId: c.id,
                layer: { ...layer, editor: { ...editor, outPoint: n } },
              }),
            ])
          }
          onError={(m) => store.setStatus(m, true)}
        />
      </div>
      <button
        onClick={() =>
          run('拆分图层', () =>
            splitLayerCommands(view.project, layer.id, view.time),
          )
        }
      >
        在播放头拆分图层
      </button>
      <button
        onClick={() => {
          try {
            const result = precomposeCommands(view.project, view.selection);
            if (store.run('预合成', result.commands).ok)
              store.select(result.layerId);
          } catch (e) {
            store.setStatus(
              e instanceof Error ? e.message : '预合成失败',
              true,
            );
          }
        }}
      >
        选中图层预合成
      </button>
      {layer.type === 'precomp' && layer.compositionId && (
        <button
          onClick={() => {
            store.run('进入预合成', [
              command({
                type: 'project.activate',
                compositionId: layer.compositionId!,
              }),
            ]);
            store.select(null);
          }}
        >
          进入预合成
        </button>
      )}
    </>
  );
}
