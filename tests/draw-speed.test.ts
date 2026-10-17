import { expect, it } from 'vitest';
import {
  interpolationProgress,
  evaluateProperty,
} from '../src/core/animation-engine';
import {
  speedInterpolationSchema,
  speedPresets,
  speedProgress,
  simplifySpeedStroke,
} from '../src/core/speed-curve';
import {
  createDefaultProject,
  createLayer,
  findProperty,
} from '../src/core/project-model';
import {
  command,
  CommandSystem,
  transaction,
} from '../src/core/command-system';
import { applySpeedCurveCommands } from '../src/core/motion-curve-commands';
import { motionSegments } from '../src/core/motion-curve';
import { loadProject, saveProject } from '../src/core/project-io';
import { newId } from '../src/core/core-types';
import { copyFrames, pasteFrames } from '../src/core/editing-commands';
import { spatialPoint } from '../src/core/spatial-path';
const curve = speedPresets.accelerate!;
function fixture() {
  const project = createDefaultProject(),
    layer = createLayer('rectangle'),
    sys = new CommandSystem(project),
    property = layer.transform.position;
  expect(
    sys.executeTransaction(
      transaction('setup', 'human', [
        command({
          type: 'layer.create',
          compositionId: project.activeCompositionId,
          layer,
        }),
        ...[0, 2].map((time) =>
          command({
            type: 'keyframe.add',
            propertyId: property.id,
            keyframe: {
              id: newId(),
              time,
              value: { x: time * 50, y: 40 },
              interpolation: {
                type: 'bezier',
                out: { x: 0.4, y: 0 },
                in: { x: 0.6, y: 1 },
              },
            },
          }),
        ),
      ]),
    ).ok,
  ).toBe(true);
  const get = () => findProperty(sys.getSnapshot(), property.id).property;
  const id = () => motionSegments(get())[0]!.id;
  return { sys, get, id, property };
}
it('A/B/C: exact integral, uniform, accelerate, decelerate; endpoints and no double easing', () => {
  expect(speedProgress(speedPresets.uniform!, 0.5)).toBeCloseTo(0.5, 12);
  expect(speedProgress(curve, 0.5)).toBeCloseTo(0.25, 12);
  expect(speedProgress(speedPresets.decelerate!, 0.5)).toBeCloseTo(0.75, 12);
  for (const c of Object.values(speedPresets)) {
    expect(speedProgress(c, 0)).toBe(0);
    expect(speedProgress(c, 1)).toBe(1);
    let before = 0;
    for (let i = 0; i <= 500; i++) {
      const p = speedProgress(c, i / 500);
      expect(p).toBeGreaterThanOrEqual(before);
      before = p;
    }
  }
  const { sys, get, id } = fixture();
  sys.executeTransaction(
    transaction(
      'draw',
      'human',
      applySpeedCurveCommands(sys.getSnapshot(), id(), curve),
    ),
  );
  expect(evaluateProperty(get(), 1)).toEqual({ x: 25, y: 40 });
});
it('D: zero plateau is a true pause with motion before/after', () => {
  const c = speedPresets.pause!;
  expect(speedProgress(c, 0.4)).toBe(speedProgress(c, 0.6));
  expect(speedProgress(c, 0.3)).toBeLessThan(speedProgress(c, 0.4));
  expect(speedProgress(c, 0.7)).toBeGreaterThan(speedProgress(c, 0.6));
});
it('E: negative/reverse/equal endpoints and all continuous native value shapes', () => {
  for (const [a, b] of [
    [100, 0],
    [-100, -20],
    [42, 42],
  ] as const) {
    const p = {
      id: newId(),
      baseValue: a,
      keyframes: [
        { id: newId(), time: 0, value: a, interpolation: curve },
        {
          id: newId(),
          time: 2,
          value: b,
          interpolation: { type: 'linear' as const },
        },
      ],
    };
    expect(evaluateProperty(p, 1)).toBe(a * 0.75 + b * 0.25);
    expect(evaluateProperty(p, 2)).toBe(b);
  }
  const p = {
    id: newId(),
    baseValue: [0, 0, 0],
    keyframes: [
      { id: newId(), time: 0, value: [0, 0, 0], interpolation: curve },
      { id: newId(), time: 2, value: [100, 40, 80], interpolation: curve },
    ],
  };
  expect(evaluateProperty(p, 1)).toEqual([25, 10, 20]);
});
it('F/G/H/I: native Command, single history, Undo/Redo, save/reopen, retiming, value edits, FPS independence', () => {
  const { sys, get, id, property } = fixture(),
    before = sys.getSnapshot(),
    stack = sys.undoStack.length;
  expect(
    sys.executeTransaction(
      transaction(
        'draw',
        'human',
        applySpeedCurveCommands(before, id(), curve),
      ),
    ).ok,
  ).toBe(true);
  const after = sys.getSnapshot();
  expect(sys.undoStack.length).toBe(stack + 1);
  sys.undo();
  expect(sys.getSnapshot()).toEqual(before);
  sys.redo();
  expect(sys.getSnapshot()).toEqual(after);
  const loaded = loadProject(saveProject(after));
  expect(
    evaluateProperty(findProperty(loaded, property.id).property, 1),
  ).toEqual({ x: 25, y: 40 });
  const end = get().keyframes[1]!;
  expect(
    sys.executeTransaction(
      transaction('time', 'human', [
        command({
          type: 'keyframe.update',
          propertyId: property.id,
          keyframeId: end.id,
          patch: { time: 4, value: { x: 200, y: 40 } },
        }),
      ]),
    ).ok,
  ).toBe(true);
  expect(evaluateProperty(get(), 2)).toEqual({ x: 50, y: 40 });
  for (const fps of [24, 30, 60]) {
    const raw = structuredClone(sys.getSnapshot());
    Object.assign(raw.compositions[0]!, { fps });
    expect(
      evaluateProperty(
        findProperty(loadProject(saveProject(raw)), property.id).property,
        2,
      ),
    ).toEqual({ x: 50, y: 40 });
  }
});
it('spatial geometry stays unchanged, controls are not temporal easing', () => {
  const a = {
      id: newId(),
      time: 0,
      value: { x: 0, y: 0 },
      interpolation: curve,
      spatialOutgoing: { x: 20, y: 100 },
    },
    b = {
      id: newId(),
      time: 2,
      value: { x: 100, y: 0 },
      interpolation: curve,
      spatialIncoming: { x: 80, y: 100 },
    };
  expect(
    evaluateProperty({ id: newId(), baseValue: a.value, keyframes: [a, b] }, 1),
  ).toEqual(spatialPoint(a, b, 0.25));
});
it('J: invalid data rejected before Scene/history and runtime fallback stays finite', () => {
  const { sys, get, id } = fixture();
  const bad = [
    [],
    [{ t: 0, speed: 1 }],
    [
      { t: 0, speed: 0 },
      { t: 1, speed: 0 },
    ],
    [
      { t: 0, speed: NaN },
      { t: 1, speed: 1 },
    ],
    [
      { t: 0, speed: Infinity },
      { t: 1, speed: 1 },
    ],
    [
      { t: 0, speed: -1 },
      { t: 1, speed: 1 },
    ],
    [
      { t: -1, speed: 1 },
      { t: 1, speed: 1 },
    ],
    [
      { t: 0, speed: 1 },
      { t: 0, speed: 1 },
      { t: 1, speed: 1 },
    ],
    [
      { t: 1, speed: 1 },
      { t: 0, speed: 1 },
    ],
    Array.from({ length: 129 }, (_, i) => ({ t: i / 128, speed: 1 })),
  ];
  const before = sys.getSnapshot(),
    n = sys.undoStack.length;
  for (const points of bad) {
    const c = { type: 'custom-speed' as const, points };
    expect(speedInterpolationSchema.safeParse(c).success).toBe(false);
    expect(() => applySpeedCurveCommands(before, id(), c)).toThrow();
    expect(
      sys.executeTransaction(
        transaction('bad', 'human', [
          command({
            type: 'keyframe.update',
            propertyId: get().id,
            keyframeId: get().keyframes[0]!.id,
            patch: { interpolation: c },
          }),
        ]),
      ).ok,
    ).toBe(false);
    expect(interpolationProgress(c, 1, 2)).toBe(0.5);
    expect(sys.getSnapshot()).toBe(before);
    expect(sys.undoStack.length).toBe(n);
  }
  expect(interpolationProgress(curve, 0, 0)).toBe(0);
  expect(interpolationProgress(curve, 1, 0)).toBe(1);
});
it('load recovery preserves raw diagnostic and file; strict save rejects corruption', () => {
  const { sys, get } = fixture(),
    raw = structuredClone(sys.getSnapshot());
  const k = findProperty(raw, get().id).property.keyframes[0]!;
  Object.assign(k, {
    interpolation: {
      type: 'custom-speed',
      points: [
        { t: 0, speed: 0 },
        { t: 1, speed: 0 },
      ],
    },
  });
  const json = JSON.stringify(raw),
    records: unknown[] = [];
  const loaded = loadProject(json, (d) => records.push(...d));
  expect(records).toHaveLength(1);
  expect(JSON.stringify(raw)).toBe(json);
  expect(
    findProperty(loaded, get().id).property.keyframes[0]!.interpolation.type,
  ).toBe('linear');
  expect(() => saveProject(raw)).toThrow();
});
it('K: legacy projects produce byte-identical saves/evaluations when unused', () => {
  const { sys, get } = fixture();
  const json = saveProject(sys.getSnapshot());
  expect(saveProject(loadProject(json))).toBe(json);
  expect(evaluateProperty(get(), 1)).toEqual(
    evaluateProperty(findProperty(loadProject(json), get().id).property, 1),
  );
});
it('simplifies hundreds of samples, retains peaks and exact pause boundaries', () => {
  const points = Array.from({ length: 1001 }, (_, i) => ({
    t: i / 1000,
    speed: i >= 400 && i <= 600 ? 0 : 1 + Math.sin((i / 1000) * 20) ** 2,
  }));
  const c = simplifySpeedStroke(points);
  expect(c.points.length).toBeLessThanOrEqual(128);
  expect(c.points).toContainEqual({ t: 0.4, speed: 0 });
  expect(c.points).toContainEqual({ t: 0.6, speed: 0 });
  expect(speedProgress(c, 0.4)).toBe(speedProgress(c, 0.6));
  expect(Math.max(...c.points.map((p) => p.speed))).toBeGreaterThan(1.99);
});
it('deleted endpoints reject stale interval atomically; normalized curve survives frame copy', () => {
  const { sys, get, id, property } = fixture();
  const original = id();
  sys.executeTransaction(
    transaction(
      'draw',
      'human',
      applySpeedCurveCommands(sys.getSnapshot(), original, curve),
    ),
  );
  const first = get().keyframes[0]!;
  // Native frame copying retains interpolation as serializable data.
  const copied = copyFrames(sys.getSnapshot(), [
    { propertyId: property.id, keyframeId: first.id },
  ]);
  expect(copied[0]!.frame.interpolation).toEqual(curve);
  expect(
    sys.executeTransaction(
      transaction(
        'paste',
        'human',
        pasteFrames(sys.getSnapshot(), copied, 3, [], [property.id]),
      ),
    ).ok,
  ).toBe(true);
  expect(get().keyframes.find((k) => k.time === 3)!.interpolation).toEqual(
    curve,
  );
  sys.executeTransaction(
    transaction('delete', 'human', [
      command({
        type: 'keyframe.delete',
        propertyId: property.id,
        keyframeId: first.id,
      }),
    ]),
  );
  const after = sys.getSnapshot();
  expect(() => applySpeedCurveCommands(after, original, curve)).toThrow();
  expect(sys.getSnapshot()).toBe(after);
});

