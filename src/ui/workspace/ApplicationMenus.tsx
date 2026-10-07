import { useState } from 'react';
import { applicationMenus, menuChildren } from '../../shared/application-menu';
import { MenuDropdown } from './primitives';
import { shortcutLabel } from '../../desktop/platform';
import type { MenuItem } from './primitives';
import type { EditorAction } from './editor-actions';

export function ApplicationMenus({
  actions,
}: {
  actions: readonly EditorAction[];
}) {
  return (
    <nav
      className="application-menus"
      aria-label="应用菜单"
      onKeyDown={(event) => {
        if (
          !['ArrowLeft', 'ArrowRight'].includes(event.key) ||
          event.defaultPrevented
        )
          return;
        const current = (event.target as Element).closest('details');
        if (!current) return;
        if (
          event.key === 'ArrowRight' &&
          (event.target as Element).getAttribute('aria-haspopup') === 'menu'
        ) {
          event.preventDefault();
          event.stopPropagation();
          (event.target as HTMLButtonElement).click();
          return;
        }
        const menus = [
          ...event.currentTarget.querySelectorAll<HTMLDetailsElement>(
            'details',
          ),
        ];
        const index = menus.indexOf(current);
        const next =
          menus[
            (index + (event.key === 'ArrowRight' ? 1 : -1) + menus.length) %
              menus.length
          ];
        const opened = current.open;
        current.open = false;
        if (next) {
          next.open = opened;
          next.querySelector('summary')?.focus();
        }
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {applicationMenus.map((group) => (
        <ApplicationMenu
          key={group.label}
          label={group.label}
          items={group.items.map(([id, label, ...keys]) => {
            const action = actions.find((a) => a.id === id);
            return {
              ...action,
              ...(menuChildren(id).length
                ? {
                    children: menuChildren(id).flatMap((feature) => {
                      const child = actions.find(
                        (a) => a.id === feature.commandId,
                      );
                      return child ? [{ ...child, label: feature.title }] : [];
                    }),
                  }
                : {}),
              label,
              shortcut: keys[0]
                ?.replace('CommandOrControl+', '⌘')
                .replace('Shift+', '⇧'),
              action: action?.action ?? (() => {}),
            };
          })}
        />
      ))}
    </nav>
  );
}
function ApplicationMenu({
  label,
  items,
}: {
  label: string;
  items: MenuItem[];
}) {
  const [child, setChild] = useState<MenuItem>();
  return (
    <MenuDropdown>
      <summary onClick={() => setChild(undefined)}>
        <span>{label}</span>
      </summary>
      <div
        className="dropdown-menu"
        role="menu"
        aria-label={child?.label ?? label}
        onKeyDown={(event) => {
          if (child && event.key === 'ArrowLeft') {
            event.preventDefault();
            event.stopPropagation();
            setChild(undefined);
            event.currentTarget
              .closest('details')
              ?.querySelector('summary')
              ?.focus();
          }
        }}
      >
        {child && (
          <button
            role="menuitem"
            onClick={(event) => {
              setChild(undefined);
              event.currentTarget
                .closest('details')
                ?.querySelector('summary')
                ?.focus();
            }}
          >
            ‹ 返回{label}
          </button>
        )}
        {(child?.children ?? items).map((item) => (
          <button
            role="menuitem"
            aria-label={item.label}
            key={item.label}
            disabled={item.disabled}
            aria-haspopup={item.children ? 'menu' : undefined}
            onClick={(event) => {
              if (item.children) {
                const details = event.currentTarget.closest('details');
                setChild(item);
                requestAnimationFrame(() =>
                  details
                    ?.querySelector<HTMLButtonElement>('.dropdown-menu button')
                    ?.focus(),
                );
                return;
              }
              item.action();
              const details = event.currentTarget.closest('details');
              details?.removeAttribute('open');
              details?.querySelector('summary')?.focus();
            }}
          >
            <span>{item.label}</span>
            <kbd>{item.children ? '›' : shortcutLabel(item.shortcut)}</kbd>
          </button>
        ))}
      </div>
    </MenuDropdown>
  );
}
