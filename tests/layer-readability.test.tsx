// @vitest-environment jsdom
import { openTimelineLayers } from './timeline-test-helpers';
import { afterEach, expect, it } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LayerPanel } from '../src/ui/LayerPanel';
import { Timeline } from '../src/ui/Timeline';
import { EditorStore } from '../src/ui/editor-store';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { loadProject, saveProject } from '../src/core/project-io';
import { layerAccent } from '../src/core/layer-accent';
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function setup(count = 2) {
  const p = createDefaultProject(),
    layers = Array.from({ length: count }, (_, i) =>
      createLayer('rectangle', { name: `图层 ${i + 1}` }),
    );
  const store = new EditorStore({
    ...p,
    compositions: [{ ...p.compositions[0]!, layers }],
  });
  return { store, layers };
}
it('B4/B5/B6：两个面板共用色标，颜色菜单勾选/Undo/保存/重开保持', () => {
  const { store, layers } = setup();
  store.select(layers[0]!.id);
  const r = render(
    <>
      <LayerPanel store={store} />
      <Timeline store={store} />
    </>,
  );
  const before = store.getSnapshot().project;
  fireEvent.contextMenu(screen.getByRole('button', { name: '选择 图层 1' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '图层颜色' }));
  expect(screen.getAllByRole('menuitemradio')).toHaveLength(7);
  expect(
    screen
      .getAllByRole('menuitemradio')
      .filter((e) => e.getAttribute('aria-checked') === 'true'),
  ).toHaveLength(1);
  fireEvent.click(screen.getByRole('menuitemradio', { name: '无' }));
  expect(store.commands.undoStack).toHaveLength(1);
  expect(
    r.container.querySelector('.layer-row.selected .layer-accent-chip'),
  ).toHaveAttribute('data-accent', 'none');
  expect(
    r.container.querySelector(
      '.timeline-layer-heading[data-selected="true"] .layer-accent-chip',
    ),
  ).toHaveAttribute('data-accent', 'none');
  expect(
    layerAccent(
      loadProject(saveProject(store.getSnapshot().project)).compositions[0]!
        .layers[0]!,
    ),
  ).toBe('none');
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
});
it('B2/B3/B9：100属性行交替连续；播放头移动保留静态DOM，折叠/筛选重排', () => {
  const { store, layers } = setup(25);
  for (const l of layers) store.select(l.id, true);
  const r = render(<Timeline store={store} />);
  openTimelineLayers();
  const properties = [...r.container.querySelectorAll('.timeline-row')];
  expect(properties).toHaveLength(200);
  const check = () =>
    [...r.container.querySelectorAll('[data-row-index]')].forEach(
      (el, index) => {
        expect(el).toHaveAttribute('data-row-index', String(index));
        expect(el).toHaveAttribute('data-zebra', index % 2 ? 'b' : 'a');
      },
    );
  check();
  act(() => store.setTime(0.123));
  act(() => store.setTime(0.234));
  expect([...r.container.querySelectorAll('.timeline-row')]).toEqual(
    properties,
  );
  fireEvent.click(screen.getByRole('button', { name: '展开 图层 25 属性' }));
  expect(r.container.querySelectorAll('.timeline-row')).toHaveLength(192);
  check();
  fireEvent.change(screen.getByLabelText('时间轴属性筛选'), {
    target: { value: 'position' },
  });
  expect(r.container.querySelectorAll('.timeline-row')).toHaveLength(25);
  check();
});
