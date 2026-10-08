import { useEffect, useRef } from 'react';
import { importModelFiles, modelAccept } from '../importers/model-import';
import type { EditorStore } from './editor-store';
/** File chooser belongs to the project import workflow, not the global toolbar surface. */
export function ModelImportInput({ store }: { store: EditorStore }) {
  const input = useRef<HTMLInputElement>(null),
    busy = useRef(false);
  useEffect(() => {
    const open = () => {
      if (!busy.current) input.current?.click();
    };
    window.addEventListener('motion:import-model', open);
    return () => window.removeEventListener('motion:import-model', open);
  }, []);
  return (
    <input
      ref={input}
      hidden
      type="file"
      multiple
      accept={modelAccept + ',.bin,.mtl,.png,.jpg,.jpeg,.webp'}
      aria-label="导入三维模型及依赖文件"
      onChange={async (e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = '';
        if (!files.length || busy.current) return;
        busy.current = true;
        try {
          await importModelFiles(store, files);
        } catch (error) {
          store.setStatus(
            error instanceof Error ? error.message : '模型导入失败',
            true,
          );
        } finally {
          busy.current = false;
        }
      }}
    />
  );
}
