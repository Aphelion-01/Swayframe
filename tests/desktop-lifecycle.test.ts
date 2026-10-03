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
