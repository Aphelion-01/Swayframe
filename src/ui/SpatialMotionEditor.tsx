import type { AnimValue } from '../core/core-types';
import type { Property, Keyframe } from '../core/project-model';
import { spatialControls, spatialPoint } from '../core/spatial-path';
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
  const controls = spatialControls(left, right),
    points = Array.from({ length: 51 }, (_, i) =>
      spatialPoint(left, right, i / 50),
    );
  const minX = Math.min(...points.map((p) => p.x)),
    minY = Math.min(...points.map((p) => p.y)),
    w = Math.max(1, Math.max(...points.map((p) => p.x)) - minX),
    h = Math.max(1, Math.max(...points.map((p) => p.y)) - minY);
  return (
    <details className="spatial-motion">
      <summary>空间路径（独立于缓动）</summary>
      <p>控制点使用图层局部像素坐标；这里只改变路径形状。</p>
      <svg viewBox="0 0 360 120" role="img" aria-label="空间运动路径">
        <path
          d={points
            .map(
              (p, i) =>
                `${i ? 'L' : 'M'}${20 + ((p.x - minX) / w) * 320},${15 + ((p.y - minY) / h) * 90}`,
            )
            .join(' ')}
          stroke="#86dcca"
          fill="none"
          strokeWidth="2"
        />
      </svg>
      <div className="graph-fields">
        {(['out', 'in'] as const).flatMap((side) =>
          (['x', 'y'] as const).map((axis) => (
            <NumberField
              key={side + axis}
              label={`路径${side === 'out' ? '出' : '入'}点 ${axis.toUpperCase()}`}
              value={controls[side][axis]}
              onCommit={(v) =>
                store.run('修改空间路径', [
                  command({
                    type: 'keyframe.update',
                    propertyId: property.id,
                    keyframeId: side === 'out' ? left.id : right.id,
                    patch: {
                      [side === 'out' ? 'spatialOutgoing' : 'spatialIncoming']:
                        { ...controls[side], [axis]: v },
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
