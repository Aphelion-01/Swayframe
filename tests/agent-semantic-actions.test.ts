import { describe, it, expect } from 'vitest';
import { CommandSystem } from '../src/core/command-system';
import {
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { registerSemanticActions } from '../src/agent/semantic-actions';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import { AgentTransaction } from '../src/agent/transaction';
import { evaluateProperty } from '../src/core/animation-engine';
const registry = () =>
  registerSemanticActions(
    registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
  );
const ref = { kind: 'stepResult', stepId: 'shape', output: 'layerId' };
describe('semantic actions compile to the shared execution contract', () => {
  it('creates, centers, gradients and animates one actual object, one Undo', async () => {
    const host = new CommandSystem(createDefaultProject());
    const base = host.getSnapshot();
    const r = registry();
    const tx = new AgentTransaction(host, r, base, { time: 0, selection: [] });
    const signal = new AbortController().signal;
    await tx.execute(
      'createShape',
      { name: 'A', width: 400, height: 300 },
      signal,
      'shape',
    );
    await tx.execute(
      'placeAtCompositionCenter',
      { layerId: ref },
      signal,
      'center',
    );
    await tx.execute(
      'setGradientFill',
      {
        layerId: ref,
        kind: 'radial',
        color: { r: 0, g: 0, b: 1, a: 1 },
        endColor: { r: 0, g: 0, b: 0, a: 1 },
        radialParameters: { radius: 0.8 },
      },
      signal,
      'fill',
    );
    await tx.execute(
      'animateLayerProperty',
      {
        layerId: ref,
        property: 'opacity',
        keyframes: [
          { time: 0, value: 0 },
          { time: 2, value: 1 },
        ],
      },
      signal,
      'anim',
    );
    expect(host.getSnapshot()).toBe(base);
    tx.commit('test');
    const c = activeComposition(host.getSnapshot());
    const layer = c.layers.at(-1)!;
    expect(layer.transform.position.baseValue).toEqual({
      x: c.width / 2,
      y: c.height / 2,
    });
    expect(layer.editor?.gradient).toBe('radial');
    expect(evaluateProperty(layer.transform.opacity, 1)).toBe(0.5);
    expect(host.undoStack).toHaveLength(1);
    host.undo();
    expect(host.getSnapshot()).toEqual(base);
  });
  it('rejects illegal dynamic fill before mutation and retains actual draft', async () => {
    const host = new CommandSystem(createDefaultProject());
    const r = registry();
    const tx = new AgentTransaction(host, r, host.getSnapshot(), {
      time: 0,
      selection: [],
    });
    const s = new AbortController().signal;
    await tx.execute('createShape', {}, s, 'shape');
    const draft = tx.getSnapshot();
    await expect(
      tx.execute(
        'setGradientFill',
        {
          layerId: ref,
          kind: 'radial',
          color: { r: 0, g: 0, b: 1, a: 1 },
          endColor: { r: 0, g: 0, b: 0, a: 1 },
          radialParameters: { radius: -1 },
        },
        s,
      ),
    ).rejects.toThrow();
    expect(tx.getSnapshot()).toBe(draft);
    expect(host.undoStack).toHaveLength(0);
  });
  it('contract and validator derive from same schema; defaults and outputs are explicit', () => {
    const r = registry();
    expect(r.contract('createShape').parameters).toHaveProperty('properties');
    expect(r.contract('createShape').outputSchema.properties).toHaveProperty(
      'layerId',
    );
    expect(() => r.contract('invented')).toThrow();
  });
});

it('semantic easing reuses native presets and verifies midpoint rather than per-keyframe tangents', async () => {
  const host = new CommandSystem(createDefaultProject()),
    r = registry(),
    tx = new AgentTransaction(host, r, host.getSnapshot(), {
      time: 0,
      selection: [],
    }),
    s = new AbortController().signal;
  await tx.execute('createShape', {}, s, 'shape');
  await tx.execute(
    'animateLayerProperty',
    {
      layerId: ref,
      property: 'position',
      easing: 'easeInOut',
      keyframes: [
        { time: 0, value: { x: 480, y: 540 } },
        { time: 2, value: { x: 1440, y: 540 } },
      ],
    },
    s,
    'anim',
  );
  expect(
    evaluateProperty(
      activeComposition(tx.getSnapshot()).layers[0]!.transform.position,
      1,
    ),
  ).toEqual({ x: 960, y: 540 });
});