it('Position/Scale/Rotation/Opacity all reuse native Commands and the same progress', () => {
  const project = createDefaultProject(),
    l = createLayer('rectangle'),
    sys = new CommandSystem(project);
  const specs = [
    {
      p: l.transform.position,
      a: { x: 0, y: 10 },
      b: { x: 100, y: 50 },
      mid: { x: 25, y: 20 },
    },
    {
      p: l.transform.scale,
      a: { x: 1, y: 1 },
      b: { x: 3, y: 5 },
      mid: { x: 1.5, y: 2 },
    },
    { p: l.transform.rotation, a: -90, b: 90, mid: -45 },
    { p: l.transform.opacity, a: 0, b: 1, mid: 0.25 },
  ];
  expect(
    sys.executeTransaction(
      transaction('setup', 'human', [
        command({
          type: 'layer.create',
          compositionId: project.activeCompositionId,
          layer: l,
        }),
        ...specs.flatMap((s) =>
          [0, 2].map((time) =>
            command({
              type: 'keyframe.add',
              propertyId: s.p.id,
              keyframe: {
                id: newId(),
                time,
                value: time ? s.b : s.a,
                interpolation: { type: 'linear' },
              },
            }),
          ),
        ),
      ]),
    ).ok,
  ).toBe(true);
  for (const s of specs) {
    const p = findProperty(sys.getSnapshot(), s.p.id).property;
    const segment = motionSegments(p)[0]!;
    expect(
      sys.executeTransaction(
        transaction(
          'curve',
          'human',
          applySpeedCurveCommands(sys.getSnapshot(), segment.id, curve),
        ),
      ).ok,
    ).toBe(true);
    expect(
      evaluateProperty(findProperty(sys.getSnapshot(), s.p.id).property, 1),
    ).toEqual(s.mid);
  }
});
