import { expect, it } from 'vitest';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import { registerCoreWriteTools } from '../src/agent/write-tools';
import { registerReadTools } from '../src/agent/read-tools';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import type { AgentPlan } from '../src/agent/session';
const fill = { color: { r: 0, g: 1, b: 1, a: 1 }, gradient: 'radial' };
function setup() {
  const layer = createLayer('rectangle');
  const base = createDefaultProject();
  const host = new CommandSystem({
    ...base,
    compositions: [{ ...base.compositions[0]!, layers: [layer] }],
  });
  const registry = registerReadTools(
    registerCoreWriteTools(new AgentToolRegistry()),
  );
  const context = {
    project: host.getSnapshot(),
    selection: [layer.id],
    time: 0,
  };
  return { layer, host, registry, context };
}
function plan(steps: AgentPlan['steps']): AgentPlan {
  return { id: 'regression', goal: 'Audit regression', risk: 'low', steps };
}
it('R1 rejects negative radial radius in the declared contract, before compilation', () => {
  const s = setup();
  expect(() =>
    s.registry.permission('setFill', {
      ...fill,
      layerId: s.layer.id,
      radialParameters: { radius: -1 },
    }),
  ).toThrow('radius');
});
it('R1 rejects unknown radial parameter in the declared contract', () => {
  const s = setup();
  expect(() =>
    s.registry.permission('setFill', {
      ...fill,
      layerId: s.layer.id,
      radialParameters: { unknown: 1 },
    }),
  ).toThrow('未知径向渐变参数');
});
it('R2 returns structured target incompatibility instead of generic tool_failed', () => {
  const s = setup();
  const camera = createLayer('camera');
  s.host.executeTransaction(
    transaction('fixture', 'agent', [
      command({
        type: 'layer.create',
        compositionId: s.context.project.activeCompositionId,
        layer: camera,
      }),
    ]),
  );
  let error: unknown;
  try {
    s.registry.compile(
      'setFill',
      { ...fill, layerId: camera.id },
      { ...s.context, project: s.host.getSnapshot() },
    );
  } catch (e) {
    error = e;
  }
  expect(error).toMatchObject({
    code: 'SEMANTIC_INVALID',
    phase: 'compile',
    toolName: 'setFill',
    field: 'layerId',
    targetId: camera.id,
    recoverable: true,
  });
});
it('R3 does not omit an invalid WRITE after READ', () => {
  const s = setup();
  expect(() =>
    s.registry.validatePlan(
      plan([
        {
          id: 'read',
          label: 'read',
          tool: 'inspectLayer',
          arguments: { layerId: s.layer.id },
        },
        {
          id: 'fill',
          label: 'fill',
          tool: 'setFill',
          arguments: {
            ...fill,
            layerId: s.layer.id,
            radialParameters: { radius: -1 },
          },
        },
      ]),
      undefined,
      s.context,
    ),
  ).toThrow('radius');
  expect(s.host.undoStack).toHaveLength(0);
});
it('R3 validates target compatibility after READ', () => {
  const s = setup();
  const camera = createLayer('camera');
  s.host.executeTransaction(
    transaction('fixture', 'agent', [
      command({
        type: 'layer.create',
        compositionId: s.context.project.activeCompositionId,
        layer: camera,
      }),
    ]),
  );
  expect(() =>
    s.registry.validatePlan(
      plan([
        {
          id: 'read',
          label: 'read',
          tool: 'inspectLayer',
          arguments: { layerId: camera.id },
        },
        {
          id: 'fill',
          label: 'fill',
          tool: 'setFill',
          arguments: { ...fill, layerId: camera.id },
        },
      ]),
      undefined,
      { ...s.context, project: s.host.getSnapshot() },
    ),
  ).toThrow('填充');
});
it('R5 accepts add then update same keyframe ID and rejects wrong final value', () => {
  const s = setup();
  const id = crypto.randomUUID();
  const p = s.layer.transform.rotation;
  const commands = [
    command({
      type: 'keyframe.add',
      propertyId: p.id,
      keyframe: {
        id,
        time: 0,
        value: 10,
        interpolation: { type: 'linear' as const },
      },
    }),
    command({
      type: 'keyframe.update',
      propertyId: p.id,
      keyframeId: id,
      patch: { value: 20 },
    }),
  ];
  const base = s.host.getSnapshot();
  expect(
    s.host.executeTransaction(transaction('fixture', 'agent', commands)).ok,
  ).toBe(true);
  expect(() =>
    s.registry.verifyResults(commands, s.host.getSnapshot()),
  ).not.toThrow();
  expect(() => s.registry.verifyResults(commands, base)).toThrow();
});
it('R5 accepts create then delete instead of expecting a deleted layer', () => {
  const s = setup();
  const layer = createLayer('text');
  const c = s.context.project.activeCompositionId;
  const commands = [
    command({ type: 'layer.create', compositionId: c, layer }),
    command({ type: 'layer.delete', compositionId: c, layerId: layer.id }),
  ];
  expect(
    s.host.executeTransaction(transaction('fixture', 'agent', commands)).ok,
  ).toBe(true);
  expect(() =>
    s.registry.verifyResults(commands, s.host.getSnapshot()),
  ).not.toThrow();
});

