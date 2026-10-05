/** Deterministic QA protocol fixtures, never used by the product Agent. */
import {
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../core/project-model';
import type { Project } from '../core/project-model';
import type { AgentPlan } from '../agent/session';
export const agentCaseNames = [
  '左侧快速入场',
  '创建中心文字',
  '文字排版与颜色',
  '背景模糊',
  '选区中心缩放120%',
  '仅布局参考',
  '服务限流切换',
  '未配置服务',
  '停止任务',
  '保存重新打开',
] as const;
export function agentFixture() {
  const p = createDefaultProject();
  return {
    ...p,
    name: 'AI Agent 验收',
    compositions: [
      {
        ...p.compositions[0]!,
        layers: [
          createLayer('rectangle', {
            name: '背景矩形',
            position: { x: 400, y: 300 },
          }),
          createLayer('rectangle', {
            name: '副矩形',
            position: { x: 1000, y: 300 },
          }),
          createLayer('text', { name: '标题', position: { x: 960, y: 540 } }),
        ],
      },
    ],
  };
}
export function agentFixturePlan(
  caseIndex: number,
  project: Project,
): AgentPlan {
  const [a, b, t] = activeComposition(project).layers;
  const steps: AgentPlan['steps'] = [];
  const step = (tool: string, args: Record<string, unknown>) =>
    steps.push({
      id: 'step-' + steps.length,
      label: tool,
      tool,
      arguments: args,
    });
  if (caseIndex === 0 || caseIndex === 9) {
    const first = crypto.randomUUID(),
      last = crypto.randomUUID(),
      propertyId = a!.transform.position.id;
    step('addKeyframe', {
      propertyId,
      keyframeId: first,
      time: 0,
      value: { x: -200, y: 300 },
    });
    step('addKeyframe', {
      propertyId,
      keyframeId: last,
      time: 1,
      value: { x: 400, y: 300 },
    });
    step('applyMotionCurve', {
      segmentIds: [propertyId + '/' + first + '/' + last],
      curve: { type: 'cubic-bezier', x1: 0.1, y1: 0.8, x2: 0.3, y2: 1 },
    });
  } else if (caseIndex === 1) {
    step('createText', {
      layerId: crypto.randomUUID(),
      name: 'HELLO SWAYFRAME',
      content: 'HELLO SWAYFRAME',
      position: { x: 960, y: 540 },
    });
  } else if (caseIndex === 2) {
    step('setFontSize', { layerId: t!.id, value: 96 });
    step('setTracking', { layerId: t!.id, value: 8 });
    step('setPosition', { layerId: t!.id, value: { x: 960, y: 450 } });
    step('setTextColor', {
      layerId: t!.id,
      color: { r: 1, g: 0.7, b: 0.2, a: 1 },
    });
  } else if (caseIndex === 3) {
    const nodeId = crypto.randomUUID();
    step('createNode', { layerId: a!.id, type: 'gaussianBlur', nodeId });
    step('setNodeParameter', { nodeId, key: 'radius', value: 12 });
  } else if (caseIndex === 4) {
    step('setTransformPivot', { pivot: 'selection-center' });
    step('transformSelection', {
      layerIds: [a!.id, b!.id],
      operation: { kind: 'scale', factor: { x: 1.2, y: 1.2 } },
      pivot: 'selection-center',
    });
  } else step('setPosition', { layerId: a!.id, value: { x: 640, y: 360 } });
  return {
    id: crypto.randomUUID(),
    goal: agentCaseNames[caseIndex] ?? 'QA',
    risk: 'low',
    steps,
  };
}
