import { expect, it } from 'vitest';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import { registerCompositingTools } from '../src/agent/compositing-tools';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { CommandSystem } from '../src/core/command-system';
import { CompositingGraphService } from '../src/core/compositing-service';
it('rejects malformed gradient stops before preview without changing the real scene or history', () => {
  const p = createDefaultProject(),
    l = createLayer('solid');
  const host = new CommandSystem({
    ...p,
    compositions: p.compositions.map((c) => ({ ...c, layers: [l] })),
  });
  const api = new CompositingGraphService(host);
  let node = '';
  api.batch('fixture', (s) => {
    node = s.createNode(l.id, 'radialGradient').id;
  });
  const before = host.getSnapshot(),
    count = host.undoStack.length;
  const registry = registerCompositingTools(new AgentToolRegistry());
  const plan = {
    id: 'plan',
    goal: 'change gradient',
    risk: 'low' as const,
    steps: [
      {
        id: 's',
        label: '色标',
        tool: 'setNodeParameter',
        arguments: {
          nodeId: node,
          key: 'stops',
          value: [0, 1, 0, 0, 1, 1, 0, 0, 1],
        },
      },
    ],
  };
  expect(() =>
    registry.validatePlan(plan, undefined, {
      project: before,
      time: 0,
      selection: [l.id],
    }),
  ).toThrow('stops');
  expect(host.getSnapshot()).toBe(before);
  expect(host.undoStack).toHaveLength(count);
});
