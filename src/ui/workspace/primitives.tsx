import type { LayerAccentId } from '../../core/layer-accent';
import { shortcutLabel } from '../../desktop/platform';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
export function IconButton({
  label,
  shortcut,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  shortcut?: string;
}) {
  return (
    <button
      {...props}
      className={`icon-button ${props.className ?? ''}`}
      aria-label={label}
      title={
        props.title ??
        `${label}${shortcut ? ` (${shortcutLabel(shortcut)})` : ''}`
      }
    >
      {children}
    </button>
  );
}
export function Section({
  title,
  children,
  open = true,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="property-section" open={open}>
      <summary>{title}</summary>
      <div className="section-content">{children}</div>
    </details>
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={items.join(' / ')}
      className="panel-tabs"
      onKeyDown={(event) => {
        const index = items.indexOf(value);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : event.key === 'ArrowRight'
                ? (index + 1) % items.length
                : event.key === 'ArrowLeft'
                  ? (index - 1 + items.length) % items.length
                  : undefined;
        if (next === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        onChange(items[next]!);
        const tabs =
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            '[role="tab"]',
          );
        tabs[next]?.focus();
      }}
    >
      {items.map((item) => (
        <button
          key={item}
          role="tab"
          tabIndex={value === item ? 0 : -1}
          aria-selected={value === item}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
export interface MenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
  shortcut?: string;
  children?: MenuItem[];
  checked?: boolean;
  accent?: LayerAccentId;
}
export function ContextMenu({
  items,
  x,
  y,
  onClose,
}: {
  items: readonly MenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [submenu, setSubmenu] = useState<MenuItem[]>();
  const shownItems = submenu ?? items;
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus();
    const close = (event: globalThis.PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [onClose, submenu]);
  return (
    <div
      ref={ref}
      role="menu"
      className="context-menu"
      style={{
        left: Math.max(4, Math.min(x, window.innerWidth - 225)),
        top: Math.max(
          4,
          Math.min(
            y,
            window.innerHeight -
              (shownItems.length + (submenu ? 1 : 0)) * 30 -
              12,
          ),
        ),
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const buttons = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
              'button:not(:disabled)',
            ),
          ];
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          buttons[
            (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
              buttons.length
          ]?.focus();
        }
      }}
    >
      {submenu && (
        <button role="menuitem" onClick={() => setSubmenu(undefined)}>
          ‹ 返回图层操作
        </button>
      )}
      {shownItems.map((item) => (
        <button
          role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
          aria-checked={item.checked}
          aria-haspopup={item.children ? 'menu' : undefined}
          key={item.label}
          disabled={item.disabled}
          onClick={() => {
            if (item.children) {
              setSubmenu(item.children);
              return;
            }
            item.action();
            onClose();
          }}
        >
          <span>
            {item.accent && (
              <span
                className="layer-accent-chip"
                data-accent={item.accent}
                aria-hidden="true"
              />
            )}
            {item.label}
          </span>
          <kbd
            aria-hidden={
              item.children || item.checked !== undefined ? true : undefined
            }
          >
            {item.children
              ? '›'
              : item.checked
                ? '✓'
                : shortcutLabel(item.shortcut)}
          </kbd>
        </button>
      ))}
    </div>
  );
}

// Focus ownership is shared by the existing dialogs; busy export can block dismissal.
export function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useEffectEvent(() => onClose?.());
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const controls = () =>
      [
        ...(root?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
        ) ?? []),
      ].filter(
        (el) =>
          !el.hidden &&
          !el.closest('[hidden]') &&
          (el.tagName === 'SUMMARY' || !el.closest('details:not([open])')),
      );
    controls()[0]?.focus();
    const handle = (event: globalThis.KeyboardEvent) => {
      const overlays = document.querySelectorAll('.modal-backdrop');
      if (overlays[overlays.length - 1] !== root) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
      if (event.key === 'Tab') {
        const list = controls();
        if (!list.length) {
          event.preventDefault();
          return;
        }
        const first = list[0]!,
          last = list[list.length - 1]!;
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !root?.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !root?.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handle, true);
    return () => {
      window.removeEventListener('keydown', handle, true);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      ref={ref}
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      {children}
    </div>
  );
}

export function MenuDropdown({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: globalThis.PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        ref.current.open = false;
    };
    window.addEventListener('pointerdown', dismiss);
    return () => window.removeEventListener('pointerdown', dismiss);
  }, []);
  return (
    <details
      ref={ref}
      className="toolbar-menu"
      onKeyDown={(event) => {
        const el = ref.current;
        if (!el) return;
        if (event.key === 'Escape' && el.open) {
          event.preventDefault();
          event.stopPropagation();
          el.open = false;
          el.querySelector('summary')?.focus();
          return;
        }
        if ((event.target as HTMLElement).matches('input,select,textarea'))
          return;
        if (
          event.key !== 'ArrowDown' &&
          event.key !== 'ArrowUp' &&
          event.key !== 'Home' &&
          event.key !== 'End'
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        el.open = true;
        const list = [
          ...el.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
        ];
        const i = list.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? list.length - 1
              : event.key === 'ArrowDown'
                ? (i + 1) % list.length
                : (i - 1 + list.length) % list.length;
        list[next]?.focus();
      }}
    >
      {children}
    </details>
  );
}
