import type { AnimValue } from '../core/core-types';
import type { Property, Keyframe } from '../core/project-model';
import {
  spatialControls,
  spatialPoint,
  spatialControls3,
  spatialPoint3,
} from '../core/spatial-path';
import { command } from '../core/command-system';
import type { EditorStore } from './editor-store';
import { NumberField } from './fields';
export function SpatialMotionEditor({
  store,
  property,
  left,
  right,
}: {
  store: EditorStore;
  property: Property<AnimValue>;
  left: Keyframe<AnimValue>;
  right: Keyframe<AnimValue>;
}) {
  const vector = Array.isArray(left.value);
  const raw = vector
    ? spatialControls3(left, right)
    : spatialControls(left, right);
  const asArray = (v: AnimValue) =>
    Array.isArray(v)
      ? v
      : [(v as { x: number; y: number }).x, (v as { x: number; y: number }).y];
  const controls = { out: asArray(raw.out), in: asArray(raw.in) };
  const update = (side: 'in' | 'out', axis: number, value: number) => {
    const next = controls[side].map((n, i) => (i === axis ? value : n));
    return vector ? next : { x: next[0]!, y: next[1]! };
  };
  const points = Array.from({ length: 51 }, (_, i) =>
    vector
      ? {
          x: spatialPoint3(left, right, i / 50)[0]!,
          y: spatialPoint3(left, right, i / 50)[1]!,
        }
      : spatialPoint(left, right, i / 50),
  );
  const minX = Math.min(...points.map((p) => p.x)),
    minY = Math.min(...points.map((p) => p.y)),
    w = Math.max(1, Math.max(...points.map((p) => p.x)) - minX),
    h = Math.max(1, Math.max(...points.map((p) => p.y)) - minY);
  return (
    <details className="spatial-motion">
      <summary>空间路径（独立于缓动）</summary>
      <p>
        控制点使用图层局部坐标；这里只改变路径形状。三维图示为 XY 投影，Z
        可精确输入，或在空间视图直接拖动。
      </p>
      <svg viewBox="0 0 360 120" role="img" aria-label="空间运动路径">
        <path
          d={points
            .map(
              (p, i) =>
                `${i ? 'L' : 'M'}${20 + ((p.x - minX) / w) * 320},${15 + ((p.y - minY) / h) * 90}`,
            )
            .join(' ')}
          stroke="var(--success)"
          fill="none"
          strokeWidth="2"
        />
      </svg>
      <div className="graph-fields">
        {(['out', 'in'] as const).flatMap((side) =>
          (vector ? [0, 1, 2] : [0, 1]).map((axis) => (
            <NumberField
              key={side + axis}
              revision={property}
              time={store.getSnapshot().time}
              onPreview={(v) =>
                store.setPropertyPreview({
                  id: property.id,
                  property: {
                    ...property,
                    keyframes: property.keyframes.map((keyframe) =>
                      keyframe.id === (side === 'out' ? left.id : right.id)
                        ? {
                            ...keyframe,
                            [side === 'out'
                              ? 'spatialOutgoing'
                              : 'spatialIncoming']: update(side, axis, v),
                          }
                        : keyframe,
                    ),
                  },
                })
              }
              onCancel={() => store.setPropertyPreview(undefined)}
              label={`路径${side === 'out' ? '出' : '入'}点 ${'XYZ'[axis]}`}
              value={controls[side][axis]}
              onCommit={(v) =>
                store.run('修改空间路径', [
                  command({
                    type: 'keyframe.update',
                    propertyId: property.id,
                    keyframeId: side === 'out' ? left.id : right.id,
                    patch: {
                      [side === 'out' ? 'spatialOutgoing' : 'spatialIncoming']:
                        update(side, axis, v),
                    },
                  }),
                ])
              }
              onError={(m) => store.setStatus(m, true)}
            />
          )),
        )}
      </div>
      <button
        onClick={() =>
          store.run('恢复直线路径', [
            command({
              type: 'keyframe.update',
              propertyId: property.id,
              keyframeId: left.id,
              patch: { spatialOutgoing: null },
            }),
            command({
              type: 'keyframe.update',
              propertyId: property.id,
              keyframeId: right.id,
              patch: { spatialIncoming: null },
            }),
          ])
        }
      >
        恢复直线路径
      </button>
    </details>
  );
}
