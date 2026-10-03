import { createDefaultProject } from '../core/project-model';
import { loadProject, saveProject } from '../core/project-io';
import { EditorStore } from './editor-store';

export const STORAGE_KEY = 'motion-system.project.v0.1';
export interface ProjectStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function createPersistedStore(storage: ProjectStorage): EditorStore {
  let project = createDefaultProject();
  let warning = '';
  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (saved) project = loadProject(saved);
  } catch {
    warning = '本地缓存不可用，已打开空白工程；可从文件恢复';
  }
  const store = new EditorStore(project);
  let previous = store.commands.getSnapshot();
  store.subscribe(() => {
    const next = store.commands.getSnapshot();
    if (previous === next) return;
    previous = next;
    try {
      storage.setItem(STORAGE_KEY, saveProject(next));
    } catch {
      queueMicrotask(() =>
        store.setStatus('本地缓存空间不足，请使用“保存工程”导出文件', true),
      );
    }
  });
  if (warning) store.setStatus(warning, true);
  return store;
}
