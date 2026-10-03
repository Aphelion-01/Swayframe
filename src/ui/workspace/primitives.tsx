import { shortcutLabel } from '../../desktop/platform';
import { useEffect, useRef } from 'react';
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
      title={`${label}${shortcut ? ` (${shortcutLabel(shortcut)})` : ''}`}
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
    <div role="tablist" className="panel-tabs">
      {items.map((item) => (
        <button
          key={item}
          role="tab"
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
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus();
    const close = (event: globalThis.PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="menu"
      className="context-menu"
      style={{
        left: Math.max(4, Math.min(x, window.innerWidth - 225)),
        top: Math.max(
          4,
          Math.min(y, window.innerHeight - items.length * 30 - 12),
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
      {items.map((item) => (
        <button
          role="menuitem"
          key={item.label}
          disabled={item.disabled}
          onClick={() => {
            item.action();
            onClose();
          }}
        >
          <span>{item.label}</span>
          <kbd>{shortcutLabel(item.shortcut)}</kbd>
        </button>
      ))}
    </div>
  );
}
