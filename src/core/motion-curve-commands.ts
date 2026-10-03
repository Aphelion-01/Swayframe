import { reverseMotionCurve } from './motion-curve-operations';
import type { MotionPresetLibrary, MotionPreset } from './motion-presets';
import { command, transaction } from './command-system';
import type {
  Command,
  CommandSystem,
  Transaction,
  TransactionResult,
} from './command-system';
import type { Project, Property } from './project-model';
import { findProperty } from './project-model';
import type { AnimValue } from './core-types';
import type { FrameRef } from './editing-commands';
import {
  cubicCoordinates,
  curveInterpolation,
  motionCurveSchema,
  motionSegments,
  resolveMotionSegment,
  evaluateMotionCurve,
  motionCurveVelocity,
} from './motion-curve';
import type { MotionCurve, MotionCurveApplyMode } from './motion-curve';

export function selectedMotionSegments(
  project: Project,
  refs: readonly FrameRef[],
): readonly string[] {
  const selected = new Set(refs.map((r) => r.keyframeId));
  return [...new Set(refs.map((r) => r.propertyId))].flatMap((id) =>
    motionSegments(findProperty(project, id).property)
      .filter((s) => selected.has(s.from.id) && selected.has(s.to.id))
      .map((s) => s.id),
  );
}
export function mergeMotionCurve(
  current: MotionCurve | null,
  next: MotionCurve,
  mode: MotionCurveApplyMode,
): MotionCurve {
  if (mode === 'both') return next;
  if (!current) throw new Error('保持/弹簧区间请先用“双侧”转换曲线');
  const a = cubicCoordinates(current),
    b = cubicCoordinates(next);
  return mode === 'out'
    ? { ...a, x1: b.x1, y1: b.y1 }
    : { ...a, x2: b.x2, y2: b.y2 };
}
/** Compound command builder; a single transaction owns all affected segments. */
export function applyMotionCurveCommands(
  project: Project,
  ids: readonly string[],
  input: MotionCurve,
  mode: MotionCurveApplyMode = 'both',
): readonly Command[] {
  const curve = motionCurveSchema.parse(input);
  if (!['both', 'out', 'in'].includes(mode)) throw new Error('应用模式无效');
  if (!ids.length) throw new Error('请选择两个相邻关键帧或指定区间');
  return [...new Set(ids)].flatMap((id) => {
    const s = resolveMotionSegment(project, id),
      location = findProperty(project, s.propertyId);
    if (location.layer.locked) throw new Error('图层已锁定');
    if (
      Array.isArray(s.from.value) &&
      Array.isArray(s.to.value) &&
      s.from.value.length !== s.to.value.length
    )
      throw new Error('不同拓扑的路径不能应用连续缓动');
    const c = mergeMotionCurve(s.curve, curve, mode),
      interpolation = curveInterpolation(c),
      b = cubicCoordinates(c);
    return [
      command({
        type: 'keyframe.update',
        propertyId: s.propertyId,
        keyframeId: s.from.id,
        patch: {
          interpolation,
          outgoing: c.type === 'linear' ? null : { x: b.x1, y: b.y1 },
        },
      }),
      command({
        type: 'keyframe.update',
        propertyId: s.propertyId,
        keyframeId: s.to.id,
        patch: { incoming: c.type === 'linear' ? null : { x: b.x2, y: b.y2 } },
      }),
    ];
  });
}
/** Same validated command patches for ephemeral UI preview; never commits a scene. */
export function previewMotionCurve(
  project: Project,
  ids: readonly string[],
  curve: MotionCurve,
  mode: MotionCurveApplyMode = 'both',
): readonly Property<AnimValue>[] {
  const properties = new Map<string, Property<AnimValue>>();
  for (const c of applyMotionCurveCommands(project, ids, curve, mode)) {
    if (c.type !== 'keyframe.update') continue;
    const p =
      properties.get(c.propertyId) ??
      findProperty(project, c.propertyId).property;
    properties.set(p.id, {
      ...p,
      keyframes: p.keyframes.map((k) => {
        if (k.id !== c.keyframeId) return k;
        const { incoming, outgoing, ...patch } = c.patch;
        const next = { ...k, ...patch };
        if (incoming === null) delete next.incoming;
        else if (incoming) next.incoming = incoming;
        if (outgoing === null) delete next.outgoing;
        else if (outgoing) next.outgoing = outgoing;
        return next as typeof k;
      }),
    });
  }
  return [...properties.values()];
}
export class MotionCurveAPI {
  constructor(
    private readonly system: CommandSystem,
    private readonly source: Transaction['source'] = 'human',
    private readonly presets?: MotionPresetLibrary,
  ) {}
  getMotionCurve(id: string): MotionCurve | null {
    return resolveMotionSegment(this.system.getSnapshot(), id).curve;
  }
  applyMotionCurve(
    ids: readonly string[],
    curve: MotionCurve,
    mode: MotionCurveApplyMode = 'both',
  ): TransactionResult {
    try {
      return this.system.executeTransaction(
        transaction(
          '应用动画曲线',
          this.source,
          applyMotionCurveCommands(this.system.getSnapshot(), ids, curve, mode),
        ),
      );
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '曲线无效',
      };
    }
  }
  reverseMotionCurve(ids: readonly string[]): TransactionResult {
    try {
      const project = this.system.getSnapshot();
      const commands = ids.flatMap((id) => {
        const c = resolveMotionSegment(project, id).curve;
        if (!c) throw new Error('当前区间不支持反转');
        return applyMotionCurveCommands(project, [id], reverseMotionCurve(c));
      });
      return this.system.executeTransaction(
        transaction('反转动画曲线', this.source, commands),
      );
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : '反转失败' };
    }
  }
  saveMotionPreset(
    name: string,
    curve: MotionCurve,
    metadata: Partial<
      Pick<MotionPreset, 'category' | 'tags' | 'intensity'>
    > = {},
  ) {
    if (!this.presets) throw new Error('尚未连接用户曲线库');
    return this.presets.saveMotionPreset(name, curve, metadata);
  }
  analyzeMotionCurve(id: string) {
    const segment = resolveMotionSegment(this.system.getSnapshot(), id),
      curve = segment.curve;
    if (!curve) return { segmentId: id, supported: false as const };
    const samples = Array.from({ length: 101 }, (_, i) =>
      evaluateMotionCurve(curve, i / 100),
    );
    return {
      segmentId: id,
      supported: true as const,
      curve,
      duration: segment.to.time - segment.from.time,
      minimum: Math.min(...samples),
      maximum: Math.max(...samples),
      incomingNormalizedVelocity: motionCurveVelocity(curve, 1),
      outgoingNormalizedVelocity: motionCurveVelocity(curve, 0),
    };
  }
}
