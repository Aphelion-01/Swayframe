import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { usePointerRelease } from './pointer-release';
import { useInteractionCancel } from './interaction';
import type { EditorStore } from '../editor-store';
type Box = { x: number; y: number; endX: number; endY: number };
export function useLayerMarquee(store: EditorStore) {
  const [box, setBox] = useState<Box>();
  const drag = useRef<
    | {
        box: Box;
        root: HTMLElement;
        selection: readonly string[];
        project: unknown;
      }
    | undefined
  >(undefined);
  const cancel = () => {
    drag.current = undefined;
    setBox(undefined);
  };
  useInteractionCancel(cancel);
  usePointerRelease({
    active: () => !!drag.current,
    cancel,
    move: (e) => {
      const d = drag.current;
      if (!d) return;
      d.box = { ...d.box, endX: e.clientX, endY: e.clientY };
      setBox(d.box);
    },
    finish: () => {
      const d = drag.current;
      cancel();
      if (!d || d.project !== store.getSnapshot().project) return;
      const b = d.box;
      if (Math.hypot(b.endX - b.x, b.endY - b.y) < 3) return;
      const ids = [...d.selection];
      d.root.querySelectorAll<HTMLElement>('[data-layer-id]').forEach((row) => {
        const r = row.getBoundingClientRect();
        if (
          r.right > Math.min(b.x, b.endX) &&
          r.left < Math.max(b.x, b.endX) &&
          r.bottom > Math.min(b.y, b.endY) &&
          r.top < Math.max(b.y, b.endY)
        )
          ids.push(row.dataset.layerId!);
      });
      store.select(null);
      for (const id of new Set(ids)) store.select(id, true);
    },
  });
  const begin = (event: ReactPointerEvent<HTMLElement>) => {
    if (
      event.button !== 0 ||
      (event.target as Element).closest(
        'button,input,select,.layer-time-bar,.keyframe-track,.ruler-track,.timeline-column-resizer',
      )
    )
      return false;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const b = {
      x: event.clientX,
      y: event.clientY,
      endX: event.clientX,
      endY: event.clientY,
    };
    drag.current = {
      box: b,
      root: event.currentTarget,
      selection:
        event.shiftKey || event.ctrlKey || event.metaKey
          ? store.getSnapshot().selection
          : [],
      project: store.getSnapshot().project,
    };
    setBox(b);
    return true;
  };
  return {
    begin,
    overlay: box ? (
      <div
        className="timeline-marquee"
        aria-label="图层框选区域"
        style={{
          left: Math.min(box.x, box.endX),
          top: Math.min(box.y, box.endY),
          width: Math.abs(box.endX - box.x),
          height: Math.abs(box.endY - box.y),
        }}
      />
    ) : null,
  };
}
