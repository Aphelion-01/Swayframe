import { useRef, useState } from 'react';
import { rulerStep } from '../core/spatial-view';
import { usePointerRelease } from './workspace/pointer-release';
import { useInteractionCancel } from './workspace/interaction';
export interface CanvasAidSettings {
  grid: boolean;
  rulers: boolean;
  guides: boolean;
  gridSize?: number;
  subdivisions?: number;
  safeZones?: boolean;
  thirds?: boolean;
}
type Guide = { id: string; axis: 'x' | 'y'; value: number };
export function CanvasAids({
  width,
  height,
  scale,
  compositionId,
  settings,
}: {
  width: number;
  height: number;
  scale: number;
  compositionId: string;
  settings: CanvasAidSettings;
}) {
  const key = `swayframe.guides.${compositionId}`;
  const [saved, setSaved] = useState<{ key: string; items: Guide[] }>(() => {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      const items = Array.isArray(raw)
        ? raw.filter(
            (g): g is Guide =>
              !!g &&
              typeof g.id === 'string' &&
              ['x', 'y'].includes(g.axis) &&
              Number.isFinite(g.value),
          )
        : [];
      return { key, items };
    } catch {
      return { key, items: [] };
    }
  });
  const guides = saved.key === key ? saved.items : [];
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef<
    { guide: Guide; before: Guide[]; items: Guide[] } | undefined
  >(undefined);
  const persist = (items: Guide[]) => {
    setSaved({ key, items });
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      /* Preferences only. */
    }
  };
  const sample = (x: number, y: number) => {
    if (!drag.current || !ref.current) return;
    const r = ref.current.getBoundingClientRect(),
      g = drag.current.guide,
      value =
        g.axis === 'x'
          ? ((x - r.left) / r.width) * width
          : ((y - r.top) / r.height) * height;
    drag.current.items = [
      ...drag.current.before.filter((i) => i.id !== g.id),
      { ...g, value },
    ];
    setSaved({ key, items: drag.current.items });
  };
  const cancel = () => {
    if (drag.current) setSaved({ key, items: drag.current.before });
    drag.current = undefined;
  };
  usePointerRelease({
    active: () => !!drag.current,
    move: (e) => sample(e.clientX, e.clientY),
    finish: (e) => {
      sample(e.clientX, e.clientY);
      if (drag.current)
        persist(
          drag.current.items.filter(
            (g) => g.value >= 0 && g.value <= (g.axis === 'x' ? width : height),
          ),
        );
      drag.current = undefined;
    },
    cancel,
  });
  useInteractionCancel(cancel);
  const begin = (
    e: React.PointerEvent<SVGElement>,
    axis: 'x' | 'y',
    guide?: Guide,
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = {
      guide: guide ?? { id: crypto.randomUUID(), axis, value: 0 },
      before: guides,
      items: guides,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    sample(e.clientX, e.clientY);
  };
  const step = rulerStep(scale),
    xs = Array.from({ length: Math.ceil(width / step) }, (_, i) => i * step),
    ys = Array.from({ length: Math.ceil(height / step) }, (_, i) => i * step),
    bar = 20 * scale;
  return (
    <svg
      ref={ref}
      className="canvas-drawing-aids"
      viewBox={`0 0 ${width} ${height}`}
      aria-label="画布作图辅助"
    >
      {settings.grid &&
        (() => {
          const base = Math.max(
              8,
              Math.min(
                1000,
                Number.isFinite(settings.gridSize) ? settings.gridSize! : 100,
              ),
            ),
            major = base * Math.max(1, Math.ceil(rulerStep(scale) / base)),
            minor =
              major /
              Math.max(
                1,
                Math.min(
                  10,
                  Number.isFinite(settings.subdivisions)
                    ? settings.subdivisions!
                    : 5,
                ),
              );
          const lines = (step: number, opacity: number, weight: number) => (
            <g
              opacity={opacity}
              stroke="var(--text-muted)"
              strokeWidth={scale * weight}
            >
              {Array.from({ length: Math.ceil(width / step) }, (_, i) => (
                <line
                  key={'x' + i}
                  x1={i * step}
                  x2={i * step}
                  y1={0}
                  y2={height}
                />
              ))}
              {Array.from({ length: Math.ceil(height / step) }, (_, i) => (
                <line
                  key={'y' + i}
                  x1={0}
                  x2={width}
                  y1={i * step}
                  y2={i * step}
                />
              ))}
            </g>
          );
          return (
            <g aria-label="合成像素网格">
              {minor / scale >= 6 && lines(minor, 0.12, 0.6)}
              {lines(major, 0.4, 1)}
            </g>
          );
        })()}
      {settings.safeZones && (
        <g
          aria-label="标题与动作安全框"
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth={scale}
          strokeDasharray={`${5 * scale} ${4 * scale}`}
        >
          {[0.05, 0.1].map((m) => (
            <rect
              key={m}
              x={width * m}
              y={height * m}
              width={width * (1 - m * 2)}
              height={height * (1 - m * 2)}
            />
          ))}
          <path
            d={`M${width / 2 - 10 * scale},${height / 2}h${20 * scale}M${width / 2},${height / 2 - 10 * scale}v${20 * scale}`}
          />
        </g>
      )}
      {settings.thirds && (
        <g
          aria-label="三分构图参考"
          stroke="var(--text-secondary)"
          opacity=".5"
          strokeWidth={scale}
        >
          {[1 / 3, 2 / 3].map((t) => (
            <g key={t}>
              <line x1={width * t} x2={width * t} y1={0} y2={height} />
              <line x1={0} x2={width} y1={height * t} y2={height * t} />
            </g>
          ))}
        </g>
      )}
      {(settings.guides || !!drag.current) &&
        guides.map((g) => (
          <g key={g.id}>
            <line
              x1={g.axis === 'x' ? g.value : 0}
              x2={g.axis === 'x' ? g.value : width}
              y1={g.axis === 'y' ? g.value : 0}
              y2={g.axis === 'y' ? g.value : height}
              stroke="var(--accent-primary)"
              strokeWidth={scale}
            />
            <line
              aria-label={`参考线 ${g.axis.toUpperCase()} ${Math.round(g.value)} px`}
              x1={g.axis === 'x' ? g.value : 0}
              x2={g.axis === 'x' ? g.value : width}
              y1={g.axis === 'y' ? g.value : 0}
              y2={g.axis === 'y' ? g.value : height}
              stroke="transparent"
              strokeWidth={8 * scale}
              style={{
                pointerEvents: 'stroke',
                cursor: g.axis === 'x' ? 'ew-resize' : 'ns-resize',
              }}
              onPointerDown={(e) => begin(e, g.axis, g)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                persist(guides.filter((i) => i.id !== g.id));
              }}
            />
          </g>
        ))}
      {settings.rulers && (
        <g aria-label="像素标尺">
          <rect
            x="0"
            y="0"
            width={width}
            height={bar}
            fill="var(--background-secondary)"
            style={{ pointerEvents: 'all', cursor: 'crosshair' }}
            aria-label="拖出水平参考线"
            onPointerDown={(e) => begin(e, 'y')}
          />
          <rect
            x="0"
            y="0"
            width={bar}
            height={height}
            fill="var(--background-secondary)"
            style={{ pointerEvents: 'all', cursor: 'crosshair' }}
            aria-label="拖出垂直参考线"
            onPointerDown={(e) => begin(e, 'x')}
          />
          {xs.map((x) => (
            <g key={x}>
              <line
                x1={x}
                x2={x}
                y1={bar - 5 * scale}
                y2={bar}
                stroke="var(--text-muted)"
                strokeWidth={scale}
              />
              <text
                x={x + 3 * scale}
                y={11 * scale}
                fill="var(--text-secondary)"
                fontSize={10 * scale}
              >
                {x}
              </text>
            </g>
          ))}
          {ys
            .filter((y) => y > 0)
            .map((y) => (
              <g key={y}>
                <line
                  x1={bar - 5 * scale}
                  x2={bar}
                  y1={y}
                  y2={y}
                  stroke="var(--text-muted)"
                  strokeWidth={scale}
                />
                <text
                  transform={`translate(${11 * scale},${y + 3 * scale}) rotate(90)`}
                  fill="var(--text-secondary)"
                  fontSize={10 * scale}
                >
                  {y}
                </text>
              </g>
            ))}
          <rect width={bar} height={bar} fill="var(--background-tertiary)" />
          <text
            x={3 * scale}
            y={13 * scale}
            fontSize={9 * scale}
            fill="var(--text-muted)"
          >
            px
          </text>
        </g>
      )}
    </svg>
  );
}
