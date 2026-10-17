// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  sessionFixture,
  existing,
  rgb,
} from './helpers/agent-v2-session-fixture';
import { AgentPanel } from '../src/ui/AgentPanel';
import { AgentSnapshotRenderer } from '../src/agent/vision';
import { activeComposition } from '../src/core/project-model';
import { features } from '../src/shared/feature-catalog';
import { AIError } from '../src/ai/contracts';
import { modelUnavailableMessage } from '../src/ai/provider-diagnostics';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function setup() {
  const s = await sessionFixture();
  s.core.select('legacy-v1');
  vi.spyOn(AgentSnapshotRenderer.prototype, 'render').mockResolvedValue({
    image: 'data:image/png;base64,YQ==',
    pixelEvidence: { width: 10, height: 10, foregroundPixels: 1 },
  } as Awaited<ReturnType<AgentSnapshotRenderer['render']>>);
  render(
    <AgentPanel store={s.store} agent={s.native.agent} manager={s.manager} />,
  );
  return s;
}
const choose = () =>
  fireEvent.change(screen.getByLabelText('Agent 引擎'), {
    target: { value: 'core-v2' },
  });
const send = (value: string) => {
  fireEvent.change(screen.getByLabelText('V2 Agent 需求'), {
    target: { value },
  });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
};
it('actual AgentPanel defaults to V1, explicitly selects real V2, previews before commit and edits across turns', async () => {
  const s = await setup();
  expect(screen.getByText('Agent · Legacy V1')).toBeTruthy();
  expect(s.calls).toHaveLength(0);
  choose();
  expect(screen.getByText('Agent · Core V2 Beta')).toBeTruthy();
  s.enqueue([{ id: 'r', type: 'createShape', shape: 'rectangle' }]);
  send('创建矩形');
  await waitFor(() => expect(screen.getByText('接受修改')).toBeTruthy());
  expect(activeComposition(s.store.commands.getSnapshot()).layers).toHaveLength(
    0,
  );
  expect(screen.getByAltText('本轮草稿预览（尚未提交）')).toBeTruthy();
  fireEvent.click(screen.getByText('接受修改'));
  await waitFor(() =>
    expect(
      activeComposition(s.store.commands.getSnapshot()).layers,
    ).toHaveLength(1),
  );
  const id = activeComposition(s.store.commands.getSnapshot()).layers[0]!.id;
  s.enqueue([
    { id: 'f', type: 'setFill', target: existing(id), color: rgb(0, 0, 1) },
  ]);
  send('把刚才的矩形改为蓝色');
  await waitFor(() => expect(screen.getByText('接受修改')).toBeTruthy());
  fireEvent.click(screen.getByText('接受修改'));
  expect(s.store.commands.undoStack).toHaveLength(2);
  expect(activeComposition(s.store.commands.getSnapshot()).layers[0]!.id).toBe(
    id,
  );
  expect(
    activeComposition(s.store.commands.getSnapshot()).layers[0]!.editor
      ?.properties.fill?.baseValue,
  ).toEqual([0, 0, 1, 1]);
  fireEvent.click(screen.getByText('撤销本轮修改'));
  expect(activeComposition(s.store.commands.getSnapshot()).layers).toHaveLength(
    1,
  );
  s.store.redo();
  fireEvent.change(screen.getByLabelText('Agent 引擎'), {
    target: { value: 'legacy-v1' },
  });
  expect(screen.getByText('Agent · Legacy V1')).toBeTruthy();
});
it('reject preserves input, prevents duplicate sends and never promotes draft objects', async () => {
  const s = await setup();
  choose();
  s.enqueue([{ id: 't', type: 'createText', content: 'Cubic' }]);
  send('创建标题');
  await waitFor(() => expect(screen.getByText('拒绝草稿')).toBeTruthy());
  expect(
    (screen.getByRole('button', { name: '发送' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByText('拒绝草稿'));
  expect(
    (screen.getByLabelText('V2 Agent 需求') as HTMLTextAreaElement).value,
  ).toBe('创建标题');
  expect(s.core.session.references).toHaveLength(0);
  send('把刚才那个标题改为白色');
  await waitFor(() =>
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0),
  );
  expect(s.calls).toHaveLength(1);
  expect(
    (screen.getByLabelText('V2 Agent 需求') as HTMLTextAreaElement).value,
  ).toContain('白色');
});
it('actual assistant displays missing-channel guidance, retains the prompt and creates no draft objects', async () => {
  const s = await setup();
  choose();
  s.queued.push(async () => {
    throw new AIError('invalid_request', modelUnavailableMessage, {
      kind: 'http',
      status: 503,
      code: 'model_not_found',
    });
  });
  send('创建矩形');
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      modelUnavailableMessage,
    ),
  );
  expect(
    (screen.getByLabelText('V2 Agent 需求') as HTMLTextAreaElement).value,
  ).toBe('创建矩形');
  expect(s.calls).toHaveLength(1);
  expect(s.store.commands.undoStack).toHaveLength(0);
  expect(activeComposition(s.store.commands.getSnapshot()).layers).toHaveLength(
    0,
  );
  expect(screen.queryByText('接受修改')).toBeNull();
});
it('closing the real panel cancels pending draft, switching runtime discards it, features have one existing home', async () => {
  const s = await setup();
  choose();
  s.enqueue([{ id: 'r', type: 'createShape', shape: 'rectangle' }]);
  send('创建矩形');
  await waitFor(() => expect(screen.getByText('接受修改')).toBeTruthy());
  cleanup();
  expect(s.core.state?.phase).toBe('CANCELLED');
  expect(s.store.commands.undoStack).toHaveLength(0);
  for (const id of [
    'agent-runtime-choice',
    'agent-v2-new-session',
    'agent-export-diagnostic',
  ])
    expect(features.get(id)?.placement.canonical).toBe('assistant.actions');
});
