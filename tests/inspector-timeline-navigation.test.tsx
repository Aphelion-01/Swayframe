// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Inspector } from '../src/ui/Inspector';
import { LayerPanel } from '../src/ui/LayerPanel';
import { Timeline } from '../src/ui/Timeline';
import { EditorStore } from '../src/ui/editor-store';
import { createDefaultProject, createLayer } from '../src/core/project-model';
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
function fixture() {
  const p = createDefaultProject(),
    a = createLayer('rectangle', { name: 'target' }),
    b = createLayer('ellipse', { name: 'other' });
  return {
    a,
    b,
    store: new EditorStore({
      ...p,
      compositions: p.compositions.map((c) => ({ ...c, layers: [a, b] })),
    }),
  };
}
it('separates color/effects from properties and retains the existing mask controls and keyboard tabs', () => {
  const { store, a } = fixture();
  store.select(a.id);
  const before = store.getSnapshot().project;
  render(<Inspector store={store} />);
  expect(screen.getByRole('button', { name: '添加矩形遮罩' })).toBeVisible();
  expect(
    screen.queryByRole('button', { name: '添加效果' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: '效果' }));
  expect(screen.getByRole('button', { name: /^高斯模糊 / })).toBeVisible();
  expect(screen.queryByRole('button', { name: '添加效果' })).toBeNull();
  expect(
    screen.queryByRole('button', { name: '添加矩形遮罩' }),
  ).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('tab', { name: '效果' }), {
    key: 'ArrowLeft',
  });
  expect(screen.getByRole('tab', { name: '属性' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(0);
});
it('an existing effect-browser command reveals the new tab and its browser', () => {
  const { store, a, b } = fixture();
  store.select(a.id);
  render(<Inspector store={store} />);
  act(() => window.dispatchEvent(new Event('motion:effect-browser')));
  expect(screen.getByRole('tab', { name: '效果' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByRole('button', { name: /^高斯模糊 / })).toBeVisible();
  expect(screen.queryByRole('button', { name: '添加效果' })).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  act(() => store.select(b.id));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  act(() => store.select(a.id));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('effects catalog applies through shared history while instance parameters live only in Properties', () => {
  const { store, a } = fixture();
  render(<Inspector store={store} />);
  fireEvent.click(screen.getByRole('tab', { name: '效果' }));
  expect(screen.getByRole('button', { name: /^高斯模糊 / })).toBeDisabled();
  act(() => store.select(a.id));
  const before = store.getSnapshot().project;
  fireEvent.click(screen.getByRole('button', { name: /^高斯模糊 / }));
  expect(store.commands.undoStack).toHaveLength(1);
  expect(screen.getByLabelText('效果1半径')).not.toBeVisible();
  expect(screen.getByRole('button', { name: /^高斯模糊 / })).toBeVisible();
  fireEvent.click(screen.getByRole('tab', { name: '属性' }));
  expect(screen.getByLabelText('效果1半径')).toBeVisible();
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
  expect(screen.queryByLabelText('效果1半径')).toBeNull();
});
it('panel selection reveals and expands the corresponding timeline row without changing time, project or Undo', () => {
  const { store, a } = fixture();
  store.setTime(1);
  const before = store.getSnapshot().project;
  render(
    <>
      <LayerPanel store={store} />
      <Timeline store={store} />
    </>,
  );
  const scroll = document.querySelector('.timeline-scroll')!;
  vi.spyOn(scroll, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 200,
    left: 0,
    right: 800,
    width: 800,
    height: 200,
    x: 0,
    y: 0,
    toJSON() {},
  });
  const target = document.querySelector(
    `.timeline-layer-heading[data-layer-id="${a.id}"]`,
  )!;
  vi.spyOn(target, 'getBoundingClientRect').mockImplementation(() => ({
    top: 500 - scroll.scrollTop,
    bottom: 526 - scroll.scrollTop,
    left: 0,
    right: 800,
    width: 800,
    height: 26,
    x: 0,
    y: 500 - scroll.scrollTop,
    toJSON() {},
  }));
  fireEvent.click(screen.getByRole('button', { name: '选择 target' }));
  expect(
    screen.getByRole('button', { name: '展开 target 属性' }),
  ).toHaveAttribute('aria-expanded', 'true');
  expect(scroll.scrollTop).toBe(500);
  expect(
    within(
      document.querySelector(
        `.timeline-layer[data-layer="${a.id}"]`,
      ) as HTMLElement,
    ).getByLabelText('target 位置 轨道'),
  ).toBeTruthy();
  expect(store.getSnapshot().time).toBe(1);
  expect(store.getSnapshot().project).toBe(before);
  expect(store.commands.undoStack).toHaveLength(0);
});
