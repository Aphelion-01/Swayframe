import { registerCreationTools } from '../src/agent/creation-planner';
import { it, expect } from 'vitest';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { registerSemanticActions } from '../src/agent/semantic-actions';
import { registerCompositingTools } from '../src/agent/compositing-tools';
import { NativeSkillRuntime } from '../src/agent/native-skill-runtime';
import { CommandSystem } from '../src/core/command-system';
import {
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import { AgentTransaction } from '../src/agent/transaction';
import { compileGraph } from '../src/core/compositing-compiler';
import { evaluateProperty } from '../src/core/animation-engine';
import type { AgentPlan } from '../src/agent/session';
const ref = (stepId: string, output = 'layerId') => ({
  kind: 'stepResult',
  stepId,
  output,
});
it('all five creative workflows use actual objects, animation and graph in one transaction', async () => {
  const host = new CommandSystem(createDefaultProject());
  const base = host.getSnapshot();
  const r = registerCompositingTools(
    registerSemanticActions(
      registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
    ),
  );
  registerCreationTools(r);
  const skills = new NativeSkillRuntime(r);
  skills.route('创建渐变矩形、Cubic标题和动画，连接合成图节点');
  const steps: AgentPlan['steps'] = [
    {
      id: 'shape',
      tool: 'createShape',
      label: '矩形',
      arguments: { width: 500, height: 300 },
    },
    {
      id: 'fill',
      tool: 'setGradientFill',
      label: '渐变',
      arguments: {
        layerId: ref('shape'),
        kind: 'radial',
        color: { r: 0, g: 0.6, b: 0.8, a: 1 },
        endColor: { r: 0, g: 0, b: 0, a: 1 },
        radialParameters: { radius: 0.7 },
      },
    },
    {
      id: 'text',
      tool: 'createText',
      label: '标题',
      arguments: { content: 'Cubic', fontSize: 64, fontFamily: 'serif' },
    },
    {
      id: 'font',
      tool: 'setFont',
      label: '字体',
      arguments: { layerId: ref('text'), fontFamily: 'Times New Roman' },
    },
    {
      id: 'anim',
      tool: 'animateLayerProperty',
      label: '淡入',
      arguments: {
        layerId: ref('text'),
        property: 'opacity',
        keyframes: [
          { time: 0, value: 0 },
          { time: 2, value: 1 },
        ],
      },
    },
    {
      id: 'glow',
      tool: 'createNode',
      label: '发光',
      arguments: { layerId: ref('shape'), type: 'glow' },
    },
  ];
  const plan: AgentPlan = {
    id: 'skills',
    goal: '真实原生任务',
    risk: 'low',
    steps,
  };
  skills.validate(plan, base);
  r.validatePlan(plan, undefined, { project: base, selection: [], time: 0 });
  const tx = new AgentTransaction(host, r, base, { selection: [], time: 0 });
  for (const step of steps)
    await tx.execute(
      step.tool,
      step.arguments,
      new AbortController().signal,
      step.id,
    );
  const ls = activeComposition(tx.getSnapshot()).layers;
  expect(ls).toHaveLength(2);
  expect(ls.find((l) => l.type === 'text')).toMatchObject({
    text: 'Cubic',
    fontFamily: 'Times New Roman',
  });
  expect(
    evaluateProperty(ls.find((l) => l.type === 'text')!.transform.opacity, 1),
  ).toBe(0.5);
  expect(
    compileGraph(ls.find((l) => l.type === 'shape')!.editor!.graph!).valid,
  ).toBe(true);
  tx.commit('skills');
  expect(host.undoStack).toHaveLength(1);
  host.undo();
  expect(host.getSnapshot()).toEqual(base);
});
