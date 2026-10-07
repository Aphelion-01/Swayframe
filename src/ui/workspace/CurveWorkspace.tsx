import { useRef, useState, type ReactNode } from 'react';
import { IconButton } from './primitives';
import { Icon } from './icons';
import { usePointerRelease } from './pointer-release';
import { useInteractionCancel } from './interaction';

const preferenceKey = 'motion.workspace.curve-inspector.v1';
function readPreference() {
  try {
    const stored = JSON.parse(localStorage.getItem(preferenceKey) ?? '{}');
    return {
      width:
        typeof stored.width === 'number'
          ? Math.max(200, Math.min(360, stored.width))
          : 250,
      collapsed: stored.collapsed === true,
    };
  } catch {
    return { width: 250, collapsed: false };
  }
}
/** View preferences only: never enter Project or its undo history. */
export function CurveWorkspace({
  toolbar,
  inspector,
  footer,
  children,
}: {
  toolbar: ReactNode;
  inspector: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const [preference, setPreference] = useState(readPreference);
  const drag = useRef<{ x: number; width: number } | undefined>(undefined);
  const latest = useRef(preference);
  latest.current = preference;
  const persist = (value: typeof preference) => {
    setPreference(value);
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(value));
    } catch {
      /* Storage may be unavailable. */
    }
  };
  usePointerRelease({
    active: () => !!drag.current,
    move: (e) => {
      if (drag.current)
        setPreference({
          ...latest.current,
          width: Math.max(
            200,
            Math.min(360, drag.current.width + drag.current.x - e.clientX),
          ),
        });
    },
    finish: () => {
      drag.current = undefined;
      persist(latest.current);
    },
    cancel: () => {
      if (drag.current)
        setPreference({ ...latest.current, width: drag.current.width });
      drag.current = undefined;
    },
  });
  useInteractionCancel(() => {
    if (drag.current)
      setPreference({ ...latest.current, width: drag.current.width });
    drag.current = undefined;
  });
  return (
    <div
      className={`curve-workspace ${preference.collapsed ? 'inspector-collapsed' : ''}`}
    >
      <div className="curve-context-toolbar">
        {toolbar}
        <IconButton
          label={preference.collapsed ? '展开曲线属性' : '折叠曲线属性'}
          aria-expanded={!preference.collapsed}
          onClick={() =>
            persist({ ...preference, collapsed: !preference.collapsed })
          }
        >
          <Icon name="panel-right" />
        </IconButton>
      </div>
      <div
        className="curve-main"
        style={{
          gridTemplateColumns: preference.collapsed
            ? 'minmax(0,1fr)'
            : `minmax(0,1fr) 5px min(${preference.width}px, 30%)`,
        }}
      >
        {children}
        {!preference.collapsed && (
          <>
            <div
              className="curve-inspector-divider"
              role="separator"
              aria-label="曲线属性宽度"
              aria-orientation="vertical"
              aria-valuemin={200}
              aria-valuemax={360}
              aria-valuenow={preference.width}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  e.preventDefault();
                  persist({
                    ...preference,
                    width: Math.max(
                      200,
                      Math.min(
                        360,
                        preference.width + (e.key === 'ArrowLeft' ? 10 : -10),
                      ),
                    ),
                  });
                }
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, width: preference.width };
              }}
            />
            <aside className="curve-inspector" aria-label="曲线属性">
              {inspector}
            </aside>
          </>
        )}
      </div>
      <div className="curve-preview-bar">{footer}</div>
    </div>
  );
}
