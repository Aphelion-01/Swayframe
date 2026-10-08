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
                <rect
                  x={p.x - 11}
                  y={p.y - 8}
                  width="22"
                  height="16"
                  rx="3"
                  fill="var(--background-primary)"
                  stroke="currentColor"
                  strokeWidth={selected ? 2 : 1}
                />
                <path
                  d={`M${p.x + 11},${p.y - 5} l7,-4 v18 l-7,-4 Z`}
                  fill="currentColor"
                />
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
