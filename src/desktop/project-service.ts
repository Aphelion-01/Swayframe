import { RecoveryScheduler } from './recovery';
import type { Recovery } from './contracts';
import { setShortcutPlatform } from './platform';
import { editorAction } from './editor-actions';
import { createDefaultProject } from '../core/project-model';
import { saveProject } from '../core/project-io';
import type { EditorStore } from '../ui/editor-store';
import type { DesktopAPI } from './contracts';
import { ProductMetadata } from './product';
export class ProjectService {
  path: string | null = null;
  dirty = false;
  active = false;
  readonly recovery: RecoveryScheduler;
  #saved: string;
  #loading = false;
  #busy = false;
  #saving: Promise<boolean> | undefined;
  #generation = 0;
  #savingGeneration = 0;
  #projectId: string;
  #lastReplacementId: string | undefined;
  #listeners = new Set<() => void>();
  #platform = '';
  #cleanup: (() => void)[] = [];
  constructor(
    readonly store: EditorStore,
    readonly api: DesktopAPI,
  ) {
    this.#saved = store.save();
    this.#projectId = store.commands.getSnapshot().id;
    this.recovery = new RecoveryScheduler(
      api,
      () => ({ data: store.save(), path: this.path }),
      () => store.setStatus('恢复快照保存失败，请及时保存正式工程。', true),
    );
    this.#cleanup.push(
      store.commands.subscribe(() => {
        const project = store.commands.getSnapshot();
        const entry = store.commands.undoStack.at(-1)?.transaction;
        const replacement = entry?.commands.some(
          (c) => c.type === 'project.replace',
        );
        if (
          project.id !== this.#projectId ||
          (replacement && entry?.id !== this.#lastReplacementId)
        )
          this.#generation++;
        this.#projectId = project.id;
        if (replacement) this.#lastReplacementId = entry?.id;
        if (!this.#loading) {
          this.dirty = store.save() !== this.#saved;
          if (this.dirty) this.recovery.schedule();
          else void this.recovery.clear().catch(() => {});
          this.update();
        }
      }),
    );
    this.#cleanup.push(
      api.onAction((action, path) => {
        switch (action) {
          case 'new':
            void this.newProject();
            break;
          case 'open':
            void this.open(path);
            break;
          case 'save':
            void this.save();
            break;
          case 'save-as':
            void this.save(true);
            break;
          case 'close-project':
            void this.closeProject();
            break;
          case 'close-window':
            void this.closeWindow();
            break;
          default:
            editorAction(store, action);
        }
      }),
    );
    void api.platform
      .getInfo()
      .then((info) => {
        this.#platform = info.platform;
        setShortcutPlatform(info.platform);
        this.update();
      })
      .catch(() => {});
  }
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  getSnapshot = () => `${this.active}:${this.dirty}:${this.path}`;
  dispose() {
    this.recovery.dispose();
    for (const cleanup of this.#cleanup) cleanup();
  }
  update() {
    const name =
      this.path
        ?.split(/[\\/]/)
        .pop()
        ?.replace(/\.swayframe$/i, '') ?? this.store.getSnapshot().project.name;
    void this.api.window
      .setTitle(
        `${this.dirty && this.#platform !== 'darwin' ? '* ' : ''}${name} — ${ProductMetadata.displayName}`,
      )
      .catch(() => {});
    void this.api.window.setDocumentEdited(this.dirty).catch(() => {});
    for (const listener of this.#listeners) listener();
  }
  async protect(): Promise<boolean> {
    if (!this.dirty) return true;
    const choice = await this.api.dialog.confirmUnsaved(
      this.store.getSnapshot().project.name,
    );
    return choice === 'discard' || (choice === 'save' && (await this.save()));
  }
  private replace(data: string, path: string | null, dirty = false) {
    this.#loading = true;
    try {
      if (!this.store.load(data)) return false;
      this.path = path;
      this.#saved = this.store.save();
      this.dirty = dirty;
      this.active = true;
      this.update();
      return true;
    } finally {
      this.#loading = false;
    }
  }
  recover(recovery: Recovery) {
    this.replace(recovery.data, recovery.path, true);
    this.recovery.schedule();
  }
  async newProject() {
    if (this.#busy) return;
    this.#busy = true;
    try {
      if (!(await this.protect())) return;
      const owner = this.store.commands.getSnapshot();
      await this.recovery.clear();
      await this.api.project.newProject();
      if (this.store.commands.getSnapshot() !== owner) return;
      this.replace(saveProject(createDefaultProject()), null);
    } catch {
      this.store.setStatus('无法新建工程，请重试。', true);
    } finally {
      this.#busy = false;
    }
  }
  async open(path?: string) {
    if (this.#busy) return;
    this.#busy = true;
    try {
      if (!(await this.protect())) return;
      const owner = this.store.commands.getSnapshot();
      const result = await this.api.project.open(path);
      if (result) {
        if (this.store.commands.getSnapshot() !== owner) {
          this.store.setStatus(
            '打开期间工程已修改，已保留当前修改，请重新打开。',
            true,
          );
          return;
        }
        await this.recovery.clear();
        if (this.store.commands.getSnapshot() !== owner) return;
        this.replace(result.data, result.path);
      }
    } catch (error) {
      this.store.setStatus(
        error instanceof Error
          ? error.message
          : '无法打开工程，请检查文件内容或权限。',
        true,
      );
    } finally {
      this.#busy = false;
    }
  }
  save(saveAs = false): Promise<boolean> {
    if (this.#saving) {
      if (this.#savingGeneration === this.#generation) return this.#saving;
      return this.#saving.then(() => this.save(saveAs));
    }
    this.#savingGeneration = this.#generation;
    this.#saving = this.saveSnapshot(saveAs).finally(() => {
      this.#saving = undefined;
    });
    return this.#saving;
  }
  private async saveSnapshot(saveAs = false): Promise<boolean> {
    try {
      const generation = this.#generation;
      const data = this.store.save();
      const result = await (saveAs
        ? this.api.project.saveAs(data, this.path)
        : this.api.project.save(data, this.path));
      if (!result?.saved || generation !== this.#generation) return false;
      this.path = result.path;
      this.#saved = data;
      this.dirty = this.store.save() !== data;
      this.update();
      if (!this.dirty) await this.recovery.clear();
      else this.recovery.schedule();
      this.store.setStatus('工程已保存');
      return !this.dirty;
    } catch {
      this.store.setStatus('保存失败，请检查目标位置权限或剩余空间。', true);
      return false;
    }
  }
  async closeProject() {
    if (this.#busy) return;
    this.#busy = true;
    try {
      if (await this.protect()) {
        const owner = this.store.commands.getSnapshot();
        await this.recovery.clear();
        if (this.store.commands.getSnapshot() !== owner) return;
        this.replace(saveProject(createDefaultProject()), null);
        this.active = false;
        this.update();
      }
    } finally {
      this.#busy = false;
    }
  }
  async closeWindow() {
    if (this.#busy) return;
    this.#busy = true;
    try {
      if (await this.protect()) {
        const owner = this.store.commands.getSnapshot();
        await this.recovery.clear();
        if (this.store.commands.getSnapshot() !== owner) return;
        await this.api.window.close();
      }
    } catch {
      this.store.setStatus('无法关闭窗口，请先保存工程。', true);
    } finally {
      this.#busy = false;
    }
  }
}
const services = new WeakMap<EditorStore, ProjectService>();
export function bindProjectService(store: EditorStore, api: DesktopAPI) {
  const service = new ProjectService(store, api);
  services.set(store, service);
  return service;
}
export function getProjectService(store: EditorStore) {
  return services.get(store);
}
