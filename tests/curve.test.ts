import { expect, it } from 'vitest';
import {
  createProperty,
  createDefaultProject,
  createLayer,
  activeComposition,
} from '../src/core/project-model';
import { newId } from '../src/core/core-types';
import { evaluateProperty } from '../src/core/animation-engine';
import {
  easePresets,
  sampleCurve,
  propertySpeed,
  controlsFromSpeed,
  speedsFromControls,
} from '../src/core/curve-model';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
it('真实缓出改变求值，Position 速度曲线显示非匀速而非分量值', () => {
  const p = {
    ...createProperty({ x: 0, y: 0 }),
    keyframes: [
      {
        id: newId(),
        time: 0,
        value: { x: 0, y: 0 },
        interpolation: easePresets.easeOut!,
      },
      {
        id: newId(),
        time: 1,
        value: { x: 100, y: 100 },
        interpolation: easePresets.linear!,
      },
    ],
  };
  expect(evaluateProperty(p, 0.5).x).toBeGreaterThan(50);
  expect(propertySpeed(p, 0.2)).toBeGreaterThan(propertySpeed(p, 0.8));
  expect(
    sampleCurve(p, 0, 1, 'speed').every(
      (s) => Number.isFinite(s.value) && s.value >= 0,
    ),
  ).toBe(true);
  const linear = {
    ...p,
    keyframes: p.keyframes.map((k) => ({
      ...k,
      interpolation: easePresets.linear!,
    })),
  };
  expect(propertySpeed(linear, 0.5)).toBeCloseTo(Math.sqrt(20000), 3);
});
it('速度与影响比例往返可编辑，入出切线保持一笔精确 Undo', () => {
  const p = createDefaultProject(),
    l = createLayer('rectangle'),
    system = new CommandSystem(p),
    prop = l.transform.rotation;
  const frames = [
    { id: newId(), time: 0, value: 0, interpolation: easePresets.linear! },
    { id: newId(), time: 2, value: 90, interpolation: easePresets.linear! },
  ];
  system.executeTransaction(
    transaction('准备', 'human', [
      command({
        type: 'layer.create',
        compositionId: p.activeCompositionId,
        layer: l,
      }),
      ...frames.map((keyframe) =>
        command({ type: 'keyframe.add', propertyId: prop.id, keyframe }),
      ),
    ]),
  );
  const before = system.getSnapshot(),
    ctrl = controlsFromSpeed(frames[0]!, frames[1]!, 35, 65, 20, 0);
  expect(
    system.executeTransaction(
      transaction('曲线', 'human', [
        command({
          type: 'keyframe.update',
          propertyId: prop.id,
          keyframeId: frames[0]!.id,
          patch: {
            interpolation: { type: 'bezier', ...ctrl },
            outgoing: ctrl.out,
          },
        }),
        command({
          type: 'keyframe.update',
          propertyId: prop.id,
          keyframeId: frames[1]!.id,
          patch: { incoming: ctrl.in },
        }),
      ]),
    ).ok,
  ).toBe(true);
  const result = activeComposition(system.getSnapshot()).layers[0]!.transform
    .rotation.keyframes;
  const speed = speedsFromControls(result[0]!, result[1]!);
  expect(speed.outInfluence).toBeCloseTo(35);
  expect(speed.inInfluence).toBeCloseTo(65);
  expect(speed.outSpeed).toBeCloseTo(20);
  expect(speed.inSpeed).toBeCloseTo(0);
  const edited = system.getSnapshot();
  system.undo();
  expect(system.getSnapshot()).toEqual(before);
  system.redo();
  expect(system.getSnapshot()).toEqual(edited);
});
