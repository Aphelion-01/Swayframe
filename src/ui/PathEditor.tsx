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
export function PathEditor({
  store,
  property,
  title = '路径',
  onClose,
}: {
  store: EditorStore;
  property: Property<readonly number[]>;
  title?: string;
  onClose: () => void;
}) {
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot),
    c = activeComposition(view.project);
  const [selected, setSelected] = useState(0),
    drag = useRef<
      | {
          index: number;
          handle: 0 | 1 | 2;
          data: readonly number[];
          project: unknown;
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
  const width = 600,
    height = 400,
    point = (e: React.PointerEvent<SVGElement>) => {
      const svg = e.currentTarget.ownerSVGElement!,
        r = svg.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * width) / r.width - width / 2,
        y: ((e.clientY - r.top) * height) / r.height - height / 2,
      };
    };
  return (
    <div className="modal-backdrop">
      <section className="graph-dialog" aria-label="路径编辑器">
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
          viewBox="-300 -200 600 400"
          className="path-svg"
          aria-label="可编辑贝塞尔路径"
          onDoubleClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            commit(
              addPathPoint(value, {
                x: ((e.clientX - r.left) * 600) / r.width - 300,
                y: ((e.clientY - r.top) * 400) / r.height - 200,
              }),
            );
            setSelected(value.length / 6);
          }}
        >
          <path
            d={pathSvg(value, true)}
            fill="#4163ad55"
            stroke="#82b6ff"
            strokeWidth="2"
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
                  stroke="#897642"
                />
                {([1, 2, 0] as const).map((handle) => (
                  <circle
                    key={handle}
                    role="slider"
                    aria-label={`${title}点 ${index + 1} ${handle === 0 ? '位置' : handle === 1 ? '入切线' : '出切线'}`}
                    aria-valuenow={p[handle * 2]}
                    tabIndex={0}
                    cx={p[handle * 2]}
                    cy={p[handle * 2 + 1]}
                    r={handle === 0 ? 7 : 5}
                    fill={
                      handle === 0
                        ? selected === index
                          ? '#ffd25a'
                          : '#bad9ff'
                        : '#d8aa4e'
                    }
                    style={{ cursor: 'move', touchAction: 'none' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setSelected(index);
                      drag.current = {
                        index,
                        handle,
                        data: value,
                        project: view.project,
                      };
                    }}
                    onPointerMove={(e) => {
                      const g = drag.current;
                      if (!g) return;
                      g.data = movePathPoint(
                        g.data,
                        g.index,
                        point(e),
                        g.handle,
                      );
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
                    }}
                    onPointerUp={() => {
                      const g = drag.current;
                      drag.current = undefined;
                      if (g && g.project === store.getSnapshot().project)
                        commit(g.data);
                      else store.setPropertyPreview(undefined);
                    }}
                    onPointerCancel={() => {
                      drag.current = undefined;
                      store.setPropertyPreview(undefined);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Delete' && value.length > 6) {
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
                const data = movePathPoint(value, offset / 6, {
                  x: i === 0 ? v : value[offset]!,
                  y: i === 1 ? v : value[offset + 1]!,
                });
                store.setPropertyPreview({
                  id: property.id,
                  property: { ...property, baseValue: data, keyframes: [] },
                });
              }}
              onCancel={() => store.setPropertyPreview(undefined)}
              label={`${title}选中点 ${label}`}
              value={
                value[Math.min(selected, value.length / 6 - 1) * 6 + i] ?? 0
              }
              onCommit={(v) => {
                const offset = Math.min(selected, value.length / 6 - 1) * 6;
                commit(
                  movePathPoint(value, offset / 6, {
                    x: i === 0 ? v : value[offset]!,
                    y: i === 1 ? v : value[offset + 1]!,
                  }),
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
          双击空白处添加点；拖动蓝色点或黄色切线。路径动画在相同点数之间插值，改变点数会按保持方式切换。
        </p>
      </section>
    </div>
  );
}
