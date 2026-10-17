import { expect, it } from 'vitest';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import {
  activeComposition,
  createComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import { AgentTransaction } from '../src/agent/transaction';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { registerReadTools } from '../src/agent/read-tools';
import { registerCompositingTools } from '../src/agent/compositing-tools';
import type { AgentPlan } from '../src/agent/session';
import { diagnosticData } from '../src/agent/execution-error';
const signal = new AbortController().signal;
const ref = (stepId: string, output = 'layerId') => ({
  kind: 'stepResult',
  stepId,
  output,
});
const color = { r: 0, g: 0.3, b: 1, a: 1 };
function setup(selection: string[] = [], project = createDefaultProject()) {
  const host = new CommandSystem(project);
  const registry = registerCompositingTools(
    registerReadTools(
      registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
    ),
  );
  const ctx = { project: host.getSnapshot(), selection, time: 0 };
  const draft = new AgentTransaction(host, registry, ctx.project, ctx);
  return { host, registry, draft, ctx };
}
function plan(steps: AgentPlan['steps']): AgentPlan {
  return { id: 'test', goal: 'object identity', risk: 'low', steps };
}
const step = (id: string, tool: string, args: Record<string, unknown>) => ({
  id,
  label: id,
  tool,
  arguments: args,
});
it('01 create rectangle -> radial fill binds a returned real UUID, deferred then native validation', async () => {
  const s = setup();
  const p = plan([
    step('create', 'createRectangle', {}),
    step('fill', 'setFill', {
      layerId: ref('create'),
      color,
      gradient: 'radial',
    }),
  ]);
  expect(s.registry.validatePlan(p, undefined, s.ctx).steps[1]?.status).toBe(
    'DEFERRED',
  );
  const created = (await s.draft.execute(
    'createRectangle',
    {},
    signal,
    'create',
  )) as { layerId: string };
  const fill = (await s.draft.execute(
    'setFill',
    p.steps[1]!.arguments,
    signal,
    'fill',
  )) as { resolution: { resolvedArguments: { layerId: string } } };
  expect(fill.resolution.resolvedArguments.layerId).toBe(created.layerId);
  expect(
    activeComposition(s.draft.getSnapshot()).layers[0]?.editor?.gradient,
  ).toBe('radial');
  s.draft.commit('test');
  expect(s.host.undoStack).toHaveLength(1);
  s.host.undo();
  expect(activeComposition(s.host.getSnapshot()).layers).toHaveLength(0);
  s.host.redo();
  expect(activeComposition(s.host.getSnapshot()).layers).toHaveLength(1);
});
it('02 text -> position -> opacity -> keyframe all resolve one real layer and property', async () => {
  const s = setup();
  await s.draft.execute('createText', { content: 'Object' }, signal, 'text');
  await s.draft.execute(
    'setPosition',
    { layerId: ref('text'), value: { x: 200, y: 100 } },
    signal,
    'position',
  );
  await s.draft.execute(
    'setOpacity',
    { layerId: ref('text'), value: 0.4 },
    signal,
    'opacity',
  );
  await s.draft.execute(
    'addKeyframe',
    { layerId: ref('text'), property: 'opacity', time: 1, value: 1 },
    signal,
    'frame',
  );
  const l = activeComposition(s.draft.getSnapshot()).layers[0]!;
  expect(l.transform.position.baseValue).toEqual({ x: 200, y: 100 });
  expect(l.transform.opacity.baseValue).toBe(0.4);
  expect(l.transform.opacity.keyframes).toHaveLength(1);
});
it('03 two creation results cannot cross-bind', async () => {
  const s = setup();
  await s.draft.execute('createRectangle', { name: 'A' }, signal, 'a');
  await s.draft.execute('createRectangle', { name: 'B' }, signal, 'b');
  await s.draft.execute('setFill', { layerId: ref('a'), color }, signal);
  await s.draft.execute(
    'setFill',
    { layerId: ref('b'), color: { ...color, r: 1 } },
    signal,
  );
  const ls = activeComposition(s.draft.getSnapshot()).layers;
  expect(
    ls.find((l) => l.name === 'A')?.editor?.properties.fill?.baseValue,
  ).toEqual([0, 0.3, 1, 1]);
  expect(
    ls.find((l) => l.name === 'B')?.editor?.properties.fill?.baseValue,
  ).toEqual([1, 0.3, 1, 1]);
});
it('04 READ uses live draft and leaves bindings intact', async () => {
  const s = setup();
  const p = plan([
    step('a', 'createRectangle', {}),
    step('read', 'inspectLayer', { layerId: ref('a') }),
    step('fill', 'setFill', { layerId: ref('a'), color }),
  ]);
  s.registry.validatePlan(p, undefined, s.ctx);
  await s.draft.execute('createRectangle', {}, signal, 'a');
  await s.draft.execute('inspectLayer', { layerId: ref('a') }, signal, 'read');
  await s.draft.execute(
    'setFill',
    { layerId: ref('a'), color },
    signal,
    'fill',
  );
  expect(activeComposition(s.draft.getSnapshot()).layers).toHaveLength(1);
});
it('05 graph creation result binds the requested node, typed nested connection and parameter', async () => {
  const s = setup();
  await s.draft.execute('createRectangle', {}, signal, 'a');
  const created = (await s.draft.execute(
    'createNode',
    { layerId: ref('a'), type: 'gaussianBlur' },
    signal,
    'node',
  )) as { nodeId: string };
  await s.draft.execute(
    'setNodeParameter',
    { nodeId: ref('node', 'nodeId'), key: 'radius', value: 12 },
    signal,
  );
  const g = activeComposition(s.draft.getSnapshot()).layers[0]!.editor!.graph!;
  const output = g.nodes.find((n) => n.type === 'output')!;
  const edge = g.edges.find(
    (e) => e.from.nodeId === created.nodeId && e.to.nodeId === output.id,
  )!;
  await s.draft.execute('disconnectEdge', { edgeId: edge.id }, signal);
  await s.draft.execute(
    'connectNodes',
    {
      from: { nodeId: ref('node', 'nodeId'), portId: 'out' },
      to: { nodeId: { kind: 'graphNode', nodeId: output.id }, portId: 'in' },
    },
    signal,
  );
  expect(
    activeComposition(
      s.draft.getSnapshot(),
    ).layers[0]?.editor?.graph?.nodes.find((n) => n.id === created.nodeId)
      ?.params.radius?.baseValue,
  ).toBe(12);
  await expect(
    s.draft.execute(
      'setFill',
      { layerId: ref('node', 'nodeId'), color },
      signal,
    ),
  ).rejects.toMatchObject({ cause: { reason: 'WRONG_OBJECT_TYPE' } });
});
it('06 selection resolves exactly the captured selected layer', async () => {
  const l = createLayer('rectangle'),
    p = createDefaultProject();
  const s = setup([l.id], {
    ...p,
    compositions: [{ ...p.compositions[0]!, layers: [l] }],
  });
  await s.draft.execute(
    'setFill',
    { layerId: { kind: 'selection', objectType: 'layer' }, color },
    signal,
  );
  expect(
    activeComposition(s.draft.getSnapshot()).layers[0]?.editor?.properties.fill
      ?.baseValue,
  ).toEqual([0, 0.3, 1, 1]);
});
it('07 multiple selection returns candidates without random edits', async () => {
  const s = setup([crypto.randomUUID(), crypto.randomUUID()]);
  await expect(
    s.draft.execute(
      'setFill',
      { layerId: { kind: 'selection', objectType: 'layer' }, color },
      signal,
    ),
  ).rejects.toMatchObject({
    cause: { reason: 'AMBIGUOUS_TARGET', candidates: s.ctx.selection },
  });
  expect(s.draft.commandCount).toBe(0);
});
it('08 valid but absent UUID is TARGET_NOT_FOUND', async () => {
  const s = setup();
  await expect(
    s.draft.execute('setFill', { layerId: crypto.randomUUID(), color }, signal),
  ).rejects.toMatchObject({
    code: 'TARGET_NOT_FOUND',
    cause: { reason: 'VALID_UUID_BUT_NOT_FOUND' },
  });
});
it('09 name or plan step masquerading as UUID is INVALID_OBJECT_ID', async () => {
  const s = setup();
  await expect(
    s.draft.execute('setFill', { layerId: 'create_background', color }, signal),
  ).rejects.toMatchObject({
    code: 'INVALID_OBJECT_ID',
    cause: { reason: 'INVALID_UUID_FORMAT' },
  });
});
it('10 failed predecessor cannot supply a binding; forward dependencies are rejected', async () => {
  const s = setup();
  await expect(
    s.draft.execute('createRectangle', { width: -1 }, signal, 'a'),
  ).rejects.toThrow();
  await expect(
    s.draft.execute('setFill', { layerId: ref('a'), color }, signal),
  ).rejects.toMatchObject({ cause: { reason: 'UNRESOLVED_STEP_REFERENCE' } });
  expect(() =>
    s.registry.validatePlan(
      plan([
        step('fill', 'setFill', { layerId: ref('a'), color }),
        step('a', 'createRectangle', {}),
      ]),
      undefined,
      s.ctx,
    ),
  ).toThrow('任务依赖与执行顺序不符');
  expect(s.host.undoStack).toHaveLength(0);
});
it('11 a rebuilt draft rebinds from actual results and never replays a completed step', async () => {
  const s = setup();
  const a = (await s.draft.execute('createRectangle', {}, signal, 'a')) as {
    layerId: string;
  };
  await expect(
    s.draft.execute('createRectangle', {}, signal, 'a'),
  ).rejects.toThrow('cannot be replayed');
  s.draft.discard();
  const retry = new AgentTransaction(s.host, s.registry, s.ctx.project, s.ctx);
  await expect(
    retry.execute('setFill', { layerId: ref('a'), color }, signal),
  ).rejects.toThrow('UNRESOLVED_STEP_REFERENCE');
  const b = (await retry.execute('createRectangle', {}, signal, 'a')) as {
    layerId: string;
  };
  expect(b.layerId).not.toBe(a.layerId);
  await retry.execute('setFill', { layerId: ref('a'), color }, signal);
  retry.commit('retry');
  expect(activeComposition(s.host.getSnapshot()).layers).toHaveLength(1);
});
it('12 concurrent user editing still prevents commit', async () => {
  const s = setup();
  await s.draft.execute('createRectangle', {}, signal, 'a');
  const l = createLayer('text');
  s.host.executeTransaction(
    transaction('human', 'human', [
      command({
        type: 'layer.create',
        compositionId: s.ctx.project.activeCompositionId,
        layer: l,
      }),
    ]),
  );
  expect(() => s.draft.commit('bad')).toThrow('工程已修改');
  expect(activeComposition(s.host.getSnapshot()).layers).toEqual([l]);
});
it('wrong object type, wrong composition, stale binding and missing targets stay distinct', async () => {
  const s = setup();
  await expect(
    s.draft.execute(
      'setFill',
      { layerId: s.ctx.project.activeCompositionId, color },
      signal,
    ),
  ).rejects.toMatchObject({ cause: { reason: 'WRONG_OBJECT_TYPE' } });
  await expect(
    s.draft.execute('setFill', { color }, signal),
  ).rejects.toMatchObject({ cause: { reason: 'MISSING_TARGET' } });
  const l = createLayer('rectangle');
  const c = createComposition({ name: 'Other' });
  const t = setup([], {
    ...s.ctx.project,
    compositions: [...s.ctx.project.compositions, { ...c, layers: [l] }],
  });
  await expect(
    t.draft.execute('setFill', { layerId: l.id, color }, signal),
  ).rejects.toMatchObject({ cause: { reason: 'WRONG_COMPOSITION' } });
  const dangerous = new AgentTransaction(
    s.host,
    s.registry,
    s.ctx.project,
    s.ctx,
    true,
  );
  await dangerous.execute('createRectangle', {}, signal, 'a');
  await dangerous.execute('deleteLayer', { layerId: ref('a') }, signal);
  await expect(
    dangerous.execute('setFill', { layerId: ref('a'), color }, signal),
  ).rejects.toMatchObject({ cause: { reason: 'STALE_OBJECT_REFERENCE' } });
});
it('diagnostic redaction keeps identities, removes credentials and image data', () => {
  const d = diagnosticData({
    apiKey: 'private',
    images: ['data:image/png;base64,secret'],
    toolCalls: [
      { arguments: { layerId: ref('a') }, message: 'Bearer private-token' },
    ],
  });
  expect(JSON.stringify(d)).not.toContain('private');
  expect(JSON.stringify(d)).toContain('stepResult');
});

it('scope failure closes the draft and never publishes an out-of-scope semantic edit', async () => {
  const s = setup();
  const draft = new AgentTransaction(
    s.host,
    s.registry,
    s.ctx.project,
    s.ctx,
    false,
    undefined,
    () => {
      throw new AgentExecutionError({
        code: 'CONTEXT_INVALID',
        phase: 'preflight',
        recoverable: false,
        message: 'scope',
        cause: { reason: 'OUT_OF_SCOPE_TARGET' },
      });
    },
  );
  await expect(
    draft.execute('createRectangle', {}, signal, 'a'),
  ).rejects.toMatchObject({ cause: { reason: 'OUT_OF_SCOPE_TARGET' } });
  await expect(
    draft.execute('createRectangle', {}, signal, 'b'),
  ).rejects.toThrow('已结束');
  expect(s.host.undoStack).toHaveLength(0);
});
import { AgentExecutionError } from '../src/agent/execution-error';
import { IntelligenceService } from '../src/agent/intelligence';
import { AgentOrchestrator } from '../src/agent/orchestrator';
import { defaultAISettings } from '../src/ai/contracts';
import { vi } from 'vitest';
it('advisory duplicate patch rejection stops without repeating validation or writing the scene', async () => {
  const s = setup();
  const invalid = plan([
    step('a', 'createRectangle', {}),
    step('fill', 'setFill', { layerId: 'a', color }),
  ]);
  let calls = 0;
  const model = {
    chat: vi.fn(async () => ({
      text: '',
      model: 'scripted',
      toolCalls: [
        calls++ === 0
          ? { id: 'call', name: 'submitProposal', arguments: invalid }
          : {
              id: 'patch',
              name: 'repairPlan',
              arguments: { planId: invalid.id },
            },
      ],
    })),
  };
  const validate = vi.fn((p: AgentPlan) =>
    s.registry.validatePlan(p, undefined, s.ctx),
  );
  await expect(
    new IntelligenceService(model).analyzeColor(
      {
        goal: 'test',
        context: {},
        tools: s.registry.definitions(),
        validatePlan: validate,
      },
      signal,
    ),
  ).rejects.toMatchObject({
    toolName: 'setFill',
    phase: 'preflight',
    received: 'a',
    cause: { traceLocation: 'session.recoveryTrace' },
  });
  expect(model.chat).toHaveBeenCalledTimes(2);
  expect(validate).toHaveBeenCalledTimes(2);
  expect(s.host.undoStack).toHaveLength(0);
});
it('advisory retry corrects a rejected literal into an explicit reference and returns Proposal only', async () => {
  const s = setup();
  const invalid = plan([
    step('a', 'createRectangle', {}),
    step('fill', 'setFill', { layerId: 'a', color }),
  ]);
  const valid = plan([
    step('a', 'createRectangle', {}),
    step('fill', 'setFill', { layerId: ref('a'), color }),
  ]);
  let calls = 0;
  const service = new IntelligenceService({
    chat: async () => ({
      text: '',
      model: 'scripted',
      toolCalls: [
        {
          id: 'call',
          name: calls ? 'repairPlan' : 'submitProposal',
          arguments: calls++
            ? {
                planId: invalid.id,
                stepPatches: [
                  { id: 'fill', arguments: valid.steps[1]!.arguments },
                ],
              }
            : invalid,
        },
      ],
    }),
  });
  const proposal = await service.analyzeColor(
    {
      goal: 'test',
      context: {},
      tools: s.registry.definitions(),
      validatePlan: (p) => s.registry.validatePlan(p, undefined, s.ctx),
    },
    signal,
  );
  expect(proposal.plan).toEqual(valid);
  expect(s.host.undoStack).toHaveLength(0);
  expect(calls).toBe(2);
});
it('Orchestrator resolves creation references without extra model recovery or extra commits', async () => {
  const s = setup();
  const p = plan([
    step('a', 'createRectangle', {}),
    step('fill', 'setFill', { layerId: ref('a'), color }),
  ]);
  const settings = defaultAISettings();
  settings.agent.autoApplySafe = true;
  settings.agent.visualVerification = false;
  const chat = vi.fn(async () => ({
    text: '',
    model: 'scripted',
    toolCalls: [{ id: 'call', name: 'submitPlan', arguments: p }],
  }));
  const agent = new AgentOrchestrator(
    {
      project: s.host.getSnapshot,
      context: () => ({}),
      tools: () => s.registry.definitions(),
      permission: (n, a) => s.registry.permission(n, a),
      validate: (p, project) => {
        s.registry.validatePlan(p, undefined, {
          ...s.ctx,
          project: project ?? s.ctx.project,
        });
      },
      begin: () => s.draft,
    },
    { chat },
    () => settings,
  );
  await agent.run('Create fill');
  expect(agent.getSnapshot().status).toBe('completed');
  expect(chat).toHaveBeenCalledTimes(1);
  expect(s.host.undoStack).toHaveLength(1);
  expect(agent.getSnapshot().toolCalls[1]?.stepId).toBe('fill');
});
it('execution recovery uses completed step results, edits only the failed step and does not duplicate creation', async () => {
  const s = setup();
  const p = plan([
    step('a', 'createRectangle', {}),
    step('fill', 'setFill', { layerId: ref('a'), color }),
  ]);
  const settings = defaultAISettings();
  settings.agent.autoApplySafe = true;
  settings.agent.visualVerification = false;
  let calls = 0,
    failed = false;
  const agent = new AgentOrchestrator(
    {
      project: s.host.getSnapshot,
      context: () => ({}),
      tools: () => s.registry.definitions(),
      permission: (n, a) => s.registry.permission(n, a),
      validate: (p, project) => {
        s.registry.validatePlan(p, undefined, {
          ...s.ctx,
          project: project ?? s.ctx.project,
        });
      },
      begin: () => ({
        getSnapshot: s.draft.getSnapshot,
        resolveArguments: s.draft.resolveArguments,
        discard: () => s.draft.discard(),
        commit: (l) => s.draft.commit(l),
        execute: async (n, a, signal, id) => {
          if (n === 'setFill' && !failed) {
            failed = true;
            throw new AgentExecutionError({
              code: 'SCHEMA_INVALID',
              phase: 'execute',
              field: 'color',
              toolName: n,
              recoverable: true,
              message: 'controlled fault',
            });
          }
          return s.draft.execute(n, a, signal, id);
        },
      }),
    },
    {
      chat: async (_task, request) => {
        if (calls++)
          expect(JSON.stringify(request)).toContain('Completed step results');
        return {
          text: '',
          model: 'scripted',
          toolCalls: [
            {
              id: 'call',
              name: 'submitPlan',
              arguments:
                calls === 1
                  ? p
                  : plan([
                      step('fill', 'setFill', {
                        layerId: ref('a'),
                        color: { ...color, g: 0.4 },
                      }),
                    ]),
            },
          ],
        };
      },
    },
    () => settings,
  );
  await agent.run('test');
  expect(agent.getSnapshot().status).toBe('completed');
  expect(activeComposition(s.host.getSnapshot()).layers).toHaveLength(1);
  expect(s.host.undoStack).toHaveLength(1);
  expect(agent.getSnapshot().recoveries?.[0]?.outcome).toBe('resumed');
});
it('mask and nullable parenting tools resolve their references through the same boundary', async () => {
  const s = setup();
  await s.draft.execute('createRectangle', {}, signal, 'parent');
  await s.draft.execute('createRectangle', {}, signal, 'child');
  await s.draft.execute(
    'setParent',
    { layerId: ref('child'), parentId: ref('parent') },
    signal,
  );
  await s.draft.execute(
    'createMask',
    { layerId: ref('child'), kind: 'rectangle' },
    signal,
    'mask',
  );
  await s.draft.execute(
    'setMaskOpacity',
    { layerId: ref('child'), maskId: ref('mask', 'maskId'), value: 0.5 },
    signal,
  );
  const ls = activeComposition(s.draft.getSnapshot()).layers;
  const child = ls.find((l) => l.editor?.parentId)!;
  expect(child.editor?.masks[0]?.opacity.baseValue).toBe(0.5);
  expect(ls.some((l) => l.id === child.editor?.parentId)).toBe(true);
  await s.draft.execute(
    'setParent',
    { layerId: ref('child'), parentId: null },
    signal,
  );
  expect(
    activeComposition(s.draft.getSnapshot()).layers.find(
      (l) => l.id === child.id,
    )?.editor?.parentId,
  ).toBeNull();
});
it('effect and keyframe outputs resolve actual graph/property/frame identities without duplicating effects', async () => {
  const s = setup();
  await s.draft.execute('createRectangle', {}, signal, 'layer');
  const added = (await s.draft.execute(
    'addEffect',
    { layerId: ref('layer'), kind: 'gaussianBlur' },
    signal,
    'effect',
  )) as { effectId: string; nodeId: string; propertyId: string };
  expect(added.effectId).toBe(added.nodeId);
  await s.draft.execute(
    'setEffectParameter',
    {
      layerId: ref('layer'),
      effectId: ref('effect', 'effectId'),
      key: 'radius',
      value: 7,
    },
    signal,
  );
  const radius = activeComposition(
    s.draft.getSnapshot(),
  ).layers[0]!.editor!.graph!.nodes.find((n) => n.id === added.nodeId)!.params
    .radius!;
  expect(added.propertyId).toBe(radius.id);
  await s.draft.execute(
    'addKeyframe',
    { propertyId: ref('effect', 'propertyId'), time: 1, value: 9 },
    signal,
    'frame',
  );
  await s.draft.execute(
    'setKeyframeValue',
    {
      propertyId: ref('effect', 'propertyId'),
      keyframeId: ref('frame', 'keyframeId'),
      value: 11,
    },
    signal,
  );
  const next = activeComposition(s.draft.getSnapshot()).layers[0]!.editor!
    .graph!;
  expect(next.nodes.filter((n) => n.type === 'gaussianBlur')).toHaveLength(1);
  expect(
    next.nodes.find((n) => n.id === added.nodeId)?.params.radius?.keyframes[0]
      ?.value,
  ).toBe(11);
});
