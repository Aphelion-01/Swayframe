// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { createNode } from '../src/core/compositing-registry';
import { insertGraphNode } from '../src/core/compositing-operations';
import { EditorStore } from '../src/ui/editor-store';
import { CompositingNodeInspector } from '../src/ui/CompositingNodeInspector';
afterEach(cleanup);
it('canonical Inspector entry works without mounted Graph workspace and defaults to parameter-only', () => {
  const p = createDefaultProject(),
    l = createLayer('rectangle'),
    n = createNode('gaussianBlur');
  const graph = insertGraphNode(l.editor!.graph!, n).graph;
  const layer = { ...l, editor: { ...l.editor!, graph } };
  const store = new EditorStore({
    ...p,
    compositions: [{ ...p.compositions[0]!, layers: [layer] }],
  });
  render(
    <CompositingNodeInspector
      store={store}
      layer={layer}
      graph={graph}
      node={n}
    />,
  );
  fireEvent.click(screen.getByText('用 AI 修改节点'));
  expect(screen.getByRole('dialog')).toBeDefined();
  expect(
    (screen.getByLabelText('AI 修改范围') as HTMLSelectElement).value,
  ).toBe('PARAMETER_ONLY');
  expect(screen.getByText(/可修改：高斯模糊/)).toBeDefined();
  fireEvent.click(screen.getByText('关闭'));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(store.commands.undoStack).toHaveLength(0);
});
