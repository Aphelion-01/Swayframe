import { describe, it, expect, vi } from 'vitest';
import { ProjectService } from '../src/desktop/project-service';
import type { DesktopAPI } from '../src/desktop/contracts';
import { EditorStore } from '../src/ui/editor-store';
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import { command } from '../src/core/command-system';
function fixture() {
  const api = {
    recovery: { write: async () => {}, clear: async () => {} },
    platform: { getInfo: async () => ({ platform: 'darwin' }) },
    onAction: () => () => {},
    window: {
      setTitle: async () => {},
      setDocumentEdited: async () => {},
      close: vi.fn(),
    },
    dialog: { confirmUnsaved: vi.fn(async () => 'cancel') },
    project: {
      newProject: vi.fn(),
      save: vi.fn(async () => ({ path: '/tmp/test.swayframe', saved: true })),
      saveAs: vi.fn(),
    },
  } as unknown as DesktopAPI;
  const store = new EditorStore(createDefaultProject());
  const service = new ProjectService(store, api);
  const edit = () =>
    store.run('create', [
      command({
        type: 'layer.create',
        compositionId: activeComposition(store.getSnapshot().project).id,
        layer: createLayer('rectangle'),
      }),
    ]);
  return { store, service, api, edit };
}
describe('Project lifecycle', () => {
  it('opens the existing editor after new project', async () => {
    const f = fixture();
    expect(f.service.active).toBe(false);
    await f.service.newProject();
    expect(f.service.active).toBe(true);
    f.service.dispose();
  });
  it('tracks committed edits, undo to saved snapshot, and save failures', async () => {
    const f = fixture();
    f.edit();
    expect(f.service.dirty).toBe(true);
    f.store.undo();
    expect(f.service.dirty).toBe(false);
    f.edit();
    vi.mocked(f.api.project.save).mockRejectedValueOnce(new Error('disk'));
    expect(await f.service.save()).toBe(false);
    expect(f.service.dirty).toBe(true);
    expect(await f.service.save()).toBe(true);
    expect(f.service.dirty).toBe(false);
    f.service.dispose();
  });
  it('cancels destructive new and close, preserves dirty state', async () => {
    const f = fixture();
    f.edit();
    await f.service.newProject();
    await f.service.closeWindow();
    expect(f.api.project.newProject).not.toHaveBeenCalled();
    expect(f.api.window.close).not.toHaveBeenCalled();
    expect(f.service.dirty).toBe(true);
    f.service.dispose();
  });
  it('consolidates concurrent saves into one native write', async () => {
    const f = fixture();
    let resolve: (value: { path: string; saved: boolean }) => void = () => {};
    vi.mocked(f.api.project.save).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    f.edit();
    const first = f.service.save();
    const second = f.service.save();
    expect(f.api.project.save).toHaveBeenCalledTimes(1);
    resolve({ path: '/tmp/test.swayframe', saved: true });
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    f.service.dispose();
  });
  it('does not clear dirty when editing while a save is pending', async () => {
    const f = fixture();
    let resolve: (value: { path: string; saved: boolean }) => void = () => {};
    vi.mocked(f.api.project.save).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    f.edit();
    const saving = f.service.save();
    f.edit();
    resolve({ path: '/tmp/test.swayframe', saved: true });
    expect(await saving).toBe(false);
    expect(f.service.dirty).toBe(true);
    f.service.dispose();
  });
});
it('另存为使用当前工程路径作为对话框默认路径，成功后更新路径，取消保留原路径', async () => {
  const f = fixture();
  await f.service.save();
  vi.mocked(f.api.project.saveAs).mockResolvedValueOnce(null);
  expect(await f.service.save(true)).toBe(false);
  expect(f.service.path).toBe('/tmp/test.swayframe');
  expect(f.api.project.saveAs).toHaveBeenLastCalledWith(
    f.store.save(),
    '/tmp/test.swayframe',
  );
  vi.mocked(f.api.project.saveAs).mockResolvedValueOnce({
    path: '/tmp/copy.swayframe',
    saved: true,
  });
  expect(await f.service.save(true)).toBe(true);
  expect(f.service.path).toBe('/tmp/copy.swayframe');
  f.service.dispose();
});
it('相同冻结工程只序列化一次，预览不进入保存，提交/Undo后输出正确内容', async () => {
  const io = await import('../src/core/project-io');
  const serialize = vi.spyOn(io, 'saveProject');
  const store = new EditorStore(createDefaultProject());
  const first = store.save();
  for (let i = 0; i < 50; i++) {
    store.setTime(i / 30);
    store.save();
  }
  expect(serialize).toHaveBeenCalledTimes(1);
  const layer = createLayer('rectangle');
  store.run('新增', [
    command({
      type: 'layer.create',
      compositionId: store.getSnapshot().project.activeCompositionId,
      layer,
    }),
  ]);
  const second = store.save();
  store.save();
  expect(second).not.toBe(first);
  expect(serialize).toHaveBeenCalledTimes(2);
  store.setLayerPreview({ ...layer, width: 900 });
  expect(store.save()).toBe(second);
  store.undo();
  expect(store.save()).toBe(first);
  expect(serialize).toHaveBeenCalledTimes(3);
  serialize.mockRestore();
});
