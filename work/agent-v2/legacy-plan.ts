import type { AgentPlan } from '../../src/agent/session';
import type { TaskIntent, SemanticAction } from '../../src/agent-v2/actions';
import {executionTool} from '../../src/agent-v2/actions';
export function legacyPlan(intent: TaskIntent): AgentPlan {
  const steps = intent.actions
    .filter((a) => a.type !== 'modifyKeyframe')
    .map((a) => {
      const { id, type, dependsOn, ...params } = a;
      void type;
      void dependsOn;
      let args: unknown = params;
      if (a.type === 'createShape') {
        const { shape, ...p } = params as Omit<
          Extract<SemanticAction, { type: 'createShape' }>,
          'id' | 'type' | 'dependsOn'
        >;
        void shape;
        args = p;
      }
      if ('target' in a) {
        const layerId =
          a.target.kind === 'result'
            ? {
                kind: 'stepResult',
                stepId: a.target.actionId,
                output: 'layerId',
              }
            : a.target.kind === 'existing'
              ? a.target.id
              : { kind: 'selection', objectType: 'layer' };
        if (a.type === 'setFill') {
          const { target, ...p } = params as Omit<
            Extract<SemanticAction, { type: 'setFill' }>,
            'id' | 'type' | 'dependsOn'
          >;
          void target;
          args = { layerId, ...p };
        }
        if (a.type === 'setProperty') args = { layerId, value: a.value };
        if (a.type === 'addEffect') args = { layerId, kind: a.effect };
        if (a.type === 'addKeyframe') {
          const modifier = intent.actions.find(
            (m) =>
              m.type === 'modifyKeyframe' &&
              m.keyframe.kind === 'result' &&
              m.keyframe.actionId === a.id,
          );
          args = {
            layerId,
            property: a.property,
            time: a.time,
            value: a.value,
            ...(modifier?.type === 'modifyKeyframe'
              ? { interpolation: modifier.interpolation }
              : {}),
          };
        }
      }
      return {
        id,
        label: id,
        tool: executionTool(a),
        arguments: args as Record<string, unknown>,
      };
    });
  return { id: 'fixture', goal: intent.goal, risk: 'low', steps };
}
