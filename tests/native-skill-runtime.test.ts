import { registerCreationTools } from '../src/agent/creation-planner';
import { it, expect } from 'vitest';
import {
  NativeSkillRegistry,
  NativeSkillRuntime,
} from '../src/agent/native-skill-runtime';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { registerSemanticActions } from '../src/agent/semantic-actions';
import { createDefaultProject } from '../src/core/project-model';
import cases from '../src/agent/native-skills/core-execution/tests/cases.json';
const tools = () =>
  registerSemanticActions(
    registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
  );
it('loads a trusted exact package; rejects mutated workflow and external capability grants', () => {
  const r = new NativeSkillRegistry();
  const skill = r.load('sf.core-execution');
  expect(
    r.validatePackage({
      manifest: skill.manifest,
      workflow: skill.workflow,
      instructions: skill.instructions,
    }).hash,
  ).toBe(skill.hash);
  expect(() =>
    r.validatePackage({
      manifest: { ...skill.manifest, permissionRequirements: ['shell'] },
      workflow: skill.workflow,
      instructions: skill.instructions,
    }),
  ).toThrow();
  expect(() =>
    r.validatePackage({
      manifest: skill.manifest,
      workflow: { ...skill.workflow, sequence: ['execute-shell'] },
      instructions: skill.instructions,
    }),
  ).toThrow();
  expect(() => r.load('sf.core-execution', ['sf.core-execution'])).toThrow();
  expect(cases).toHaveLength(3);
});
it('reports missing real capabilities before advertising a skill', () => {
  const r = new NativeSkillRuntime(new AgentToolRegistry());
  expect(() => r.route('创建矩形')).toThrow('真实能力');
  expect(r.context()).toEqual([]);
});
it('core flow validates real steps and dependency rules without a new executor', () => {
  const registry = tools();
  const r = new NativeSkillRuntime(registry);
  expect(r.route('创建矩形')[0]?.id).toBe('sf.core-execution');
  expect(() =>
    registry.validatePlan(
      {
        id: 'a',
        goal: 'rect',
        risk: 'low',
        steps: [{ id: 'a', tool: 'invented', label: 'bad', arguments: {} }],
      },
      undefined,
      { project: createDefaultProject(), time: 0, selection: [] },
    ),
  ).toThrow('未注册');
  expect(r.route('创建矩形', false)).toEqual([]);
});

it('routes only task-relevant creative skills and keeps the same underlying tools without skills', async () => {
  const { registerCompositingTools } =
    await import('../src/agent/compositing-tools');
  const registry = registerCompositingTools(tools());
  registerCreationTools(registry);
  const r = new NativeSkillRuntime(registry);
  expect(r.route('创建蓝色渐变矩形').map((s) => s.id)).toEqual([
    'sf.core-execution',
    'sf.shape-creation',
    'sf.gradient-fill',
  ]);
  expect(r.route('创建标题淡入动画').map((s) => s.id)).toEqual([
    'sf.core-execution',
    'sf.typography',
    'sf.keyframe-animation',
  ]);
  expect(r.route('创建合成图节点').map((s) => s.id)).toEqual([
    'sf.core-execution',
    'sf.compositing',
  ]);
  expect(r.route('创建标题', true, ['sf.typography']).map((s) => s.id)).toEqual(
    ['sf.core-execution'],
  );
});
