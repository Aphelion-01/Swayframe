import { canvasInteractionTokens } from './workspace/canvas-interaction';
import { useId, useRef } from 'react';
import type { RefObject } from 'react';
import { useInteractionCancel } from './workspace/interaction';
import type { EditorStore } from './editor-store';
import type {
  TransformContext,
  TransformInteractionSettings,
} from '../core/transform-context';
import type { transformGizmo } from '../core/transform-gizmo';
import type { TransformGuideModel } from '../core/transform-guidance';
import { guidanceFor } from './transform-guidance-controller';
export function TransformOverlay({
  store,
  context,
  gizmo,
  uiScale,
  canvas,
  model,
}: {
  store: EditorStore;
  context: TransformContext;
  gizmo: ReturnType<typeof transformGizmo>;
  uiScale: number;
  canvas: RefObject<HTMLCanvasElement | null>;
  model: TransformGuideModel;
}) {
  const id = useId().replace(/:/g, '');
  const controller = guidanceFor(store);
  const drag = useRef<
    | { settings: TransformInteractionSettings; project: unknown; time: number }
    | undefined
  >(undefined);
  const validDrag = () =>
    drag.current &&
    drag.current.project === store.getSnapshot().project &&
    drag.current.time === store.getSnapshot().time &&
    drag.current.settings === store.getSnapshot().transformSettings;
  const cancel = () => {
    if (drag.current) controller.preview();
    drag.current = undefined;
  };
  useInteractionCancel(cancel);
  const arrow = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    key: string,
    cls: string,
  ) => (
    <line
      key={key}
      className={cls}
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      markerEnd={`url(#${id}-arrow)`}
    />
  );
  return (
    <svg
      className={`transform-overlay guide-mode-${model.property} ${model.active ? 'guide-active' : ''}`}
      aria-label="变换控制器"
      data-orientation={context.settings.orientation}
      data-pivot={context.settings.pivotMode}
      data-property={model.property}
      viewBox={`0 0 ${context.snapshot.width} ${context.snapshot.height}`}
    >
      <defs>
        <marker
          id={`${id}-arrow`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path
            d="M 1 1 L 9 5 L 1 9"
            fill="none"
            stroke="context-stroke"
            strokeWidth="1.7"
          />
        </marker>
      </defs>
      <g className="guide-ghost" aria-label="变换结果轮廓预览">
        {model.ghostPreview.map((points, i) => (
          <polygon
            key={i}
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          />
        ))}
      </g>
      {model.connectionLines.map((line, i) =>
        arrow(line.start, line.end, `connection-${i}`, 'guide-connection'),
      )}
      <polygon
        className="transform-box"
        points={gizmo.box.map((p) => `${p.x},${p.y}`).join(' ')}
      />
      {gizmo.handles
        .filter((h) => h.kind !== 'move')
        .map((h, i) =>
          h.kind === 'scale' ? (
            <rect
              key={i}
              className="guide-scale-handle"
              x={h.point.x - (canvasInteractionTokens.handleSize / 2) * uiScale}
              y={h.point.y - (canvasInteractionTokens.handleSize / 2) * uiScale}
              width={canvasInteractionTokens.handleSize * uiScale}
              height={canvasInteractionTokens.handleSize * uiScale}
            />
          ) : (
            <circle
              key={i}
              className="guide-rotate-handle"
              cx={h.point.x}
              cy={h.point.y}
              r={5 * uiScale}
            />
          ),
        )}
      {model.axes.map((axis, i) => (
        <g
          key={i}
          className={`transform-axis axis-${axis.axis} ${model.activeAxis && model.activeAxis !== axis.axis ? 'guide-dim' : ''}`}
        >
          {arrow(axis.start, axis.end, `axis-${i}`, 'guide-axis')}
          <text
            x={axis.end.x + 8 * uiScale}
            y={axis.end.y + 4 * uiScale}
            fontSize={11 * uiScale}
          >
            {axis.axis?.toUpperCase()}
          </text>
        </g>
      ))}
      {model.scaleDirections.map((line, i) =>
        arrow(
          line.start,
          line.end,
          `scale-${i}`,
          `guide-expansion ${line.axis ? `axis-${line.axis}` : ''}`,
        ),
      )}
      {model.rotationArcs.map((arc, i) => {
        const clockwise = !model.active || arc.angle >= 0;
        const end = (arc.angle * Math.PI) / 180;
        const start =
          end - (clockwise ? 1 : -1) * ((arc.sweepDegrees * Math.PI) / 180);
        const p = (a: number) => ({
          x: arc.pivot.x + Math.cos(a) * arc.radius,
          y: arc.pivot.y + Math.sin(a) * arc.radius,
        });
        const a = p(start),
          b = p(end);
        return (
          <g key={i} className="guide-rotation" aria-label="围绕支点旋转">
            <path
              data-direction={clockwise ? 'clockwise' : 'counterclockwise'}
              d={`M ${a.x} ${a.y} A ${arc.radius} ${arc.radius} 0 0 ${clockwise ? 1 : 0} ${b.x} ${b.y}`}
              markerEnd={`url(#${id}-arrow)`}
            />
            {model.active && (
              <text
                x={arc.pivot.x + 48 * uiScale}
                y={arc.pivot.y - 10 * uiScale}
                fontSize={11 * uiScale}
              >
                {arc.angle.toFixed(1)}°
              </text>
            )}
          </g>
        );
      })}
      {model.anchors.map((p, i) => (
        <g key={i} className="guide-anchor" aria-label="可拖动图层锚点">
          <circle cx={p.x} cy={p.y} r={5 * uiScale} />
          <path
            d={`M ${p.x - 9 * uiScale} ${p.y} h ${18 * uiScale} M ${p.x} ${p.y - 9 * uiScale} v ${18 * uiScale}`}
          />
        </g>
      ))}
      {model.fixedPoints.map((p, i) => (
        <g
          key={i}
          className="pivot-marker guide-fixed"
          aria-label="固定变换支点"
        >
          <circle cx={p.x} cy={p.y} r={8 * uiScale} />
          <circle cx={p.x} cy={p.y} r={3 * uiScale} />
          <path
            d={`M ${p.x - 13 * uiScale} ${p.y} h ${4 * uiScale} M ${p.x + 9 * uiScale} ${p.y} h ${4 * uiScale} M ${p.x} ${p.y - 13 * uiScale} v ${4 * uiScale} M ${p.x} ${p.y + 9 * uiScale} v ${4 * uiScale}`}
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
            const view = store.getSnapshot();
            drag.current = {
              settings: view.transformSettings,
              project: view.project,
              time: view.time,
            };
          }}
          onPointerMove={(e) => {
            if (!drag.current || !canvas.current) return;
            if (!validDrag()) {
              cancel();
              return;
            }
            const rect = canvas.current.getBoundingClientRect();
            controller.preview({
              customPivot: {
                x:
                  ((e.clientX - rect.left) * context.snapshot.width) /
                  rect.width,
                y:
                  ((e.clientY - rect.top) * context.snapshot.height) /
                  rect.height,
              },
            });
          }}
          onPointerUp={() => {
            if (drag.current) {
              if (!validDrag()) {
                cancel();
                return;
              }
              const before = drag.current.settings;
              const customPivot =
                controller.getSnapshot().referencePreview?.customPivot;
              drag.current = undefined;
              controller.preview();
              if (customPivot)
                store.commitTransformReference({ customPivot }, before);
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
              store.commitTransformReference({
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