import { AgentOrchestrator } from '../src/agent/orchestrator';
import { AgentTransaction } from '../src/agent/transaction';
import {
  AgentExecutionError,
  errorFeedback,
  executionError,
} from '../src/agent/execution-error';
import { defaultAISettings } from '../src/ai/contracts';
import type { ChatRequest } from '../src/ai/contracts';
import type {
  AgentTransactionPort,
  AgentRuntimePort,
} from '../src/agent/session';
import { saveProject, loadProject } from '../src/core/project-io';
import { z } from 'zod';
const rectId = '00000000-0000-4000-8000-000000000027';
const textId = '00000000-0000-4000-8000-000000000028';
const creation = (): AgentPlan =>
  plan([
    {
      id: 'rect',
      label: 'rectangle',
      tool: 'createRectangle',
      arguments: { layerId: rectId },
    },
    {
      id: 'text',
      label: 'text',
      tool: 'createText',
      arguments: { layerId: textId, content: '恢复验证' },
    },
    {
      id: 'fill',
      label: 'fill',
      tool: 'setFill',
      arguments: {
        ...fill,
        layerId: rectId,
        radialParameters: { radius: 0.5 },
      },
    },
    {
      id: 'read',
      label: 'read',
      tool: 'inspectLayer',
      arguments: { layerId: rectId },
    },
    {
      id: 'move',
      label: 'move',
      tool: 'setPosition',
      arguments: { layerId: rectId, value: { x: 500, y: 400 } },
    },
  ]);
const repair = (radius: number): AgentPlan =>
  plan([
    {
      ...creation().steps[2]!,
      arguments: { ...fill, layerId: rectId, radialParameters: { radius } },
    },
  ]);
