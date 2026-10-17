import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { parentCommands } from '../core/composition-editing';
import type { EditorStore } from './editor-store';
import { usePointerRelease } from './workspace/pointer-release';
import { useInteractionCancel } from './workspace/interaction';
import { Icon } from './workspace/icons';
export function ParentPickWhip({
  store,
  layerId,
  disabled,
}: {
  store: EditorStore;
  layerId: string;
  disabled: boolean;
}) {
  const drag = useRef<{ x: number; y: number } | undefined>(undefined);
  const [line, setLine] = useState<{
    x: number;
    y: number;
    tx: number;
    ty: number;
  }>();
  const cancel = () => {
    drag.current = undefined;
    setLine(undefined);
  };
  useInteractionCancel(cancel);
  usePointerRelease({
    active: () => !!drag.current,
    cancel,
    move: (e) => {
      if (drag.current)
        setLine({ ...drag.current, tx: e.clientX, ty: e.clientY });
    },
    finish: (e) => {
      const target = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>('[data-layer-id]')?.dataset.layerId;
      cancel();
      if (!target || target === layerId) return;
      const v = store.getSnapshot();
      try {
        store.run(
          '拖动绑定父级',
          parentCommands(v.project, layerId, target, v.time),
        );
      } catch (error) {
        store.setStatus(
          error instanceof Error ? error.message : '父级绑定失败',
          true,
        );
      }
    },
  });
  return (
    <>
      <button
        className="parent-pick-whip"
        aria-label="拖动绑定父级"
        title="长按拖到目标图层，将当前图层绑定为其子级 · Esc 取消"
        disabled={disabled}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          drag.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          setLine({ ...drag.current, tx: e.clientX, ty: e.clientY });
        }}
      >
        <Icon name="parent" />
      </button>
      {line &&
        createPortal(
          <svg className="parent-pick-line" aria-label="父级绑定连接线">
            <path
              d={`M${line.x} ${line.y} Q${line.tx} ${line.y} ${line.tx} ${line.ty}`}
            />
            <circle cx={line.tx} cy={line.ty} r={4} />
          </svg>,
          document.body,
        )}
    </>
  );
}
