// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import {
  agentFixture,
  agentFixturePlan,
  agentCaseNames,
} from '../src/dev/agent-fixtures';
import { createNativeAgent } from '../src/ui/native-agent-controller';
import { EditorStore } from '../src/ui/editor-store';
import { AIProviderManager } from '../src/ai/provider-manager';
import { createAIPlatform } from '../src/ai/platform';
import { MockAIProvider } from '../src/ai/mock-provider';
import { AIError } from '../src/ai/contracts';
import { skillsFor } from '../src/agent/skills';
import {
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import { motionSegments } from '../src/core/motion-curve';
import { evaluateProperty } from '../src/core/animation-engine';
import { saveProject, loadProject } from '../src/core/project-io';
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
it.each(agentCaseNames.map((name, index) => ({ name, index })))(
  'A14-$index $name',
  async ({ index }) => {
    const p = agentFixture(),
      store = new EditorStore(p),
      platform = createAIPlatform(undefined, true),
      manager = new AIProviderManager(platform.storage, platform.transport);
    await manager.initialize();
    const a = activeComposition(p).layers[0]!;
    store.select(a.id);
    let calls = 0;
    const plan = agentFixturePlan(index, p);
    const providerIds = [crypto.randomUUID(), crypto.randomUUID()];
    if (index !== 7)
      for (const [i, id] of providerIds.entries()) {
        if (i && index !== 6) continue;
        await manager.saveProvider({
          id,
          name: i ? 'Mock B' : 'Mock A',
          type: 'mock',
          baseUrl: 'https://example.invalid',
          enabled: true,
          defaultModel: 'mock',
          models: [
            { id: 'mock', name: 'mock', capabilities: ['text', 'vision'] },
          ],
        });
        manager.register(
          new MockAIProvider(id, 'Mock', async (_request, signal) => {
            calls++;
            if (index === 6 && i === 0) throw new AIError('rate_limit', '限流');
            if (index === 8) {
              await new Promise<void>((_r, reject) =>
                signal?.addEventListener(
                  'abort',
                  () => reject(new AIError('cancelled', '已停止')),
                  { once: true },
                ),
              );
            }
            return {
              text: '',
              model: 'mock',
              toolCalls: [{ id: 'plan', name: 'submitPlan', arguments: plan }],
            };
          }),
        );
      }
    const { agent, runtime } = createNativeAgent(store, manager);
    await waitFor(() =>
      expect(skillsFor(manager.storage).getSnapshot().ready).toBe(true),
    );
    const verification = vi.fn(async () => ({
      ok: true,
      message: 'Mock visual assessment after real draft',
      image: 'data:image/png;base64,AAAA',
    }));
    runtime.verify = verification;
    if (index === 5)
      agent.setReferences(
        [
          {
            id: crypto.randomUUID(),
            name: 'layout.png',
            kind: 'image',
            frames: ['data:image/png;base64,AAAA'],
          },
        ],
        'layout-only',
      );
    const initial = store.commands.getSnapshot();
    if (index === 8) {
      const work = agent.run('stop QA');
      await waitFor(() => expect(calls).toBe(1));
      agent.stop();
      await work;
      expect(agent.getSnapshot().status).toBe('cancelled');
      expect(store.commands.getSnapshot()).toBe(initial);
      return;
    }
    await agent.run(agentCaseNames[index]!);
    if (index === 7) {
      expect(agent.getSnapshot().status).toBe('failed');
      expect(agent.getSnapshot().error).toContain('配置');
      expect(store.commands.undoStack).toHaveLength(0);
      return;
    }
    expect(agent.getSnapshot().status).toBe('completed');
    expect(verification).toHaveBeenCalledOnce();
    expect(store.commands.undoStack).toHaveLength(1);
    const next = store.commands.getSnapshot(),
      layers = activeComposition(next).layers;
    if (index === 0 || index === 9) {
      const position = layers[0]!.transform.position;
      expect(position.keyframes).toHaveLength(2);
      expect(motionSegments(position)[0]?.curve).toMatchObject({
        x1: 0.1,
        y1: 0.8,
      });
      expect(evaluateProperty(position, 1)).toEqual({ x: 400, y: 300 });
    }
    if (index === 1)
      expect(
        layers.find((l) => l.type === 'text' && l.text === 'HELLO SWAYFRAME')
          ?.transform.position.baseValue,
      ).toEqual({ x: 960, y: 540 });
    if (index === 2) {
      expect(layers[2]!.editor!.properties.fontSize!.baseValue).toBe(96);
      expect(layers[2]!.editor!.properties.tracking!.baseValue).toBe(8);
    }
    if (index === 3)
      expect(
        layers[0]!.editor!.graph!.nodes.find((n) => n.type === 'gaussianBlur')
          ?.params.radius?.baseValue,
      ).toBe(12);
    if (index === 4) {
      expect(layers[0]!.transform.scale.baseValue).toEqual({ x: 1.2, y: 1.2 });
      expect(layers[0]!.transform.position.baseValue.x).toBeCloseTo(340);
      expect(layers[1]!.transform.position.baseValue.x).toBeCloseTo(1060);
    }
    if (index === 5) {
      expect(layers[0]!.transform.position.baseValue).toEqual({
        x: 640,
        y: 360,
      });
      expect(layers[0]!.editor!.properties.fill).toEqual(
        a.editor!.properties.fill,
      );
    }
    if (index === 6) {
      expect(calls).toBe(2);
      expect(manager.getSnapshot().fallback).toContain('Mock B');
    }
    if (index === 9) {
      const graphPlan = agentFixturePlan(3, next);
      manager.register(
        new MockAIProvider(providerIds[0]!, 'Mock', async () => ({
          text: '',
          model: 'mock',
          toolCalls: [{ id: 'p', name: 'submitPlan', arguments: graphPlan }],
        })),
      );
      await agent.run('blur too');
      const saved = saveProject(store.commands.getSnapshot());
      const reopened = loadProject(saved);
      expect(reopened).toEqual(store.commands.getSnapshot());
      expect(saved).not.toContain('conversation');
      expect(
        activeComposition(reopened).layers[0]!.editor!.graph!.nodes.some(
          (n) => n.type === 'gaussianBlur',
        ),
      ).toBe(true);
      store.commands.undo();
    }
    store.commands.undo();
    expect(store.commands.getSnapshot()).toEqual(initial);
  },
);
it('newly created layer can receive keyframes in the same typed plan and visual refinements retain one Undo', async () => {
  const p = agentFixture(),
    store = new EditorStore(p),
    platform = createAIPlatform(undefined, true),
    manager = new AIProviderManager(platform.storage, platform.transport);
  await manager.initialize();
  const id = crypto.randomUUID(),
    layerId = crypto.randomUUID();
  await manager.saveProvider({
    id,
    name: 'Mock',
    type: 'mock',
    baseUrl: 'https://example.invalid',
    enabled: true,
    defaultModel: 'm',
    models: [],
  });
  manager.register(
    new MockAIProvider(id, 'Mock', async () => ({
      text: '',
      model: 'm',
      toolCalls: [
        {
          id: 'p',
          name: 'submitPlan',
          arguments: {
            id: 'p',
            goal: 'new entrance',
            risk: 'low',
            steps: [
              {
                id: 'create',
                label: 'create',
                tool: 'createText',
                arguments: { layerId, content: 'New' },
              },
              {
                id: 'start',
                label: 'start',
                tool: 'addKeyframe',
                arguments: {
                  layerId,
                  property: 'position',
                  time: 0,
                  value: { x: 0, y: 540 },
                },
              },
              {
                id: 'end',
                label: 'end',
                tool: 'addKeyframe',
                arguments: {
                  layerId,
                  property: 'position',
                  time: 1,
                  value: { x: 960, y: 540 },
                },
              },
            ],
          },
        },
      ],
    })),
  );
  const { agent, runtime } = createNativeAgent(store, manager);
  await waitFor(() =>
    expect(skillsFor(manager.storage).getSnapshot().ready).toBe(true),
  );
  let iteration = 0;
  runtime.verify = async () =>
    ++iteration === 1
      ? {
          ok: false,
          message: 'refine',
          refinement: {
            id: 'r',
            goal: 'opacity',
            risk: 'low',
            steps: [
              {
                id: 'op',
                label: 'opacity',
                tool: 'setOpacity',
                arguments: { layerId, value: 0.8 },
              },
            ],
          },
        }
      : { ok: true, message: 'pass' };
  await agent.run('new entrance');
  expect(agent.getSnapshot().status).toBe('completed');
  expect(iteration).toBe(2);
  expect(store.commands.undoStack).toHaveLength(1);
  const layer = activeComposition(store.commands.getSnapshot()).layers.find(
    (l) => l.id === layerId,
  )!;
  expect(layer.transform.position.keyframes).toHaveLength(2);
  expect(layer.transform.opacity.baseValue).toBe(0.8);
});
it('visual verification clamps the current frame when a plan opens a shorter composition', async () => {
  vi.stubGlobal('CanvasRenderingContext2D', class {});
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    'data:image/png;base64,AAAA',
  );
  try {
    const store = new EditorStore(createDefaultProject());
    store.setTime(2);
    const platform = createAIPlatform(undefined, true),
      manager = new AIProviderManager(platform.storage, platform.transport);
    await manager.initialize();
    const id = crypto.randomUUID(),
      compositionId = crypto.randomUUID();
    await manager.saveProvider({
      id,
      name: 'Mock',
      type: 'mock',
      baseUrl: 'https://example.invalid',
      enabled: true,
      defaultModel: 'vision',
      models: [
        { id: 'vision', name: 'vision', capabilities: ['text', 'vision'] },
      ],
    });
    manager.register(
      new MockAIProvider(id, 'Mock', async (request) => ({
        text: '',
        model: 'vision',
        toolCalls:
          request.toolChoice === 'submitVisualAssessment'
            ? [
                {
                  id: 'v',
                  name: 'submitVisualAssessment',
                  arguments: { ok: true, message: 'pass', refinement: null },
                },
              ]
            : [
                {
                  id: 'p',
                  name: 'submitPlan',
                  arguments: {
                    id: 'p',
                    goal: 'short composition',
                    risk: 'low',
                    steps: [
                      {
                        id: 'create',
                        label: 'create',
                        tool: 'createComposition',
                        arguments: {
                          compositionId,
                          name: 'short',
                          width: 640,
                          height: 360,
                          fps: 30,
                          duration: 0.5,
                        },
                      },
                      {
                        id: 'open',
                        label: 'open',
                        tool: 'openComposition',
                        arguments: { compositionId },
                      },
                    ],
                  },
                },
              ],
      })),
    );
    const { agent } = createNativeAgent(store, manager);
    await waitFor(() =>
      expect(skillsFor(manager.storage).getSnapshot().ready).toBe(true),
    );
    await agent.run('short');
    expect(agent.getSnapshot().status, agent.getSnapshot().error ?? '').toBe(
      'completed',
    );
    expect(store.commands.getSnapshot().activeCompositionId).toBe(
      compositionId,
    );
    expect(store.commands.undoStack).toHaveLength(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
