import { layerTimeDragDelta } from '../core/timeline-snapping';
import { useInteractionCancel } from './workspace/interaction';
import { useEffect, useRef, useState } from 'react';
import type { Layer, Composition } from '../core/project-model';
import { moveLayerInTime } from '../core/composition-editing';
import { command } from '../core/command-system';
import type { EditorStore } from './editor-store';
export function LayerTimeBar({
  store,
  layer,
  composition: c,
  claimInteraction,
  releaseInteraction,
}: {
  store: EditorStore;
  layer: Layer;
  composition: Composition;
  claimInteraction?: (cancel: () => void) => boolean;
  releaseInteraction?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<
    | {
        x: number;
        width: number;
        start: number;
        end: number;
        mode: 'move' | 'start' | 'end';
        delta: number;
        project: unknown;
      }
    | undefined
  >(undefined);
  const [preview, setPreview] = useState<{ start: number; end: number }>();
  const cancel = () => {
    if (!drag.current) return;
    drag.current = undefined;
    setPreview(undefined);
    releaseInteraction?.();
  };
  useInteractionCancel(cancel);
  const update = (clientX: number) => {
    const g = drag.current;
    if (!g) return;
    if (g.project !== store.getSnapshot().project) {
      cancel();
      return;
    }
    g.delta = layerTimeDragDelta(
      g.start,
      g.end,
      ((clientX - g.x) / g.width) * c.duration,
      g.mode,
      c.duration,
      c.fps,
    );
    setPreview({
      start: g.mode === 'end' ? g.start : g.start + g.delta,
      end: g.mode === 'start' ? g.end : g.end + g.delta,
    });
  };
  const finish = (clientX: number) => {
    update(clientX);
    const g = drag.current;
    cancel();
    if (
      !g ||
      !g.delta ||
      g.project !== store.getSnapshot().project ||
      !layer.editor
    )
      return;
    try {
      store.run(
        g.mode === 'move'
          ? '移动图层时间'
          : g.mode === 'start'
            ? '调整图层入点'
            : '调整图层出点',
        g.mode === 'move'
          ? moveLayerInTime(store.getSnapshot().project, layer, g.delta)
          : [
              command({
                type: 'layer.replace',
                compositionId: c.id,
                layer: {
                  ...layer,
                  editor: {
                    ...layer.editor,
                    inPoint:
                      g.mode === 'start'
                        ? g.start + g.delta
                        : layer.editor.inPoint,
                    outPoint:
                      g.mode === 'end'
                        ? g.end + g.delta
                        : layer.editor.outPoint,
                  },
                },
              }),
            ],
      );
    } catch (e) {
      store.setStatus(e instanceof Error ? e.message : '时间编辑失败', true);
    }
  };
  useEffect(() => {
    if (!preview) return;
    const move = (event: PointerEvent) => update(event.clientX),
      up = (event: PointerEvent) => finish(event.clientX);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    return () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
    };
  });
  const e = layer.editor;
  if (!e) return null;
  const start = preview?.start ?? e.inPoint,
    end = preview?.end ?? Math.min(c.duration, e.outPoint);
  return (
    <div className="layer-time-row">
      <span>
        {start.toFixed(2)} – {end.toFixed(2)} 秒
      </span>
      <div ref={ref} className="layer-time-track">
        <div
          className="layer-time-bar"
          data-locked={layer.locked}
          style={{
            left: `${(start / c.duration) * 100}%`,
            width: `${((end - start) / c.duration) * 100}%`,
          }}
          aria-label={`${layer.name}时间范围`}
          title={`拖动移动图层时间，边缘调整入点/出点 · ${start.toFixed(2)}–${end.toFixed(2)} 秒`}
          onPointerDown={(event) => {
            if (event.button !== 0 || layer.locked || drag.current) return;
            if (claimInteraction && !claimInteraction(cancel)) return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            store.setPlaying(false);
            setPreview({
              start: e.inPoint,
              end: Math.min(c.duration, e.outPoint),
            });
            drag.current = {
              x: event.clientX,
              width: Math.max(1, ref.current!.getBoundingClientRect().width),
              start: e.inPoint,
              end: Math.min(c.duration, e.outPoint),
              mode:
                ((event.target as HTMLElement).dataset.edge as
                  'start' | 'end' | undefined) ?? 'move',
              delta: 0,
              project: store.getSnapshot().project,
            };
          }}
          onPointerCancel={cancel}
        >
          <span
            data-edge="start"
            className="time-edge start"
            title="调整入点"
          />
          <span data-edge="end" className="time-edge end" title="调整出点" />
        </div>
      </div>
      <span />
    </div>
  );
}
