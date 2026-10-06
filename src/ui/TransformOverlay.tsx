import { useRef } from 'react';
import type { RefObject } from 'react';
import { useInteractionCancel } from './workspace/interaction';
import type { EditorStore } from './editor-store';
import type {
  TransformContext,
  TransformInteractionSettings,
} from '../core/transform-context';
import type { transformGizmo } from '../core/transform-gizmo';
import { pivotLabels, orientationLabels } from './TransformControls';
export function TransformOverlay({
  store,
  context,
  gizmo,
  uiScale,
  anchorMode,
  canvas,
}: {
  store: EditorStore;
  context: TransformContext;
  gizmo: ReturnType<typeof transformGizmo>;
  uiScale: number;
  anchorMode: boolean;
  canvas: RefObject<HTMLCanvasElement | null>;
}) {
  const drag = useRef<TransformInteractionSettings | undefined>(undefined);
  const cancel = () => {
    if (drag.current)
      store.setTransformSettings({
        ...drag.current,
        customPivot: drag.current.customPivot,
      });
    drag.current = undefined;
  };
  useInteractionCancel(cancel);
  const pivots =
    context.settings.pivotMode === 'individual-origins'
      ? [...context.pivots.values()]
      : [context.pivot];
  return (
    <svg
      className="transform-overlay"
      aria-label="变换控制器"
      data-orientation={context.settings.orientation}
      data-pivot={context.settings.pivotMode}
      viewBox={`0 0 ${context.snapshot.width} ${context.snapshot.height}`}
    >
      <polygon
        className="transform-box"
        points={gizmo.box.map((p) => `${p.x},${p.y}`).join(' ')}
      />
      {gizmo.handles.map((h, i) =>
        h.kind === 'scale' ? (
          <rect
            key={i}
            x={h.point.x - 4 * uiScale}
            y={h.point.y - 4 * uiScale}
            width={8 * uiScale}
            height={8 * uiScale}
          />
        ) : h.kind === 'rotate' ? (
          <circle key={i} cx={h.point.x} cy={h.point.y} r={5 * uiScale} />
        ) : (
          <g key={i} className={`transform-axis axis-${h.axis}`}>
            <line
              x1={context.pivot.x}
              y1={context.pivot.y}
              x2={h.point.x}
              y2={h.point.y}
            />
            <circle cx={h.point.x} cy={h.point.y} r={4 * uiScale} />
            <title>
              {orientationLabels[context.settings.orientation]}{' '}
              {h.axis?.toUpperCase()} 轴：沿此方向移动
            </title>
            <text
              x={h.point.x + 8 * uiScale}
              y={h.point.y + 4 * uiScale}
              fontSize={11 * uiScale}
            >
              {h.axis?.toUpperCase()}
            </text>
          </g>
        ),
      )}
      {anchorMode &&
        [...context.initialTransforms.values()].map((l) => (
          <g key={l.source.id} aria-label="可拖动图层锚点">
            <circle
              className="anchor-marker"
              cx={l.position.x}
              cy={l.position.y}
              r={4 * uiScale}
            />
            <text
              className="pivot-caption"
              x={l.position.x - 12 * uiScale}
              y={l.position.y + 30 * uiScale}
              fontSize={11 * uiScale}
            >
              锚点编辑
            </text>
          </g>
        ))}
      {pivots.map((pivot, i) => (
        <g
          key={i}
          className="pivot-marker"
          aria-label={`当前支点：${pivotLabels[context.settings.pivotMode]}`}
        >
          <circle cx={pivot.x} cy={pivot.y} r={6 * uiScale} />
          <circle
            className="pivot-orbit"
            cx={pivot.x}
            cy={pivot.y}
            r={24 * uiScale}
          />
          <text
            className="pivot-caption"
            x={pivot.x + 12 * uiScale}
            y={pivot.y - 30 * uiScale}
            fontSize={11 * uiScale}
          >
            {orientationLabels[context.settings.orientation]} ·{' '}
            {pivotLabels[context.settings.pivotMode]}
            {pivots.length > 1 ? ` ${i + 1}` : ''}
          </text>
          <path
            d={`M ${pivot.x - 10 * uiScale} ${pivot.y} h ${20 * uiScale} M ${pivot.x} ${pivot.y - 10 * uiScale} v ${20 * uiScale}`}
          />
        </g>
      ))}
      {context.settings.pivotMode === 'custom' && (
        <circle
          className="custom-pivot-handle"
          aria-label="拖动自定义支点"
          role="slider"
          tabIndex={0}
          aria-valuetext={`${context.pivot.x.toFixed(1)}, ${context.pivot.y.toFixed(1)}`}
          cx={context.pivot.x}
          cy={context.pivot.y}
          r={10 * uiScale}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = store.getSnapshot().transformSettings;
          }}
          onPointerMove={(e) => {
            if (!drag.current || !canvas.current) return;
            const rect = canvas.current.getBoundingClientRect();
            store.setTransformSettings(
              {
                customPivot: {
                  x:
                    ((e.clientX - rect.left) * context.snapshot.width) /
                    rect.width,
                  y:
                    ((e.clientY - rect.top) * context.snapshot.height) /
                    rect.height,
                },
              },
              false,
            );
          }}
          onPointerUp={() => {
            if (drag.current) {
              drag.current = undefined;
              store.setTransformSettings({
                customPivot: store.getSnapshot().transformSettings.customPivot,
              });
            }
          }}
          onPointerCancel={cancel}
          onLostPointerCapture={cancel}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancel();
              return;
            }
            if (
              ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
                e.key,
              )
            ) {
              e.preventDefault();
              e.stopPropagation();
              const step = e.shiftKey ? 10 : 1,
                p = context.pivot;
              store.setTransformSettings({
                customPivot: {
                  x:
                    p.x +
                    (e.key === 'ArrowLeft'
                      ? -step
                      : e.key === 'ArrowRight'
                        ? step
                        : 0),
                  y:
                    p.y +
                    (e.key === 'ArrowUp'
                      ? -step
                      : e.key === 'ArrowDown'
                        ? step
                        : 0),
                },
              });
            }
          }}
        />
      )}
    </svg>
  );
}
