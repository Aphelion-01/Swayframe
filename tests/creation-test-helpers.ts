import { fireEvent, screen } from '@testing-library/react';
/** Exercise the same discoverable creation entry used by the editor. */
export function createObject(label: string) {
  const open = document.querySelector<HTMLDetailsElement>(
    '.toolbar-menu[open]',
  );
  if (open) fireEvent.click(open.querySelector('summary')!);
  fireEvent.contextMenu(document.querySelector('.timeline-scroll')!, {
    clientX: 300,
    clientY: 500,
  });
  fireEvent.click(screen.getByRole('menuitem', { name: '新建图层' }));
  fireEvent.click(screen.getByRole('menuitem', { name: label }));
}
