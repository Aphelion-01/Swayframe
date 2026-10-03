import { it, expect } from 'vitest';
import {
  reverseMotionCurve,
  mirrorMotionCurve,
  MotionCurveClipboard,
} from '../src/core/motion-curve-operations';
import { evaluateMotionCurve, motionSegments } from '../src/core/motion-curve';
import {
  createDefaultProject,
  createLayer,
  findProperty,
} from '../src/core/project-model';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import { MotionCurveAPI } from '../src/core/motion-curve-commands';
import { MotionPresetLibrary } from '../src/core/motion-presets';
import { newId } from '../src/core/core-types';
it('Reverse 为真正函数反转，Mirror 保留指定一侧并对称，不混同', () => {
  const c = {
      type: 'cubic-bezier' as const,
      x1: 0.13,
      y1: -0.7,
      x2: 0.73,
      y2: 1.6,
    },
    reverse = reverseMotionCurve(c),
    mirror = mirrorMotionCurve(c, 'out');
  for (const u of [0, 0.1, 0.28, 0.63, 0.9, 1])
    expect(evaluateMotionCurve(reverse, u)).toBeCloseTo(
      1 - evaluateMotionCurve(c, 1 - u),
      9,
    );
  expect(mirror).not.toEqual(reverse);
  for (const u of [0.1, 0.3, 0.65])
    expect(
      evaluateMotionCurve(mirror, u) + evaluateMotionCurve(mirror, 1 - u),
    ).toBeCloseTo(1, 9);
  expect(mirrorMotionCurve(c, 'in')).toEqual({
    ...c,
    x1: 1 - c.x2,
    y1: 1 - c.y2,
  });
});
it('Agent API 与人类命令共用事务，Copy/Paste 只复制曲线，空间几何与时间数值保留', () => {
  const project = createDefaultProject(),
    l = createLayer('rectangle'),
    system = new CommandSystem(project),
    lib = new MotionPresetLibrary(),
    api = new MotionCurveAPI(system, 'agent', lib);
  system.executeTransaction(
    transaction('准备', 'human', [
      command({
        type: 'layer.create',
        compositionId: project.activeCompositionId,
        layer: l,
      }),
      ...[0, 1, 2].map((t) =>
        command({
          type: 'keyframe.add',
          propertyId: l.transform.position.id,
          keyframe: {
            id: newId(),
            time: t,
            value: { x: 100 * t, y: 0 },
            spatialOutgoing: { x: 50 + t * 100, y: 200 },
            spatialIncoming: { x: t * 100 - 50, y: 200 },
            interpolation: { type: 'linear' },
          },
        }),
      ),
    ]),
  );
  const before = findProperty(
      system.getSnapshot(),
      l.transform.position.id,
    ).property,
    segments = motionSegments(before),
    c = { type: 'cubic-bezier' as const, x1: 0.2, y1: -0.5, x2: 0.4, y2: 1.4 },
    clip = new MotionCurveClipboard();
  api.applyMotionCurve([segments[0]!.id], c);
  clip.copy(api.getMotionCurve(segments[0]!.id)!);
  api.applyMotionCurve([segments[1]!.id], clip.read()!);
  expect(system.undoStack.at(-1)!.transaction.source).toBe('agent');
  const edited = findProperty(
    system.getSnapshot(),
    l.transform.position.id,
  ).property;
  expect(
    edited.keyframes.map((k) => [
      k.time,
      k.value,
      k.spatialOutgoing,
      k.spatialIncoming,
    ]),
  ).toEqual(
    before.keyframes.map((k) => [
      k.time,
      k.value,
      k.spatialOutgoing,
      k.spatialIncoming,
    ]),
  );
  const saved = system.getSnapshot();
  api.reverseMotionCurve(segments.map((s) => s.id));
  system.undo();
  expect(system.getSnapshot()).toEqual(saved);
  system.redo();
  expect(api.getMotionCurve(segments[0]!.id)).toEqual(reverseMotionCurve(c));
  expect(api.analyzeMotionCurve(segments[0]!.id).supported).toBe(true);
  expect(
    api.saveMotionPreset('AI 可复用曲线', c, { tags: ['energetic'] }).curve,
  ).toEqual(c);
});
