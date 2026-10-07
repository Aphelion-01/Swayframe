import { Icon } from './icons';
import { useInteractionCancel } from './interaction';
import { useEffect } from 'react';
import { useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
type Layout = { left: number; right: number; bottom: number; hidden: boolean };
const defaults: Layout = { left: 220, right: 280, bottom: 260, hidden: false };
function load(): Layout {
  try {
    const v = JSON.parse(
      localStorage.getItem('motion.workspace.v1') ?? '{}',
    ) as Partial<Layout>;
    return {
      left: bound(v.left ?? 220, 160, 420),
      right: bound(v.right ?? 280, 220, 440),
      bottom: bound(v.bottom ?? 260, 130, 550),
      hidden: false,
    };
  } catch {
    return defaults;
  }
}
function bound(n: number, min: number, max: number) {
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
}
export function Workspace({
  left,
  center,
  right,
  bottom,
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  bottom: ReactNode;
}) {
  const [layout, setLayout] = useState(load);
  const latestLayout = useRef(layout);
  const updateLayout = (next: Layout) => {
    latestLayout.current = next;
    setLayout(next);
  };
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const drag = useRef<
    | { key: 'left' | 'right' | 'bottom'; x: number; y: number; start: Layout }
    | undefined
  >(undefined);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem('motion.collapsed') ?? '{}');
      return {
        left: v.left === true,
        right: v.right === true,
        bottom: v.bottom === true,
      };
    } catch {
      return { left: false, right: false, bottom: false };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('motion.collapsed', JSON.stringify(collapsed));
    } catch {
      /* UI remains usable if storage is unavailable. */
    }
  }, [collapsed]);
  const [narrow, setNarrow] = useState(() => window.innerWidth <= 650);
  useEffect(() => {
    const resize = () => {
      setNarrow(window.innerWidth <= 650);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const [mobilePanel, setMobilePanel] = useState<'left' | 'right'>();
  const toggle = (key: 'left' | 'right' | 'bottom') => {
    if (narrow && key !== 'bottom')
      setMobilePanel((previous) => (previous === key ? undefined : key));
    else setCollapsed((previous) => ({ ...previous, [key]: !previous[key] }));
  };
  useInteractionCancel(() => {
    if (drag.current) updateLayout(drag.current.start);
    drag.current = undefined;
  });
  useEffect(() => {
    const handlers = (['left', 'right', 'bottom'] as const).map((key) => {
      const handler = () =>
        setCollapsed((previous) => ({ ...previous, [key]: !previous[key] }));
      window.addEventListener(`motion:toggle-${key}`, handler);
      return () => window.removeEventListener(`motion:toggle-${key}`, handler);
    });
    const toggleAll = () =>
      setCollapsed((previous) => {
        const hide = !previous.left || !previous.right;
        return { left: hide, right: hide, bottom: previous.bottom };
      });
    const showLeft = () => {
      setCollapsed((previous) => ({ ...previous, left: false }));
      if (window.innerWidth <= 650) setMobilePanel('left');
    };
    const showRight = () => {
      setCollapsed((previous) => ({ ...previous, right: false }));
      if (window.innerWidth <= 650) setMobilePanel('right');
    };
    const showBottom = () => setCollapsed((p) => ({ ...p, bottom: false }));
    const reset = () => {
      updateLayout(defaults);
      setCollapsed({ left: false, right: false, bottom: false });
      persist(defaults);
    };
    const showEvents = [
      'motion:graph',
      'motion:motion-curve',
      'motion:timeline',
      'motion:compositing',
    ];
    showEvents.forEach((name) => window.addEventListener(name, showBottom));
    window.addEventListener('motion:reset-workspace', reset);
    window.addEventListener('motion:show-left', showLeft);
    window.addEventListener('motion:show-right', showRight);
    window.addEventListener('motion:toggle-panels', toggleAll);
    return () => {
      showEvents.forEach((name) =>
        window.removeEventListener(name, showBottom),
      );
      window.removeEventListener('motion:reset-workspace', reset);
      window.removeEventListener('motion:show-left', showLeft);
      window.removeEventListener('motion:show-right', showRight);
      window.removeEventListener('motion:toggle-panels', toggleAll);
      handlers.forEach((cleanup) => cleanup());
    };
  }, []);
  const persist = (next: Layout) => {
    try {
      localStorage.setItem('motion.workspace.v1', JSON.stringify(next));
    } catch {
      /* Layout remains usable without storage. */
    }
  };
  const divider = (key: 'left' | 'right' | 'bottom') => (
    <div
      role="separator"
      tabIndex={0}
      aria-label={`调整${{ left: '左面板', right: '属性面板', bottom: '时间轴' }[key]}大小`}
      aria-orientation={key === 'bottom' ? 'horizontal' : 'vertical'}
      aria-valuenow={layout[key]}
      className={`workspace-divider ${key}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && drag.current) {
          updateLayout(drag.current.start);
          drag.current = undefined;
        }
        if (event.key.startsWith('Arrow')) {
          event.preventDefault();
          const delta = ['ArrowRight', 'ArrowDown'].includes(event.key)
            ? 10
            : -10;
          const next = {
            ...layout,
            [key]: bound(
              layout[key] + delta,
              key === 'bottom' ? 130 : key === 'left' ? 160 : 220,
              key === 'bottom' ? 550 : 440,
            ),
          };
          updateLayout(next);
          persist(next);
        }
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          key,
          x: event.clientX,
          y: event.clientY,
          start: layout,
        };
      }}
      onPointerMove={(event) => {
        const d = drag.current;
        if (!d) return;
        const delta =
          key === 'bottom'
            ? d.y - event.clientY
            : key === 'right'
              ? d.x - event.clientX
              : event.clientX - d.x;
        updateLayout({
          ...d.start,
          [key]: bound(
            d.start[key] + delta,
            key === 'bottom' ? 130 : key === 'left' ? 160 : 220,
            key === 'bottom'
              ? Math.max(130, Math.min(550, window.innerHeight - 250))
              : 440,
          ),
        });
      }}
      onPointerUp={() => {
        if (drag.current) persist(latestLayout.current);
        drag.current = undefined;
      }}
      onPointerCancel={() => {
        if (drag.current) updateLayout(drag.current.start);
        drag.current = undefined;
      }}
    />
  );
  return (
    <div
      className="workspace-shell"
      style={
        {
          '--left-width': `${collapsed.left ? 0 : Math.min(layout.left, Math.max(160, (viewport.width - 280) * 0.4))}px`,
          '--right-width': `${collapsed.right ? 0 : Math.min(layout.right, Math.max(220, (viewport.width - 280) * 0.45))}px`,
          '--timeline-height': `${collapsed.bottom ? 0 : Math.min(layout.bottom, Math.max(130, viewport.height - 320))}px`,
        } as CSSProperties
      }
    >
      <div className="workspace">
        <div
          className={`panel-slot left-slot ${mobilePanel === 'left' ? 'mobile-active' : ''}`}
          hidden={collapsed.left}
        >
          {left}
        </div>
        {divider('left')}
        {center}
        {divider('right')}
        <div
          className={`panel-slot right-slot ${mobilePanel === 'right' ? 'mobile-active' : ''}`}
          hidden={collapsed.right}
        >
          {right}
        </div>
      </div>
      {divider('bottom')}
      <div className="timeline-dock" hidden={collapsed.bottom}>
        {bottom}
      </div>
      <div className="workspace-switches">
        {(['left', 'right', 'bottom'] as const).map((key) => (
          <button
            key={key}
            title={`${(narrow && key !== 'bottom' ? mobilePanel !== key : collapsed[key]) ? '显示' : '隐藏'}${{ left: '左面板', right: '属性面板', bottom: '时间轴' }[key]}`}
            aria-label={`${(narrow && key !== 'bottom' ? mobilePanel !== key : collapsed[key]) ? '显示' : '隐藏'}${{ left: '左面板', right: '属性面板', bottom: '时间轴' }[key]}`}
            aria-pressed={
              narrow && key !== 'bottom' ? mobilePanel === key : !collapsed[key]
            }
            onClick={() => toggle(key)}
          >
            <Icon
              name={
                {
                  left: 'panel-left',
                  right: 'panel-right',
                  bottom: 'panel-bottom',
                }[key] as 'panel-left' | 'panel-right' | 'panel-bottom'
              }
            />
          </button>
        ))}
      </div>
    </div>
  );
}