function runtimeFixture(
  responses: AgentPlan[],
  options: {
    inject?: boolean;
    onChat?: (index: number, host: CommandSystem) => Promise<void> | void;
    permanentFailure?: boolean;
  } = {},
) {
  const host = new CommandSystem(createDefaultProject());
  const base = host.getSnapshot();
  const registry = registerReadTools(
    registerCoreWriteTools(new AgentToolRegistry()),
  );
  let calls = 0,
    injected = false,
    commits = 0;
  const requests: Omit<ChatRequest, 'model'>[] = [];
  const runtime: AgentRuntimePort = {
    project: host.getSnapshot,
    context: () => ({}),
    tools: () => registry.definitions(),
    permission: (name, args) => registry.permission(name, args),
    validate: (p, project) => {
      registry.validatePlan(p, undefined, {
        project: project ?? base,
        time: 0,
        selection: [],
      });
    },
    begin: () => {
      const draft = new AgentTransaction(host, registry, base, {
        time: 0,
        selection: [],
      });
      const port: AgentTransactionPort = {
        getSnapshot: draft.getSnapshot,
        discard: () => draft.discard(),
        commit: (label) => {
          commits++;
          return draft.commit(label);
        },
        execute: async (name, args, signal) => {
          // Inject one deterministic execution-time semantic failure before any command
          // for this step. All scene/transaction/validation logic remains the real implementation.
          if (
            name === 'setFill' &&
            options.inject &&
            (!injected || options.permanentFailure)
          ) {
            injected = true;
            throw new AgentExecutionError({
              code: 'SEMANTIC_INVALID',
              phase: 'compile',
              toolName: name,
              field: 'radialParameters.radius',
              expected: '0.8',
              received: 0.5,
              recoverable: true,
              message: '受控执行期参数错误',
            });
          }
          return draft.execute(name, args, signal);
        },
      };
      return port;
    },
  };
  const settings = defaultAISettings();
  settings.agent.visualVerification = false;
  settings.agent.autoApplySafe = true;
  const agent = new AgentOrchestrator(
    runtime,
    {
      chat: async (_task, request) => {
        const index = calls++;
        requests.push(request);
        await options.onChat?.(index, host);
        return {
          text: '',
          model: 'controlled fixture; not live',
          toolCalls: [
            {
              id: 'fixture-' + index,
              name:
                request.toolChoice === 'repairPlan'
                  ? 'repairPlan'
                  : 'submitPlan',
              arguments:
                request.toolChoice === 'repairPlan'
                  ? {
                      planId: responses[0]!.id,
                      stepPatches: responses[
                        Math.min(index, responses.length - 1)
                      ]!.steps.map(({ id, arguments: args }) => ({
                        id,
                        arguments: args,
                      })),
                    }
                  : responses[Math.min(index, responses.length - 1)]!,
            },
          ],
        };
      },
    },
    () => settings,
  );
  return {
    host,
    base,
    registry,
    agent,
    requests,
    calls: () => calls,
    commits: () => commits,
  };
}
it('TEST-A and R2: field-level planning feedback remains parseable and repaired arguments really change', async () => {
  const bad = plan([
    {
      id: 'text',
      label: 'text',
      tool: 'createText',
      arguments: { content: 22, fontSize: -1 },
    },
  ]);
  const good = plan([
    { ...bad.steps[0]!, arguments: { content: 'Recovered', fontSize: 36 } },
  ]);
  const s = runtimeFixture([bad, good]);
  await s.agent.run('create text');
  expect(s.agent.getSnapshot().status).toBe('completed');
  expect(s.calls()).toBe(2);
  const content = s.requests[1]!.messages.at(-1)!.content;
  expect(JSON.parse(content).error).toMatchObject({
    errorCode: 'TOOL_ARGUMENT_INVALID',
    field: 'content',
    category: 'MODEL_REPAIR_REQUIRED',
  });
  expect(s.host.getSnapshot().compositions[0]!.layers[0]).toMatchObject({
    text: 'Recovered',
    fontSize: 36,
  });
});
it('TEST-B: repeated invalid plan stops, no partial official change', async () => {
  const bad = plan([
    {
      id: 'text',
      label: 'text',
      tool: 'createText',
      arguments: { text: 'wrong alias' },
    },
  ]);
  const s = runtimeFixture([bad, bad]);
  await s.agent.run('create text');
  expect(s.agent.getSnapshot().status).toBe('failed');
  expect(s.calls()).toBe(2);
  expect(s.commits()).toBe(0);
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('TEST-C: two draft creates, late correction, READ/WRITE continue, one commit and Undo/Redo', async () => {
  const s = runtimeFixture([creation(), repair(0.8)], { inject: true });
  await s.agent.run('create and fill');
  expect(s.agent.getSnapshot().status).toBe('completed');
  expect(s.calls()).toBe(2);
  expect(s.commits()).toBe(1);
  const project = s.host.getSnapshot();
  expect(project.compositions[0]!.layers).toHaveLength(2);
  expect(
    project.compositions[0]!.layers[0]!.editor?.properties.radial_radius
      ?.baseValue,
  ).toBe(0.8);
  expect(
    project.compositions[0]!.layers[0]!.transform.position.baseValue,
  ).toEqual({ x: 500, y: 400 });
  expect(s.agent.getSnapshot().recoveries?.at(-1)?.outcome).toBe('resumed');
  expect(s.host.undoStack).toHaveLength(1);
  expect(loadProject(saveProject(project))).toEqual(project);
  s.host.undo();
  expect(s.host.getSnapshot()).toEqual(s.base);
  s.host.redo();
  expect(s.host.getSnapshot()).toEqual(project);
});
it('TEST-D: a concurrent human edit during recovery is preserved without Agent commit', async () => {
  const s = runtimeFixture([creation(), repair(0.8)], {
    inject: true,
    onChat: (index, host) => {
      if (index === 1)
        host.executeTransaction(
          transaction('human', 'human', [
            command({
              type: 'project.replace',
              project: { ...host.getSnapshot(), name: 'Human edit' },
            }),
          ]),
        );
    },
  });
  await s.agent.run('create and fill');
  expect(s.agent.getSnapshot().status).toBe('failed');
  expect(s.commits()).toBe(0);
  expect(s.host.getSnapshot().name).toBe('Human edit');
  expect(s.host.getSnapshot().compositions[0]!.layers).toHaveLength(0);
  expect(s.host.undoStack).toHaveLength(1);
});
it('TEST-E: READ then invalid WRITE is detected during planning and corrected before execution', async () => {
  const s = setup();
  const invalid = plan([
    {
      id: 'read',
      label: 'read',
      tool: 'inspectLayer',
      arguments: { layerId: s.layer.id },
    },
    {
      id: 'write',
      label: 'write',
      tool: 'setFill',
      arguments: {
        ...fill,
        layerId: s.layer.id,
        radialParameters: { radius: -1 },
      },
    },
  ]);
  expect(() => s.registry.validatePlan(invalid, undefined, s.context)).toThrow(
    'radius',
  );
  expect(s.host.getSnapshot()).toBe(s.context.project);
});
it('TEST-H: cancel while recovery awaits the model, no subsequent draft writes/commit', async () => {
  let release!: () => void;
  let entered!: () => void;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const s = runtimeFixture([creation(), repair(0.8)], {
    inject: true,
    onChat: async (index) => {
      if (index === 1) {
        entered();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
    },
  });
  const running = s.agent.run('create and fill');
  await waiting;
  s.agent.stop();
  release();
  await running;
  expect(s.agent.getSnapshot().status).toBe('cancelled');
  expect(s.commits()).toBe(0);
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('TEST-I: recovery budget exhausted on different invalid replacements, no partial commit', async () => {
  const s = runtimeFixture([creation(), repair(-1), repair(-2)], {
    inject: true,
  });
  await s.agent.run('create and fill');
  expect(s.agent.getSnapshot().status).toBe('failed');
  expect(s.agent.getSnapshot().error).toContain('预算已用完');
  expect(s.calls()).toBe(3);
  expect(s.commits()).toBe(0);
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('stops a repeated invalid recovery replacement without repeatedly executing it', async () => {
  const s = runtimeFixture([creation(), repair(-1), repair(-1)], {
    inject: true,
  });
  await s.agent.run('create and fill');
  expect(s.agent.getSnapshot().status).toBe('failed');
  expect(s.agent.getSnapshot().error).toContain('相同');
  expect(s.calls()).toBe(3);
  expect(s.commits()).toBe(0);
});
it('rejects recovery scope/target expansion and never replays earlier creation', async () => {
  const expanded = repair(0.8);
  expanded.steps[0]!.arguments.layerId = textId;
  const s = runtimeFixture([creation(), expanded], { inject: true });
  await s.agent.run('fill rectangle');
  expect(s.agent.getSnapshot().status).toBe('failed');
  expect(s.agent.getSnapshot().error).toContain('目标对象');
  expect(s.commits()).toBe(0);
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('marks real-effect-dependent steps DEFERRED while still checking every static contract', () => {
  const s = setup();
  let invoked = 0;
  s.registry.register(
    'effect_ready',
    'controlled read',
    z.object({}).strict(),
    'READ',
    {
      read: () => {
        invoked++;
        return { ready: true };
      },
    },
  );
  s.registry.register(
    'effect_applyDraft',
    'controlled deferred write',
    z.object({ layerId: z.string() }).strict(),
    'WRITE',
    {
      compile: () => {
        invoked++;
        throw Error('Must never run Forge in preflight');
      },
    },
  );
  const p = plan([
    { id: 'ready', label: 'ready', tool: 'effect_ready', arguments: {} },
    {
      id: 'apply',
      label: 'apply',
      tool: 'effect_applyDraft',
      arguments: { layerId: s.layer.id },
    },
    {
      id: 'move',
      label: 'move',
      tool: 'setPosition',
      arguments: { layerId: s.layer.id, value: { x: 1, y: 2 } },
    },
  ]);
  const result = s.registry.validatePlan(p, undefined, s.context);
  expect(result.steps.map((step) => step.status)).toEqual([
    'DEFERRED',
    'DEFERRED',
    'DEFERRED',
  ]);
  expect(invoked).toBe(0);
  expect(s.host.getSnapshot()).toBe(s.context.project);
  expect(() =>
    s.registry.validatePlan(
      {
        ...p,
        steps: [
          ...p.steps,
          {
            id: 'invalid',
            label: 'invalid',
            tool: 'setFill',
            arguments: {
              ...fill,
              layerId: s.layer.id,
              radialParameters: { radius: -1 },
            },
          },
        ],
      },
      undefined,
      s.context,
    ),
  ).toThrow('radius');
});
it('READ between creation and write does not fabricate entities and verifies known writes', () => {
  const s = runtimeFixture([creation()]);
  const p = creation();
  p.steps.splice(2, 0, {
    id: 'inspect-created',
    label: 'read new',
    tool: 'inspectLayer',
    arguments: { layerId: rectId },
  });
  const result = s.registry.validatePlan(p, undefined, {
    project: s.base,
    time: 0,
    selection: [],
  });
  expect(result.steps.find((step) => step.stepId === 'fill')?.status).toBe(
    'VERIFIED',
  );
  expect(s.host.getSnapshot()).toBe(s.base);
});
it('error feedback is bounded valid JSON, with field metadata and secrets redacted', () => {
  const e = new AgentExecutionError({
    code: 'SEMANTIC_INVALID',
    phase: 'compile',
    field: 'radius',
    expected: { description: 'x'.repeat(5000) },
    received: {
      apiKey: 'private-value',
      authorization: 'Bearer private-token-value',
      a: Array.from({ length: 1000 }, () => 'a'.repeat(1000)),
    },
    recoverable: true,
    message: 'invalid',
  });
  const raw = errorFeedback(e, {}, 1600);
  expect(raw.length).toBeLessThanOrEqual(1600);
  expect(JSON.parse(raw)).toMatchObject({
    code: 'SEMANTIC_INVALID',
    field: 'radius',
  });
  expect(raw).not.toContain('private-value');
  expect(raw).not.toContain('private-token-value');
  expect(executionError(new Error('fatal'))).toMatchObject({
    code: 'COMMAND_FAILED',
    recoverable: false,
  });
});
it('TEST-F/G: ordered keyframe add/update/remove and multiple updates verify final values', () => {
  const s = setup();
  const base = s.host.getSnapshot();
  const id = crypto.randomUUID(),
    p = s.layer.transform.rotation.id;
  const commands = [
    command({
      type: 'keyframe.add',
      propertyId: p,
      keyframe: {
        id,
        time: 0,
        value: 10,
        interpolation: { type: 'linear' as const },
      },
    }),
    command({
      type: 'keyframe.update',
      propertyId: p,
      keyframeId: id,
      patch: { value: 20 },
    }),
    command({
      type: 'keyframe.update',
      propertyId: p,
      keyframeId: id,
      patch: { time: 1, value: 30 },
    }),
    command({ type: 'keyframe.delete', propertyId: p, keyframeId: id }),
  ];
  expect(
    s.host.executeTransaction(transaction('ordered', 'agent', commands)).ok,
  ).toBe(true);
  expect(() =>
    s.registry.verifyResults(commands, s.host.getSnapshot(), base),
  ).not.toThrow();
  const wrong = {
    ...s.host.getSnapshot(),
    compositions: s.host.getSnapshot().compositions.map((c) => ({
      ...c,
      layers: c.layers.map((l) => ({
        ...l,
        transform: {
          ...l.transform,
          rotation: {
            ...l.transform.rotation,
            keyframes: [
              {
                id,
                time: 0,
                value: 10,
                interpolation: { type: 'linear' as const },
              },
            ],
          },
        },
      })),
    })),
  };
  expect(() => s.registry.verifyResults(commands, wrong, base)).toThrow(
    '最终状态',
  );
});
it('recovery fingerprints reject the same values even if object keys are reordered', async () => {
  const reordered = repair(0.5);
  reordered.steps[0]!.arguments = {
    radialParameters: { radius: 0.5 },
    gradient: 'radial',
    color: { a: 1, b: 1, g: 1, r: 0 },
    layerId: rectId,
  };
  const s = runtimeFixture([creation(), reordered], { inject: true });
  await s.agent.run('fill');
  expect(s.calls()).toBe(2);
  expect(s.commits()).toBe(0);
  expect(s.agent.getSnapshot().error).toContain('相同');
});
it('recovered session plan records the effective arguments and preserves step identity', async () => {
  const s = runtimeFixture([creation(), repair(0.8)], { inject: true });
  await s.agent.run('fill');
  expect(s.agent.getSnapshot().currentPlan?.steps[2]).toMatchObject({
    id: 'fill',
    tool: 'setFill',
    arguments: { radialParameters: { radius: 0.8 } },
  });
});
it('rejected staged validation is explicit and does not mutate the host', () => {
  const s = setup();
  let failure: unknown;
  try {
    s.registry.validatePlan(
      plan([
        {
          id: 'bad',
          label: 'bad',
          tool: 'setFill',
          arguments: {
            ...fill,
            layerId: s.layer.id,
            radialParameters: { radius: -1 },
          },
        },
      ]),
      undefined,
      s.context,
    );
  } catch (e) {
    failure = e;
  }
  expect(failure).toMatchObject({
    code: 'SCHEMA_INVALID',
    phase: 'preflight',
    cause: { validationStatus: 'REJECTED' },
  });
  expect(s.host.getSnapshot()).toBe(s.context.project);
});

import {
  creationCapabilities,
  resolveCreationDetails,
} from '../src/agent/creation-planner';
import { registerEffectForgeTools } from '../src/agent/effect-forge-tools';
it('R2 classifies missing creation capabilities with field feedback, not command failure', () => {
  const s = setup();
  const p = creation();
  const capabilities = creationCapabilities(s.registry);
  const details = resolveCreationDetails(p, s.registry, capabilities);
  try {
    resolveCreationDetails(
      {
        ...p,
        creation: {
          ...details,
          tasks: [
            { ...details.tasks[0]!, capabilityId: 'setFill:radial' },
            ...details.tasks.slice(1),
          ],
        },
      },
      s.registry,
      capabilities,
    );
    throw Error('Expected rejection');
  } catch (e) {
    expect(JSON.parse(errorFeedback(e))).toMatchObject({
      code: 'CAPABILITY_MISSING',
      phase: 'preflight',
      field: 'creation.tasks.capabilityId',
      received: 'setFill:radial',
      recoverable: true,
    });
  }
});
it('R2 preserves exact missing capability diagnostics from read adapter', async () => {
  const s = setup();
  registerEffectForgeTools(s.registry);
  await expect(
    s.registry.read(
      'effect_inspect',
      { id: 'setFill:radial', version: '1.0.0' },
      s.context,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({
    code: 'CAPABILITY_MISSING',
    phase: 'read',
    toolName: 'effect_inspect',
    field: 'id',
    recoverable: false,
  });
});
