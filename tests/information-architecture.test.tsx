// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
import {
  buildEditorActions,
  dispatchEditorAction,
} from '../src/ui/workspace/editor-actions';
import { applicationMenus } from '../src/shared/application-menu';
import { editorAction } from '../src/desktop/editor-actions';
import { layerEffects } from '../src/core/compositing-migration';
import { loadProject, saveProject } from '../src/core/project-io';
import { layerActions } from '../src/ui/workspace/layer-actions';
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function setup(count = 1) {
  const p = createDefaultProject(),
    layers = Array.from({ length: count }, (_, i) =>
      createLayer('rectangle', { name: `对象 ${i + 1}` }),
    );
  const store = new EditorStore({
    ...p,
    compositions: [{ ...p.compositions[0]!, layers }],
  });
  if (layers[0]) store.select(layers[0].id);
  render(<App store={store} />);
  return { store, layers };
}
function menu(label: string) {
  fireEvent.click(
    screen.getByText(label, { selector: '.application-menus summary span' }),
  );
  return screen.getByRole('menu', { name: label });
}
function action(store: EditorStore, id: string) {
  const item = buildEditorActions(store, {}).find((a) => a.id === id)!;
  expect(item.disabled).not.toBe(true);
  act(() => item.action());
}
it('七类应用菜单覆盖真实操作，图层类型可见创建且File没有对象类型', () => {
  const { store } = setup(0);
  expect(
    screen
      .getByRole('navigation', { name: '应用菜单' })
      .querySelectorAll('summary'),
  ).toHaveLength(7);
  expect(
    within(menu('文件')).queryByRole('menuitem', { name: '创建 矩形' }),
  ).toBeNull();
  fireEvent.click(
    within(menu('图层')).getByRole('menuitem', { name: '创建对象' }),
  );
  fireEvent.click(screen.getByRole('menuitem', { name: '创建 矩形' }));
  expect(activeComposition(store.getSnapshot().project).layers).toHaveLength(1);
  expect(store.commands.undoStack).toHaveLength(1);
  expect(screen.getByLabelText('位置 X')).toBeInTheDocument();
  expect(document.querySelector('.topbar [aria-label="播放预览"]')).toBeNull();
});
it('对象右键直接结构菜单，空白右键与显式创建共享饼菜单', () => {
  setup();
  fireEvent.contextMenu(screen.getByRole('button', { name: '选择 对象 1' }));
  expect(
    within(document.querySelector('.context-menu') as HTMLElement).getByRole(
      'menuitem',
      { name: '选中图层预合成' },
    ),
  ).toBeVisible();
  expect(screen.queryByLabelText('更多图层操作')).toBeNull();
  expect(screen.queryByRole('menuitem', { name: '左对齐' })).toBeNull();
  fireEvent.keyDown(document.querySelector('.context-menu')!, {
    key: 'Escape',
  });
  fireEvent.click(screen.getByRole('button', { name: '创建对象' }));
  expect(
    screen.getByRole('menuitem', { name: '创建 摄像机' }).querySelector('svg'),
  ).not.toBeNull();
});
it('Inspector直接呈现父级与Effects；空间和时间归属分离', () => {
  setup(2);
  const parent = screen.getByLabelText('父级图层');
  expect(parent.closest('details')).toHaveAttribute('open');
  expect(
    screen
      .getByRole('button', { name: '添加效果' })
      .closest('details.feature-details')
      ?.parentElement?.closest('details'),
  ).not.toHaveAttribute('open', 'false');
  const scene = layerActions(
    new EditorStore(createDefaultProject()),
    () => {},
    'scene',
  );
  expect(scene.some((a) => /对齐|分布/.test(a.label))).toBe(false);
});
it('Cmd/Ctrl+K可搜索全部对象类型和效果，菜单与搜索修改同一命令历史', () => {
  const { store } = setup();
  fireEvent.keyDown(screen.getByLabelText('图层名称'), {
    key: 'k',
    ctrlKey: true,
  });
  const query = screen.getByRole('textbox', { name: '搜索命令' });
  fireEvent.change(query, { target: { value: 'gaussianBlur' } });
  fireEvent.keyDown(query, { key: 'Enter' });
  expect(
    layerEffects(activeComposition(store.getSnapshot().project).layers[0]!).at(
      -1,
    )?.kind,
  ).toBe('gaussianBlur');
  expect(store.commands.undoStack).toHaveLength(1);
  act(() => store.undo());
  expect(
    layerEffects(activeComposition(store.getSnapshot().project).layers[0]!),
  ).toHaveLength(0);
  const ids = buildEditorActions(store, {}).map((a) => a.id);
  for (const kind of [
    'rectangle',
    'ellipse',
    'polygon',
    'star',
    'path',
    'text',
    'camera',
    'solid',
    'null',
  ])
    expect(ids).toContain(`create-${kind}`);
});
it('选中Opacity/Scale跨属性记录一笔Transaction，锁定对象不能被批量记录', () => {
  const { store, layers } = setup(2);
  const a = layers[0]!,
    b = layers[1]!;
  act(() => {
    store.select(b.id, true);
    store.selectProperties([a.transform.opacity.id, b.transform.scale.id]);
    store.setTime(1);
  });
  action(store, 'keyframe');
  expect(store.commands.undoStack).toHaveLength(1);
  const c = activeComposition(store.getSnapshot().project);
  expect(c.layers[0]!.transform.opacity.keyframes).toHaveLength(1);
  expect(c.layers[1]!.transform.scale.keyframes).toHaveLength(1);
  expect(
    c.layers.every((l) => l.transform.position.keyframes.length === 0),
  ).toBe(true);
  act(() => store.undo());
  expect(activeComposition(store.getSnapshot().project).layers).toEqual(layers);
});
it('中间关键帧Ease仅修改出侧区间，Undo保留入侧原数据', () => {
  const { store, layers } = setup();
  const original = store.getSnapshot().project;
  act(() => {
    for (const time of [0, 1, 2]) {
      store.setTime(time);
      store.recordPropertyKeyframe(layers[0]!.transform.position.id);
    }
  });
  const p = activeComposition(store.getSnapshot().project).layers[0]!.transform
    .position;
  act(() =>
    store.selectFrames([{ propertyId: p.id, keyframeId: p.keyframes[1]!.id }]),
  );
  const count = store.commands.undoStack.length;
  action(store, 'ease-out');
  const after = activeComposition(store.getSnapshot().project).layers[0]!
    .transform.position;
  expect(after.keyframes[0]).toEqual(p.keyframes[0]);
  expect(after.keyframes[1]!.interpolation.type).toBe('bezier');
  expect(store.commands.undoStack).toHaveLength(count + 1);
  act(() => store.undo());
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.transform
      .position,
  ).toEqual(p);
  expect(original).not.toBe(store.getSnapshot().project);
});
it('Parent与Precompose分别一笔历史，预合成可从全局导航返回且保存重开兼容', () => {
  const { store, layers } = setup(2);
  const before = store.getSnapshot().project;
  action(store, 'parent-null');
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.editor?.parentId,
  ).toBeTruthy();
  act(() => store.undo());
  expect(store.getSnapshot().project).toEqual(before);
  act(() => store.select(layers[1]!.id, true));
  action(store, 'precompose');
  const pre = activeComposition(store.getSnapshot().project).layers[0]!;
  expect(pre.type).toBe('precomp');
  expect(loadProject(saveProject(store.getSnapshot().project))).toEqual(
    store.getSnapshot().project,
  );
  expect(store.commands.undoStack).toHaveLength(1);
});
it('原生新增入口进入同一操作，三维/Camera可撤销，无第二套业务实现', () => {
  const { store, layers } = setup();
  act(() => editorAction(store, 'create-camera'));
  expect(
    activeComposition(store.getSnapshot().project).layers.at(-1)?.type,
  ).toBe('camera');
  act(() => store.undo());
  act(() => {
    store.select(layers[0]!.id);
    editorAction(store, 'toggle-3d');
  });
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.editor?.is3D,
  ).toBe(true);
  expect(screen.getByLabelText('三维位置 X')).toBeInTheDocument();
});
it('Window和效果入口打开隐藏底部工作区，Graph/Motion/Nodes可返回Timeline', () => {
  const { store } = setup();
  fireEvent.click(screen.getByRole('button', { name: '隐藏时间轴' }));
  fireEvent.click(screen.getByRole('button', { name: '打开合成节点' }));
  expect(screen.getByRole('tab', { name: '合成节点' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(
    screen.getByRole('button', { name: '隐藏时间轴' }),
  ).toBeInTheDocument();
  act(() => dispatchEditorAction('graph'));
  expect(screen.getByRole('tab', { name: '曲线编辑器' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  fireEvent.click(screen.getByRole('button', { name: '返回时间轴' }));
  expect(screen.getByRole('tab', { name: '时间轴' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(store.commands.undoStack).toHaveLength(0);
});
it('Help任务路径、快捷键真实可用，菜单Esc关闭并返回焦点，导出经File入口', () => {
  setup();
  const help = menu('帮助');
  fireEvent.click(within(help).getByRole('menuitem', { name: '操作指引' }));
  expect(screen.getByRole('dialog', { name: '操作指引' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  const file = menu('文件');
  fireEvent.keyDown(within(file).getByRole('menuitem', { name: '打开工程' }), {
    key: 'Escape',
  });
  expect(file.closest('details')).not.toHaveAttribute('open');
  expect(document.activeElement).toBe(
    file.closest('details')?.querySelector('summary'),
  );
  fireEvent.click(within(menu('文件')).getByRole('menuitem', { name: '导出' }));
  expect(screen.getByRole('dialog', { name: '导出' })).toBeInTheDocument();
});
it('无选择时上下文操作禁用，不伪造缺失功能或更改Scene', () => {
  const { store } = setup(0);
  const actions = buildEditorActions(store, {});
  for (const id of [
    'precompose',
    'parent-null',
    'toggle-3d',
    'keyframe',
    'ease-out',
    'effect-gaussianBlur',
  ])
    expect(actions.find((a) => a.id === id)?.disabled).toBe(true);
  const nativeIds = applicationMenus.flatMap((g) => g.items.map((a) => a[0]));
  expect(new Set(nativeIds).size).toBe(nativeIds.length);
  expect(actions.map((a) => a.id)).not.toContain('expression');
});

it('节点模式中的编辑菜单只修改节点，受保护节点不能删除，撤销恢复图层', () => {
  const { store, layers } = setup();
  action(store, 'effect-gaussianBlur');
  const layer = activeComposition(store.getSnapshot().project).layers[0]!;
  const graph = layer.editor!.graph!;
  const effect = graph.nodes.find(
    (n) => n.type !== 'source' && n.type !== 'output',
  )!;
  act(() => store.selectGraphNodes(layers[0]!.id, [effect.id]));
  action(store, 'duplicate');
  expect(activeComposition(store.getSnapshot().project).layers).toHaveLength(1);
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.editor!.graph!
      .nodes,
  ).toHaveLength(graph.nodes.length + 1);
  action(store, 'delete');
  expect(
    activeComposition(store.getSnapshot().project).layers[0]!.editor!.graph!
      .nodes,
  ).toHaveLength(graph.nodes.length);
  act(() => {
    store.undo();
    store.undo();
  });
  expect(activeComposition(store.getSnapshot().project).layers[0]).toEqual(
    layer,
  );
  const source = graph.nodes.find((n) => n.type === 'source')!;
  act(() => store.selectGraphNodes(layer.id, [source.id]));
  expect(
    buildEditorActions(store, {}).find((a) => a.id === 'delete')!.disabled,
  ).toBe(true);
});
it('应用菜单左右导航与子菜单返回保持焦点，并且不修改工程', () => {
  const { store } = setup();
  const file = menu('文件');
  fireEvent.keyDown(within(file).getByRole('menuitem', { name: '打开工程' }), {
    key: 'ArrowRight',
  });
  const summaries = document.querySelectorAll<HTMLDetailsElement>(
    '.application-menus details',
  );
  expect(summaries[0]).not.toHaveAttribute('open');
  expect(summaries[1]).toHaveAttribute('open');
  fireEvent.keyDown(summaries[1]!.querySelector('summary')!, {
    key: 'ArrowRight',
  });
  const layer = screen.getByRole('menu', { name: '图层' });
  fireEvent.keyDown(within(layer).getByRole('menuitem', { name: '创建对象' }), {
    key: 'ArrowRight',
  });
  const child = screen.getByRole('menu', { name: '创建对象' });
  fireEvent.keyDown(
    within(child).getByRole('menuitem', { name: '创建 矩形' }),
    { key: 'ArrowLeft' },
  );
  expect(screen.getByRole('menu', { name: '图层' })).toBeInTheDocument();
  expect(store.commands.undoStack).toHaveLength(0);
});

it('空节点选择的编辑命令不能退回删除整个图层，全选仍只选择节点', () => {
  const { store } = setup();
  action(store, 'effect-gaussianBlur');
  const before = store.getSnapshot().project;
  const actions = buildEditorActions(store, {}, () => 'compositing');
  for (const id of ['delete', 'duplicate', 'cut', 'copy', 'paste'])
    expect(actions.find((a) => a.id === id)!.disabled).toBe(true);
  act(() => actions.find((a) => a.id === 'select-all')!.action());
  expect(store.getSnapshot().graphSelection!.nodeIds).toHaveLength(3);
  expect(store.getSnapshot().project).toBe(before);
});
