import { expect, it } from 'vitest';
import { AgentToolRegistry } from '../../src/agent/tool-registry';
import { registerCoreWriteTools } from '../../src/agent/write-tools';
import { registerReadTools } from '../../src/agent/read-tools';
import {
  CommandSystem,
  command,
  transaction,
} from '../../src/core/command-system';
import { createDefaultProject, createLayer } from '../../src/core/project-model';
import type { AgentPlan } from '../../src/agent/session';
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
