// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { AgentLibrary, registerPresetTools } from '../src/agent/library';
import { createAIPlatform } from '../src/ai/platform';
import { emptySession } from '../src/agent/session';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { CommandSystem, transaction } from '../src/core/command-system';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import { AgentTransaction } from '../src/agent/transaction';
import { registerCoreWriteTools } from '../src/agent/write-tools';
import { ProjectService } from '../src/desktop/project-service';
import type { DesktopAPI } from '../src/desktop/contracts';
import { EditorStore } from '../src/ui/editor-store';
import { loadProject, saveProject } from '../src/core/project-io';
afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});
it('history remains project-bound application data, excludes context/images and reopens independently', async () => {
  const platform = createAIPlatform(undefined, true),
    library = new AgentLibrary(platform.storage),
    p = createDefaultProject();
  await library.record(p, {
    ...emptySession(),
    status: 'completed',
    conversation: [{ role: 'user', content: 'make entrance' }],
    response: 'Done',
    selectedContext: { apiKey: 'secret-not-saved' },
    beforeSnapshot: 'data:image/png;base64,AAAA',
  });
  const raw = JSON.stringify(await platform.storage.readData('history'));
  expect(raw).not.toContain('secret-not-saved');
  expect(raw).not.toContain('data:image');
  expect(saveProject(p)).not.toContain('make entrance');
  const reopened = new AgentLibrary(platform.storage);
  await reopened.initialize();
  expect(reopened.getSnapshot().history[0]?.projectId).toBe(p.id);
  await reopened.clear(p.id);
  expect(reopened.getSnapshot().history).toHaveLength(0);
});
it('preset saves actual animation values/curves and applies with fresh key IDs through shared Undo', async () => {
  const library = new AgentLibrary(createAIPlatform(undefined, true).storage);
  await library.initialize();
  const source = createLayer('rectangle'),
    target = createLayer('rectangle'),
    position = {
      ...source.transform.position,
      keyframes: [
        {
          id: crypto.randomUUID(),
          time: 0,
          value: { x: -200, y: 540 },
          interpolation: {
            type: 'bezier' as const,
            out: { x: 0.1, y: 0.8 },
            in: { x: 0.3, y: 1 },
          },
        },
        {
          id: crypto.randomUUID(),
          time: 1,
          value: { x: 960, y: 540 },
          interpolation: { type: 'linear' as const },
        },
      ],
    };
  await library.savePreset(
    { ...source, transform: { ...source.transform, position } },
    'Real Entrance',
  );
  const preset = library.getSnapshot().presets[0]!,
    p = createDefaultProject(),
    host = new CommandSystem({
      ...p,
      compositions: [{ ...p.compositions[0]!, layers: [target] }],
    }),
    initial = host.getSnapshot(),
    registry = registerPresetTools(new AgentToolRegistry(), library);
  const result = host.executeTransaction(
    transaction(
      'apply',
      'agent',
      registry.compile(
        'applyAgentPreset',
        { presetId: preset.id, layerId: target.id },
        { project: initial, time: 0, selection: [target.id] },
      ),
    ),
  );
  expect(result.ok).toBe(true);
  const applied =
    host.getSnapshot().compositions[0]!.layers[0]!.transform.position;
  expect(applied.id).toBe(target.transform.position.id);
  expect(applied.keyframes[0]!.id).not.toBe(position.keyframes[0]!.id);
  expect(applied.keyframes[0]!.interpolation).toEqual(
    position.keyframes[0]!.interpolation,
  );
  expect(loadProject(saveProject(host.getSnapshot()))).toEqual(
    host.getSnapshot(),
  );
  host.undo();
  expect(host.getSnapshot()).toEqual(initial);
});
it('Agent commit triggers existing desktop dirty state and recovery; sandbox writes do not', async () => {
  vi.useFakeTimers();
  const p = createDefaultProject(),
    layer = createLayer('rectangle'),
    store = new EditorStore({
      ...p,
      compositions: [{ ...p.compositions[0]!, layers: [layer] }],
    });
  const write = vi.fn<DesktopAPI['recovery']['write']>(async () => {}),
    api = {
      recovery: { write, clear: async () => {} },
      platform: { getInfo: async () => ({ platform: 'darwin' }) },
      onAction: () => () => {},
      window: { setTitle: async () => {}, setDocumentEdited: async () => {} },
      project: {},
      dialog: {},
    } as unknown as DesktopAPI;
  const service = new ProjectService(store, api),
    draft = new AgentTransaction(
      store.commands,
      registerCoreWriteTools(new AgentToolRegistry()),
      store.commands.getSnapshot(),
      { time: 0, selection: [layer.id] },
    );
  try {
    await draft.execute(
      'setPosition',
      { layerId: layer.id, value: { x: 400, y: 300 } },
      new AbortController().signal,
    );
    expect(service.dirty).toBe(false);
    expect(write).not.toHaveBeenCalled();
    draft.commit('Agent move');
    expect(service.dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(1500);
    expect(write).toHaveBeenCalledOnce();
    expect(
      loadProject(write.mock.calls[0]![0] as unknown as string).compositions[0]!
        .layers[0]!.transform.position.baseValue,
    ).toEqual({ x: 400, y: 300 });
  } finally {
    service.dispose();
  }
});
