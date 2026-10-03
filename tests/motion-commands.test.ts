import { expect, it } from 'vitest';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import {
  createDefaultProject,
  createLayer,
  findProperty,
} from '../src/core/project-model';
import { newId } from '../src/core/core-types';
import {
  MotionCurveAPI,
  selectedMotionSegments,
  previewMotionCurve,
} from '../src/core/motion-curve-commands';
import { motionSegments } from '../src/core/motion-curve';
export function motionFixture() {
  const project = createDefaultProject(),
    layer = createLayer('rectangle'),
    sys = new CommandSystem(project);
  const props = [
    layer.transform.position,
    layer.transform.scale,
    layer.transform.opacity,
  ];
  sys.executeTransaction(
    transaction('准备', 'human', [
      command({
        type: 'layer.create',
        compositionId: project.activeCompositionId,
        layer,
      }),
      ...props.flatMap((p) =>
        [0, 1, 2].map((time) =>
          command({
            type: 'keyframe.add',
            propertyId: p.id,
            keyframe: {
              id: newId(),
              time,
              value:
                typeof p.baseValue === 'number'
                  ? time / 2
                  : { x: time * 100, y: time * 50 },
              interpolation: { type: 'linear' },
            },
          }),
        ),
      ),
    ]),
  );
  return { sys, props, layer, api: new MotionCurveAPI(sys) };
}
it('多属性多区间一笔事务、时间数值保留、Undo/Redo 精确恢复', () => {
  const { sys, props, api } = motionFixture(),
    before = sys.getSnapshot();
  const refs = props.flatMap((p) =>
    findProperty(before, p.id).property.keyframes.map((k) => ({
      propertyId: p.id,
      keyframeId: k.id,
    })),
  );
  const ids = selectedMotionSegments(before, refs);
  expect(ids).toHaveLength(6);
  const c = {
    type: 'cubic-bezier' as const,
    x1: 0.1,
    y1: -0.3,
    x2: 0.6,
    y2: 1.5,
  };
  expect(api.applyMotionCurve(ids, c).ok).toBe(true);
  for (const id of ids) expect(api.getMotionCurve(id)).toEqual(c);
  for (const p of props)
    expect(
      findProperty(sys.getSnapshot(), p.id).property.keyframes.map((k) => [
        k.time,
        k.value,
      ]),
    ).toEqual(
      findProperty(before, p.id).property.keyframes.map((k) => [
        k.time,
        k.value,
      ]),
    );
  const after = sys.getSnapshot();
  sys.undo();
  expect(sys.getSnapshot()).toEqual(before);
  sys.redo();
  expect(sys.getSnapshot()).toEqual(after);
});
it('只应用目标相邻区间，In/Out 保留另一侧；失效区间原子拒绝', () => {
  const { sys, props, api } = motionFixture(),
    id = motionSegments(
      findProperty(sys.getSnapshot(), props[0]!.id).property,
    )[0]!.id;
  const curve = {
    type: 'cubic-bezier' as const,
    x1: 0.3,
    y1: 0.4,
    x2: 0.6,
    y2: 1.2,
  };
  api.applyMotionCurve([id], curve, 'out');
  expect(api.getMotionCurve(id)).toEqual({ ...curve, x2: 1, y2: 1 });
  api.applyMotionCurve([id], curve, 'in');
  expect(api.getMotionCurve(id)).toEqual(curve);
  const before = sys.getSnapshot();
  expect(api.applyMotionCurve([id, 'invalid'], curve).ok).toBe(false);
  expect(sys.getSnapshot()).toBe(before);
  expect(
    previewMotionCurve(before, [id], { type: 'linear' })[0]!.keyframes[0]!
      .outgoing,
  ).toBeUndefined();
  expect(sys.getSnapshot()).toBe(before);
});
