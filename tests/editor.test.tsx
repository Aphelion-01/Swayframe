import { createObject } from './creation-test-helpers';
// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/ui/App';
import { EditorStore } from '../src/ui/editor-store';
import { createDefaultProject } from '../src/core/project-model';
import { createPersistedStore } from '../src/ui/persistence';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});
afterEach(cleanup);
function setup() {
  const store = new EditorStore(createDefaultProject());
  render(<App store={store} />);
  return store;
}
describe('图层面板 / 属性面板 integration', () => {
  it('创建三类基础图层、重命名、Transform、显隐、排序与删除均可撤销', () => {
    const store = setup();
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 矩形');
    fireEvent.change(screen.getByLabelText('图层名称'), {
      target: { value: 'Blue box' },
    });
    fireEvent.blur(screen.getByLabelText('图层名称'));
    fireEvent.change(screen.getByLabelText('缩放 X（%）'), {
      target: { value: '150' },
    });
    fireEvent.blur(screen.getByLabelText('缩放 X（%）'));
    fireEvent.change(screen.getByLabelText('旋转（°）'), {
      target: { value: '30' },
    });
    fireEvent.blur(screen.getByLabelText('旋转（°）'));
    fireEvent.change(screen.getByLabelText('透明度（%）'), {
      target: { value: '50' },
    });
    fireEvent.blur(screen.getByLabelText('透明度（%）'));
    expect(
      store.getSnapshot().project.compositions[0]?.layers[0],
    ).toMatchObject({
      name: 'Blue box',
      transform: {
        scale: { baseValue: { x: 1.5, y: 1.5 } },
        rotation: { baseValue: 30 },
        opacity: { baseValue: 0.5 },
      },
    });
    const before = store.commands.getSnapshot();
    fireEvent.click(screen.getByRole('button', { name: '隐藏 Blue box' }));
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(store.commands.getSnapshot()).toEqual(before);
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 椭圆');
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 文字');
    expect(store.getSnapshot().project.compositions[0]?.layers).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '图层操作' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '删除选中图层' }));
    expect(store.getSnapshot().project.compositions[0]?.layers).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(store.getSnapshot().project.compositions[0]?.layers).toHaveLength(3);
  });
  it('非法 属性面板 输入保留工程值并显示错误', () => {
    const store = setup();
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 矩形');
    const before = store.commands.getSnapshot();
    fireEvent.change(screen.getByLabelText('透明度（%）'), {
      target: { value: '200' },
    });
    fireEvent.blur(screen.getByLabelText('透明度（%）'));
    expect(store.commands.getSnapshot()).toBe(before);
    expect(screen.getByRole('alert')).toHaveTextContent('范围');
  });
  it('Escape 放弃尚未提交的数值且不增加历史', () => {
    const store = setup();
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 矩形');
    const before = store.commands.getSnapshot();
    const input = screen.getByLabelText('旋转（°）');
    input.focus();
    fireEvent.change(input, { target: { value: '45' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(store.commands.getSnapshot()).toBe(before);
    expect(input).toHaveValue(0);
    expect(store.commands.undoStack).toHaveLength(1);
  });
  it('语义元数据编辑也经过可撤销 Command', () => {
    const store = setup();
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 矩形');
    const before = store.commands.getSnapshot();
    fireEvent.change(screen.getByLabelText('语义角色'), {
      target: { value: 'main_title' },
    });
    fireEvent.blur(screen.getByLabelText('语义角色'));
    expect(
      store.getSnapshot().project.compositions[0]?.layers[0]?.semantic
        ?.semanticRole,
    ).toBe('main_title');
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(store.commands.getSnapshot()).toEqual(before);
  });
  it('本地持久化从同一个 Command 快照恢复，错误文件不污染现有数据', () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };
    const store = createPersistedStore(adapter);
    render(<App store={store} />);
    fireEvent.click(screen.getByText('文件', { selector: 'summary span' }));
    createObject('创建 矩形');
    const before = store.commands.getSnapshot();
    expect(createPersistedStore(adapter).commands.getSnapshot()).toEqual(
      before,
    );
    expect(store.load('{broken')).toBe(false);
    expect(store.commands.getSnapshot()).toBe(before);
    expect(store.load(store.save())).toBe(true);
    expect(store.commands.undoStack).toHaveLength(0);
  });
});
