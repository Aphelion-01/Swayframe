import { it, expect } from 'vitest';
import {
  motionCurveSchema,
  segmentMotionCurve,
  motionSegments,
} from '../src/core/motion-curve';
import { createProperty } from '../src/core/project-model';
import { newId } from '../src/core/core-types';
it('区间曲线兼容既有入出模型，多个区间可保存不同节奏', () => {
  const frames = [0, 1, 2].map((time) => ({
    id: newId(),
    time,
    value: time,
    interpolation: { type: 'linear' as const },
  }));
  const left = {
    ...frames[0]!,
    interpolation: {
      type: 'bezier' as const,
      out: { x: 0.3, y: 0 },
      in: { x: 0.7, y: 1 },
    },
    outgoing: { x: 0.1, y: -0.5 },
  };
  const right = { ...frames[1]!, incoming: { x: 0.8, y: 1.5 } };
  expect(segmentMotionCurve(left, right)).toEqual({
    type: 'cubic-bezier',
    x1: 0.1,
    y1: -0.5,
    x2: 0.8,
    y2: 1.5,
  });
  const segments = motionSegments({
    ...createProperty(0),
    keyframes: [left, right, frames[2]!],
  });
  expect(segments[1]!.curve).toEqual({ type: 'linear' });
  expect(segments[0]!.id).not.toEqual(segments[1]!.id);
});
it('曲线可序列化，拒绝未知生成器与不合法坐标', () => {
  const c = { type: 'cubic-bezier', x1: 0.17, y1: -0.6, x2: 0.8, y2: 1.7 };
  expect(motionCurveSchema.parse(JSON.parse(JSON.stringify(c)))).toEqual(c);
  for (const v of [
    { ...c, x1: 1.1 },
    { ...c, y1: NaN },
    { type: 'spring' },
    { ...c, position: 50 },
  ])
    expect(motionCurveSchema.safeParse(v).success).toBe(false);
});

it('0.2 工程迁移保留全部 ID 和旧入出控制，0.3 空间字段保存重开一致', async () => {
  const { createDefaultProject, createLayer } =
    await import('../src/core/project-model');
  const { loadProject, saveProject } = await import('../src/core/project-io');
  const project = createDefaultProject(),
    layer = createLayer('rectangle');
  const current = {
    ...project,
    compositions: project.compositions.map((c) => ({
      ...c,
      layers: [
        {
          ...layer,
          transform: {
            ...layer.transform,
            position: {
              ...layer.transform.position,
              keyframes: [
                {
                  id: newId(),
                  time: 0,
                  value: { x: 0, y: 0 },
                  interpolation: {
                    type: 'bezier' as const,
                    out: { x: 0.2, y: 0 },
                    in: { x: 0.7, y: 1 },
                  },
                  outgoing: { x: 0.15, y: -0.3 },
                  spatialOutgoing: { x: 100, y: 200 },
                },
                {
                  id: newId(),
                  time: 1,
                  value: { x: 200, y: 0 },
                  interpolation: { type: 'linear' as const },
                  incoming: { x: 0.8, y: 1.3 },
                  spatialIncoming: { x: 150, y: 200 },
                },
              ],
            },
          },
        },
      ],
    })),
  };
  expect(loadProject(saveProject(current))).toEqual(current);
  const old = { ...current, schemaVersion: '0.2.0' };
  expect(loadProject(JSON.stringify(old))).toEqual(current);
});

it('非 Position 属性的空间切线在命令提交边界拒绝，工程不发生部分修改', async () => {
  const { createDefaultProject, createLayer } =
    await import('../src/core/project-model');
  const { CommandSystem, command, transaction } =
    await import('../src/core/command-system');
  const p = createDefaultProject(),
    l = createLayer('rectangle'),
    s = new CommandSystem(p);
  const result = s.executeTransaction(
    transaction('非法空间切线', 'agent', [
      command({
        type: 'layer.create',
        compositionId: p.activeCompositionId,
        layer: l,
      }),
      command({
        type: 'keyframe.add',
        propertyId: l.transform.opacity.id,
        keyframe: {
          id: newId(),
          time: 0,
          value: 0,
          interpolation: { type: 'linear' },
          spatialOutgoing: { x: 1, y: 2 },
        },
      }),
    ]),
  );
  expect(result.ok).toBe(false);
  expect(s.getSnapshot()).toEqual(p);
  expect(s.undoStack).toHaveLength(0);
});
