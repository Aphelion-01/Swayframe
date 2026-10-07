import { features } from '../../shared/feature-catalog';
import { contributionLabels } from '../../shared/contribution-labels';
import type { ContextValues } from '../../shared/feature-registry';
import { shortcutLabel } from '../../desktop/platform';
import { Modal } from './primitives';
import { useState } from 'react';
import type { MenuItem } from './primitives';
export interface PaletteCommand extends MenuItem {
  id?: string;
  keywords?: string;
}
export function CommandPalette({
  commands,
  onClose,
  context = { Global: true },
}: {
  commands: readonly PaletteCommand[];
  onClose: () => void;
  context?: ContextValues;
}) {
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState(0);
  const matches = features.search(query, context);
  const filtered = [
    ...matches.flatMap((feature) => {
      const command = commands.find((c) => c.id === feature.commandId);
      return command ? [command] : [];
    }),
    ...commands
      .filter((c) => !c.id || !features.get(c.id))
      .filter((c) =>
        `${c.label} ${c.keywords ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
  ];
  const activeIndex = filtered[selected]?.disabled
    ? filtered.findIndex((c) => !c.disabled)
    : Math.min(selected, filtered.length - 1);
  const execute = (index: number) => {
    const command = filtered[index];
    if (command && !command.disabled) {
      onClose();
      command.action();
    }
  };
  return (
    <Modal onClose={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="命令搜索"
        className="command-palette"
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape') onClose();
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setSelected(
              (activeIndex +
                (event.key === 'ArrowDown' ? 1 : -1) +
                Math.max(1, filtered.length)) %
                Math.max(1, filtered.length),
            );
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            execute(activeIndex);
          }
        }}
      >
        <input
          autoFocus
          aria-label="搜索命令"
          placeholder="搜索命令…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
        />
        <div className="palette-results">
          {filtered.map((command, index) => (
            <button
              key={command.id ?? command.label}
              aria-label={command.label}
              title={
                command.disabled
                  ? '请先选择适用对象或进入对应工作区'
                  : undefined
              }
              disabled={command.disabled}
              className={index === activeIndex ? 'active' : ''}
              onClick={() => execute(index)}
            >
              <span>
                {command.label}
                {command.id && features.get(command.id) && (
                  <small className="palette-home">
                    {
                      contributionLabels[
                        features.get(command.id)!.placement.canonical
                      ]
                    }
                  </small>
                )}
              </span>
              <kbd>{shortcutLabel(command.shortcut)}</kbd>
            </button>
          ))}
        </div>
        {!filtered.length && <p>没有匹配的命令</p>}
        {!!filtered.length && filtered.every((c) => c.disabled) && (
          <p>请先选择适用对象，或切换到对应工作区。</p>
        )}
      </section>
    </Modal>
  );
}
