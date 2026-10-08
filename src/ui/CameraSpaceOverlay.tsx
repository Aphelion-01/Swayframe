import { point4, transform4, type Point3 } from '../core/perspective';
import { cameraForLayer, cameraFrustum } from '../core/camera-optics';
import type { RenderSnapshot } from '../core/renderer-core';
import type { EditorStore } from './editor-store';
import type { SpatialProjector } from './ThreeDGizmo';
import { useEditorSlice } from './use-editor-slice';
export function CameraSpaceOverlay({
  store,
  snapshot,
  project,
  width,
  height,
}: {
  store: EditorStore;
  snapshot: RenderSnapshot;
  project: SpatialProjector;
  width: number;
  height: number;
}) {
  const v = useEditorSlice(store, ['selection', 'showCameraFrustum']);
  return (
    <svg
      className="camera-space-overlay"
      viewBox={`0 0 ${width} ${height}`}
      aria-label="摄像机位置与拍摄范围"
    >
      {snapshot.layers
        .filter((l) => l.source.type === 'camera' && l.source.visible)
        .map((l) => {
          const camera = cameraForLayer(
              l.source,
              snapshot.time,
              snapshot.width,
              snapshot.height,
              l.world3D,
            ),
            p = project(camera.position),
            corners = cameraFrustum(camera).map(project),
            selected = v.selection.includes(l.source.id);
          if (!p) return null;
          const points = corners.every(Boolean)
            ? corners.map((q) => `${q!.x},${q!.y}`).join(' ')
            : undefined;
          const bodyWorld = transform4(camera.position, camera.rotation);
          const body = [
            [-28, -20, -40],
            [28, -20, -40],
            [28, 20, -40],
            [-28, 20, -40],
            [-28, -20, 0],
            [28, -20, 0],
            [28, 20, 0],
            [-28, 20, 0],
            [-18, -13, 22],
            [18, -13, 22],
            [18, 13, 22],
            [-18, 13, 22],
            [-14, -20, -32],
            [14, -20, -32],
            [0, -36, -32],
          ].map((v) => project(point4(bodyWorld, v as unknown as Point3)));
          const edges = [
            [0, 1],
            [1, 2],
            [2, 3],
            [3, 0],
            [4, 5],
            [5, 6],
            [6, 7],
            [7, 4],
            [0, 4],
            [1, 5],
            [2, 6],
            [3, 7],
            [4, 8],
            [5, 9],
            [6, 10],
            [7, 11],
            [8, 9],
            [9, 10],
            [10, 11],
            [11, 8],
            [12, 13],
            [13, 14],
            [14, 12],
          ];
          return (
            <g
              key={l.source.id}
              style={{
                color: selected ? 'var(--accent-primary)' : 'var(--text-muted)',
              }}
            >
              {selected && v.showCameraFrustum && (
                <g
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="5 4"
                >
                  {corners.map(
                    (q, i) =>
                      q && <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />,
                  )}
                  {points && (
                    <polygon
                      points={points}
                      fill="var(--accent-primary)"
                      fillOpacity="0.06"
                    />
                  )}
                  {corners[0] && (
                    <text
                      x={corners[0].x}
                      y={corners[0].y - 8}
                      fill="currentColor"
                      stroke="none"
                      fontSize="11"
                    >
                      对焦平面 · {camera.focusDistance?.toFixed(0)}
                    </text>
                  )}
                </g>
              )}
              <g
                role="button"
                tabIndex={0}
                aria-label={`空间选择 ${l.source.name}`}
                style={{ pointerEvents: 'all', cursor: 'pointer' }}
                onPointerDown={(e) => {
                  if (e.button === 0 && !e.altKey) {
                    e.stopPropagation();
                    store.select(l.source.id, e.shiftKey);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') store.select(l.source.id, e.shiftKey);
                }}
              >
                <title>
                  摄像机实体 · 点击选择 · 在属性面板调整位置、旋转与光学参数
                </title>
                {edges.map(
                  ([a, b], i) =>
                    body[a!] &&
                    body[b!] && (
                      <line
                        key={i}
                        x1={body[a!]!.x}
                        y1={body[a!]!.y}
                        x2={body[b!]!.x}
                        y2={body[b!]!.y}
                        stroke="currentColor"
                        strokeWidth={selected ? 2 : 1.4}
                      />
                    ),
                )}
                <circle cx={p.x} cy={p.y} r="16" fill="transparent" />
                <text
                  x={p.x - 10}
                  y={p.y - 15}
                  fill="currentColor"
                  fontSize="11"
                >
                  {l.source.name}
                  {snapshot.camera?.layerId === l.source.id
                    ? ' · 拍摄中'
                    : ' · 未生效'}
                </text>
              </g>
            </g>
          );
        })}
    </svg>
  );
}
