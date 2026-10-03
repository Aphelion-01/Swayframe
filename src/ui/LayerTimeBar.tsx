import { layerTimeDragDelta } from '../core/timeline-snapping';
import { useInteractionCancel } from './workspace/interaction';
import { useRef, useState } from 'react';
import type { Layer, Composition } from '../core/project-model';
import { moveLayerInTime } from '../core/composition-editing';
import { command } from '../core/command-system';
import type { EditorStore } from './editor-store';
export function LayerTimeBar({
  store,
  layer,
  composition: c,
}: {
  store: EditorStore;
  layer: Layer;
  composition: Composition;
}) {
  const ref = useRef<HTMLDivElement>(null),
    drag = useRef<
      | {
          x: number;
          start: number;
          end: number;
          mode: 'move' | 'start' | 'end';
          delta: number;
          project: unknown;
        }
      | undefined
    >(undefined),
    [preview, setPreview] = useState<{ start: number; end: number }>();
  useInteractionCancel(() => {
    drag.current = undefined;
    setPreview(undefined);
  });
  const e = layer.editor;
  if (!e) return null;
  const start = preview?.start ?? e.inPoint,
    end = preview?.end ?? Math.min(c.duration, e.outPoint);
  return (
    <div className="layer-time-row">
      <span>
        {e.inPoint.toFixed(2)} – {Math.min(c.duration, e.outPoint).toFixed(2)}{' '}
        秒
      </span>
      <div ref={ref} className="layer-time-track">
        <div
          className="layer-time-bar"
          style={{
            left: `${(start / c.duration) * 100}%`,
            width: `${((end - start) / c.duration) * 100}%`,
          }}
          aria-label={`${layer.name}时间范围`}
          onPointerDown={(event) => {
            if (event.button !== 0 || layer.locked) return;
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            const mode = (event.target as HTMLElement).dataset.edge as
              'start' | 'end' | undefined;
            drag.current = {
              x: event.clientX,
              start: e.inPoint,
              end: Math.min(c.duration, e.outPoint),
              mode: mode ?? 'move',
              delta: 0,
              project: store.getSnapshot().project,
            };
          }}
          onPointerMove={(event) => {
            const g = drag.current;
            if (!g) return;
            if (g.project !== store.getSnapshot().project) {
              drag.current = undefined;
              setPreview(undefined);
              return;
            }
            g.delta = layerTimeDragDelta(
              g.start,
              g.end,
              ((event.clientX - g.x) /
                Math.max(1, ref.current?.getBoundingClientRect().width ?? 1)) *
                c.duration,
              g.mode,
              c.duration,
              c.fps,
            );
            setPreview({
              start: g.mode === 'end' ? g.start : g.start + g.delta,
              end: g.mode === 'start' ? g.end : g.end + g.delta,
            });
          }}
          onPointerUp={() => {
            const g = drag.current;
            drag.current = undefined;
            setPreview(undefined);
            if (!g || g.project !== store.getSnapshot().project || !g.delta)
              return;
            try {
              store.run(
                '编辑图层时间',
                g.mode === 'move'
                  ? moveLayerInTime(store.getSnapshot().project, layer, g.delta)
                  : [
                      command({
                        type: 'layer.replace',
                        compositionId: c.id,
                        layer: {
                          ...layer,
                          editor: {
                            ...e,
                            inPoint:
                              g.mode === 'start'
                                ? g.start + g.delta
                                : e.inPoint,
                            outPoint:
                              g.mode === 'end' ? g.end + g.delta : e.outPoint,
                          },
                        },
                      }),
                    ],
              );
            } catch (error) {
              store.setStatus(
                error instanceof Error ? error.message : '时间编辑失败',
                true,
              );
            }
          }}
          onPointerCancel={() => {
            drag.current = undefined;
            setPreview(undefined);
          }}
          onLostPointerCapture={() => {
            drag.current = undefined;
            setPreview(undefined);
          }}
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
