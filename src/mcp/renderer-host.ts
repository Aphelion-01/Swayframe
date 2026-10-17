import { EditorOperations } from '../desktop/editor-operations';
import { getProjectService } from '../desktop/project-service';
import type { EditorStore } from '../ui/editor-store';
import type { MCPDesktopAPI } from './contract';
import { denied } from './contract';
/** One live adapter for the actual editor; no Scene copy and no Planner. */
export function attachMCPHost(store: EditorStore, api: MCPDesktopAPI) {
  const operations = new EditorOperations(store);
  let authorized = false;
  const pending = new Map<string, AbortController>();
  let project = store.commands.getSnapshot();
  const cancel = () => {
    authorized = false;
    for (const c of pending.values()) c.abort();
    pending.clear();
  };
  const unsubscribe = store.commands.subscribe(() => {
    const next = store.commands.getSnapshot();
    const entry = store.commands.undoStack.at(-1)?.transaction;
    if (
      next.id !== project.id ||
      (next !== project &&
        entry?.commands.some((c) => c.type === 'project.replace'))
    ) {
      cancel();
      void api.control({ action: 'disable' });
    }
    project = next;
  });
  const service = getProjectService(store);
  const unservice = service?.subscribe(() => {
    if (!service.active) {
      cancel();
      void api.control({ action: 'disable' });
    }
  });
  const unevent = api.onEvent((event) => {
    if (event.type === 'authorize') {
      authorized = true;
      return;
    }
    if (event.type === 'revoke') {
      cancel();
      return;
    }
    if (event.type === 'cancel') {
      pending.get(event.id)?.abort();
      return;
    }
    const { id, tool, args } = event.call;
    const controller = new AbortController();
    pending.set(id, controller);
    void (async () => {
      if (!authorized || !service?.active)
        return denied('当前没有打开的工程。');
      const options = { signal: controller.signal };
      store.setStatus('MCP：' + tool);
      switch (tool) {
        case 'sf_project_info':
          return operations.getProjectInfo();
        case 'sf_scene_tree':
          return operations.getSceneTree(args);
        case 'sf_inspect_layer':
          return operations.getLayerDetails(args);
        case 'sf_selection':
          return operations.getSelection(args);
        case 'sf_set_property':
          return operations.setLayerProperty(args, options);
        case 'sf_import_layer_package':
          return operations.importLayerPackage(args, options);
        case 'sf_render_frame':
          return operations.renderFrame(args, options);
      }
    })()
      .then((result) => {
        if (!controller.signal.aborted) {
          api.reply(id, result);
          store.setStatus(
            result.ok
              ? 'MCP 操作完成：' + tool
              : 'MCP 操作失败：' + result.error.message,
            !result.ok,
          );
        }
      })
      .catch(() => api.reply(id, denied('编辑器操作未完成。')))
      .finally(() => pending.delete(id));
  });
  return () => {
    cancel();
    unsubscribe();
    unservice?.();
    unevent();
    operations.dispose();
    void api.control({ action: 'disable' });
  };
}
