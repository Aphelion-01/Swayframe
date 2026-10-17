// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ParentPickWhip } from '../src/ui/ParentPickWhip';
import { EditorStore } from '../src/ui/editor-store';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('binds by dropping anywhere on the target row, preserves one Undo and cancels without edits', () => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  const p = createDefaultProject(),
    a = createLayer('rectangle'),
    b = createLayer('null');
  const store = new EditorStore({
    ...p,
    compositions: p.compositions.map((c) => ({ ...c, layers: [a, b] })),
  });
  render(
    <>
      <ParentPickWhip store={store} layerId={a.id} disabled={false} />
      <div data-layer-id={b.id}>target row</div>
    </>,
  );
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: vi.fn(() => screen.getByText('target row')),
  });
  const button = screen.getByRole('button', { name: '拖动绑定父级' });
  fireEvent.pointerDown(button, { button: 0, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(window, { clientX: 120, clientY: 100 });
  expect(screen.getByLabelText('父级绑定连接线')).toBeTruthy();
  fireEvent.pointerUp(window, { clientX: 120, clientY: 100 });
  expect(
    activeComposition(store.getSnapshot().project).layers[0]?.editor?.parentId,
  ).toBe(b.id);
  expect(store.commands.undoStack).toHaveLength(1);
  store.undo();
  fireEvent.pointerDown(button, { button: 0 });
  fireEvent(window, new Event('motion:cancel'));
  fireEvent.pointerUp(window, { clientX: 120, clientY: 100 });
  expect(
    activeComposition(store.getSnapshot().project).layers[0]?.editor?.parentId,
  ).toBeFalsy();
  expect(store.commands.undoStack).toHaveLength(0);
});
