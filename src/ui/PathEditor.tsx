import { usePointerRelease } from './workspace/pointer-release';
import { Modal } from './workspace/primitives';
import { useInteractionCancel } from './workspace/interaction';
import { useRef, useState, useSyncExternalStore } from 'react';
import { evaluateProperty } from '../core/animation-engine';
import { activeComposition } from '../core/project-model';
import type { Property } from '../core/project-model';
import {
  addPathPoint,
  movePathPoint,
  removePathPoint,
  pathSvg,
} from '../core/shape-geometry';
import { NumberField } from './fields';
import type { EditorStore } from './editor-store';
function fitPath(value: readonly number[]) {
  const xs = value.filter((_, i) => i % 2 === 0),
    ys = value.filter((_, i) => i % 2 === 1);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  const width = Math.max(120, right - left + 64, (bottom - top + 64) * 1.5),
    height = width / 1.5;
  return {
    x: (left + right - width) / 2,
    y: (top + bottom - height) / 2,
    width,
    height,
  };
}
export function PathEditor({
  store,
  property,
  title = '路径',
  closed = true,
  onClose,
}: {
  store: EditorStore;
  property: Property<readonly number[]>;
  title?: string;
  closed?: boolean;
  onClose: () => void;
}) {
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot),
    c = activeComposition(view.project);
  const [selected, setSelected] = useState(0),
    [selectedHandle, setSelectedHandle] = useState<0 | 1 | 2>(0),
    drag = useRef<
      | {
          index: number;
          handle: 0 | 1 | 2;
          data: readonly number[];
          project: unknown;
          time: number;
        }
      | undefined
    >(undefined);
  useInteractionCancel(() => {
    drag.current = undefined;
    store.setPropertyPreview(undefined);
    onClose();
  });
  const current =
      view.propertyPreview?.id === property.id
        ? view.propertyPreview.property
        : property,
    value = evaluateProperty(current, view.time) as readonly number[];
  const commit = (data: readonly number[]) => {
    store.setPropertyPreview(undefined);
    store.run(`编辑${title}`, [store.valueCommand(property.id, data)]);
  };
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewport, setViewport] = useState(() =>
    fitPath(evaluateProperty(property, view.time) as readonly number[]),
  );
  const width = viewport.width,
    height = viewport.height,
    point = (e: { clientX: number; clientY: number }) => {
      const svg = svgRef.current!,
        r = svg.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * width) / r.width + viewport.x,
        y: ((e.clientY - r.top) * height) / r.height + viewport.y,
      };
    };
  usePointerRelease({
    active: () => !!drag.current,
    move: (e) => {
      const g = drag.current;
      if (!g) return;
      g.data = movePathPoint(g.data, g.index, point(e), g.handle);
      const frame = property.keyframes.find(
        (k) => Math.abs(k.time - view.time) < 1e-8,
      );
      store.setPropertyPreview({
        id: property.id,
        property: frame
          ? {
              ...property,
              keyframes: property.keyframes.map((k) =>
                k.id === frame.id ? { ...k, value: g.data } : k,
              ),
            }
          : { ...property, baseValue: g.data, keyframes: [] },
      });
    },
    finish: (e) => {
      const g = drag.current;
      if (g) g.data = movePathPoint(g.data, g.index, point(e), g.handle);
      drag.current = undefined;
      if (
        g &&
        g.project === store.getSnapshot().project &&
        g.time === store.getSnapshot().time
      )
        commit(g.data);
      else store.setPropertyPreview(undefined);
    },
    cancel: () => {
      drag.current = undefined;
      store.setPropertyPreview(undefined);
    },
  });
  return (
    <Modal
      onClose={() => {
        store.setPropertyPreview(undefined);
        onClose();
      }}
    >
      <section
        className="graph-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="路径编辑器"
      >
        <div className="graph-heading">
          <h2>{title}编辑器</h2>
          <button
            onClick={() => {
              store.setPropertyPreview(undefined);
              onClose();
            }}
          >
            关闭路径编辑器
          </button>
        </div>
        <svg
          ref={svgRef}
          viewBox={`${viewport.x} ${viewport.y} ${width} ${height}`}
          preserveAspectRatio="none"
          style={{
            width: 600,
            maxWidth: '100%',
            height: 'auto',
            aspectRatio: '3 / 2',
          }}
          className="path-svg"
          aria-label="可编辑贝塞尔路径"
          onDoubleClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            commit(
              addPathPoint(value, {
                x: ((e.clientX - r.left) * width) / r.width + viewport.x,
                y: ((e.clientY - r.top) * height) / r.height + viewport.y,
              }),
            );
            setSelected(value.length / 6);
          }}
        >
          <path
            d={pathSvg(value, closed)}
            fill="var(--selection-overlay)"
            stroke="var(--accent-primary)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {Array.from({ length: value.length / 6 }, (_, index) => {
            const p = value.slice(index * 6, index * 6 + 6);
            return (
              <g key={index}>
                <line
                  x1={p[2]}
                  y1={p[3]}
                  x2={p[4]}
                  y2={p[5]}
                  stroke="var(--warning)"
                />
                {([1, 2, 0] as const).map((handle) => (
                  <circle
                    key={handle}
                    role="slider"
                    aria-label={`${title}点 ${index + 1} ${handle === 0 ? '位置' : handle === 1 ? '入切线' : '出切线'}`}
                    aria-valuenow={p[handle * 2]}
                    tabIndex={0}
                    cx={
                      handle &&
                      p[handle * 2] === p[0] &&
                      p[handle * 2 + 1] === p[1]
                        ? p[0]! + ((handle === 1 ? -1 : 1) * width) / 20
                        : p[handle * 2]
                    }
                    cy={p[handle * 2 + 1]}
                    r={((handle === 0 ? 5 : 4) * width) / 600}
                    stroke="transparent"
                    strokeWidth={(16 * width) / 600}
                    onDoubleClick={(e) => e.stopPropagation()}
                    fill={
                      handle === 0
                        ? selected === index
                          ? 'var(--warning)'
                          : 'var(--accent-primary)'
                        : 'var(--warning)'
                    }
                    style={{ cursor: 'move', touchAction: 'none' }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      store.setPlaying(false);
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setSelected(index);
                      setSelectedHandle(handle);
                      drag.current = {
                        index,
                        handle,
                        data: value,
                        project: view.project,
                        time: view.time,
                      };
                    }}
                    onKeyDown={(e) => {
                      if (
                        [
                          'ArrowLeft',
                          'ArrowRight',
                          'ArrowUp',
                          'ArrowDown',
                        ].includes(e.key)
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        const step = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
                        const x =
                          p[handle * 2]! +
                          (e.key === 'ArrowLeft'
                            ? -step
                            : e.key === 'ArrowRight'
                              ? step
                              : 0);
                        const y =
                          p[handle * 2 + 1]! +
                          (e.key === 'ArrowUp'
                            ? -step
                            : e.key === 'ArrowDown'
                              ? step
                              : 0);
                        commit(movePathPoint(value, index, { x, y }, handle));
                      }
                      if (e.key === 'Delete' && value.length > 6) {
                        e.preventDefault();
                        e.stopPropagation();
                        commit(removePathPoint(value, index));
                        setSelected(0);
                      }
                    }}
                  />
                ))}
              </g>
            );
          })}
        </svg>
        <div className="graph-tools">
          <button onClick={() => setViewport(fitPath(value))}>
            适应路径视图
          </button>
          <button
            onClick={() => {
              const offset = Math.min(selected, value.length / 6 - 1) * 6,
                x = value[offset]!,
                y = value[offset + 1]!;
              const dx =
                  value[offset + 4]! === x && value[offset + 5]! === y
                    ? 30
                    : value[offset + 4]! - x,
                dy = value[offset + 5]! - y;
              commit(
                value.map((v, i) =>
                  i === offset + 2
                    ? x - dx
                    : i === offset + 3
                      ? y - dy
                      : i === offset + 4
                        ? x + dx
                        : i === offset + 5
                          ? y + dy
                          : v,
                ),
              );
            }}
          >
            转换为平滑点
          </button>
          <button
            onClick={() => {
              const offset = Math.min(selected, value.length / 6 - 1) * 6;
              commit(
                value.map((v, i) =>
                  i >= offset + 2 && i < offset + 6
                    ? value[offset + (i % 2)]!
                    : v,
                ),
              );
            }}
          >
            转换为角点
          </button>
          <button
            onClick={() => {
              commit(addPathPoint(value, { x: 0, y: 0 }));
              setSelected(value.length / 6);
            }}
          >
            添加路径点
          </button>
          <button
            disabled={value.length <= 6}
            onClick={() => {
              commit(
                removePathPoint(
                  value,
                  Math.min(selected, value.length / 6 - 1),
                ),
              );
              setSelected(0);
            }}
          >
            删除路径点
          </button>
          <button onClick={() => store.togglePropertyAnimation(property.id)}>
            {property.keyframes.length ? '关闭' : '开启'}
            {title}动画
          </button>
        </div>
        <div className="field-grid">
          {(['X', 'Y'] as const).map((label, i) => (
            <NumberField
              key={label}
              revision={property}
              time={view.time}
              onPreview={(v) => {
                const offset = Math.min(selected, value.length / 6 - 1) * 6;
                const data = movePathPoint(
                  value,
                  offset / 6,
                  {
                    x: i === 0 ? v : value[offset + selectedHandle * 2]!,
                    y: i === 1 ? v : value[offset + selectedHandle * 2 + 1]!,
                  },
                  selectedHandle,
                );
                store.setPropertyPreview({
                  id: property.id,
                  property: { ...property, baseValue: data, keyframes: [] },
                });
              }}
              onCancel={() => store.setPropertyPreview(undefined)}
              label={`${title}选中${selectedHandle === 0 ? '点' : selectedHandle === 1 ? '入切线' : '出切线'} ${label}`}
              value={
                value[
                  Math.min(selected, value.length / 6 - 1) * 6 +
                    selectedHandle * 2 +
                    i
                ] ?? 0
              }
              onCommit={(v) => {
                const offset = Math.min(selected, value.length / 6 - 1) * 6;
                commit(
                  movePathPoint(
                    value,
                    offset / 6,
                    {
                      x: i === 0 ? v : value[offset + selectedHandle * 2]!,
                      y: i === 1 ? v : value[offset + selectedHandle * 2 + 1]!,
                    },
                    selectedHandle,
                  ),
                );
              }}
              onError={(m) => store.setStatus(m, true)}
            />
          ))}
        </div>
        <label className="graph-time">
          预览时间
          <input
            type="range"
            aria-label="路径预览时间"
            min={0}
            max={c.duration}
            step={1 / c.fps}
            value={view.time}
            onChange={(e) => store.setTime(Number(e.target.value))}
          />
        </label>
        <p className="inspector-note">
          双击空白处添加点；拖动蓝色点或黄色切线。角点的黄色圆点可拖出独立切线；选中后用箭头或下方
          X/Y 精确调整。路径动画在相同点数之间插值，改变点数会按保持方式切换。
        </p>
      </section>
    </Modal>
  );
}
