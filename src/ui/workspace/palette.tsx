import { Modal } from './primitives';
import { useState } from 'react';
import type { MenuItem } from './primitives';
export interface PaletteCommand extends MenuItem {
  keywords?: string;
}
export function CommandPalette({
  commands,
  onClose,
}: {
  commands: readonly PaletteCommand[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState(0);
  const filtered = commands.filter((command) =>
    `${command.label} ${command.keywords ?? ''}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
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
              (selected +
                (event.key === 'ArrowDown' ? 1 : -1) +
                Math.max(1, filtered.length)) %
                Math.max(1, filtered.length),
            );
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            execute(selected);
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
              key={command.label}
              disabled={command.disabled}
              className={index === selected ? 'active' : ''}
              onClick={() => execute(index)}
            >
              <span>{command.label}</span>
              <kbd>{command.shortcut}</kbd>
            </button>
          ))}
        </div>
        {!filtered.length && <p>没有匹配的命令</p>}
      </section>
    </Modal>
  );
}
