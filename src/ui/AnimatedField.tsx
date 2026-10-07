import { guidanceFor } from './transform-guidance-controller';
import type { GuideProperty } from '../core/transform-guidance';
import { transformPropertyEdit } from './transform-property-edit';
import { Icon } from './workspace/icons';
import type { AnimValue, Vec2 } from '../core/core-types';
import type { Property } from '../core/project-model';
import { evaluateProperty } from '../core/animation-engine';
import { activeComposition } from '../core/project-model';
import { NumberField, TextField } from './fields';
import type { EditorStore } from './editor-store';
import { AxisLinkButton, linkedAxisValues, useAxisLink } from './axis-link';
import type { AxisLinkMode } from './axis-link';
export function AnimatedField({
  store,
  property,
  label,
  min,
  max,
  color = false,
  factor = 1,
  unit = '',
  linkMode = 'offset',
}: {
  store: EditorStore;
  property: Property<AnimValue>;
  label: string;
  min?: number;
  max?: number;
  color?: boolean;
  factor?: number;
  unit?: string;
  linkMode?: AxisLinkMode;
}) {
  const { linked, toggle } = useAxisLink(property.id);
  const guideKind = (
    {
      位置: 'position',
      缩放: 'scale',
      旋转: 'rotation',
      锚点: 'anchor',
    } as Record<string, GuideProperty>
  )[label];
  const controller = guidanceFor(store);
  const activity = (target: EventTarget | null, phase: 'hover' | 'active') => {
    if (!guideKind) return;
    const name =
      target instanceof Element
        ? (target.getAttribute('aria-label') ?? '')
        : '';
    const axis = name.includes(' X')
      ? 'x'
      : name.includes(' Y')
        ? 'y'
        : undefined;
    controller.activate({
      property: guideKind,
      axis: vector && linked ? undefined : axis,
      phase,
    });
  };

  const time = store.getSnapshot().time,
    value = evaluateProperty(property, time),
    current = property.keyframes.some((k) => Math.abs(k.time - time) < 1e-8);
  const edit = (value: AnimValue) => {
    if (transformPropertyEdit(store, property.id, value, true)) return;
    store.setPropertyPreview(undefined);
    const selected = activeComposition(
      store.getSnapshot().project,
    ).layers.filter(
      (l) => store.getSnapshot().selection.includes(l.id) && !l.locked,
    );
    if (selected.length > 1 && (label === '位置' || label === '透明度')) {
      const before = evaluateProperty(property, time);
      return store.run(
        `修改${label}`,
        selected.map((l) => {
          const p =
            label === '位置' ? l.transform.position : l.transform.opacity;
          const old = evaluateProperty(p as Property<AnimValue>, time);
          const next =
            label === '位置'
              ? {
                  x: (old as Vec2).x + (value as Vec2).x - (before as Vec2).x,
                  y: (old as Vec2).y + (value as Vec2).y - (before as Vec2).y,
                }
              : value;
          return store.valueCommand(p.id, next);
        }),
      );
    }
    return store.run(`修改${label}`, [store.valueCommand(property.id, value)]);
  };
  const preview = (value: AnimValue) => {
    if (transformPropertyEdit(store, property.id, value, false)) return;
    store.setPropertyPreview({
      id: property.id,
      property: { ...property, baseValue: value, keyframes: [] },
    });
  };
  const cancel = () => store.setPropertyPreview(undefined);
  const vector =
    !color &&
    typeof value !== 'number' &&
    (!Array.isArray(value) || value.length === 2 || value.length === 3);
  const updateAxis = (index: number, next: number): AnimValue => {
    const values = Array.isArray(value)
      ? value
      : [(value as Vec2).x, (value as Vec2).y];
    const result = linkedAxisValues(
      values,
      index,
      next,
      vector && linked,
      linkMode,
    );
    return Array.isArray(value) ? result : { x: result[0]!, y: result[1]! };
  };
  const propertyPreview = store.getSnapshot().propertyPreview;
  const viewNow = store.getSnapshot();
  const positionLayer = activeComposition(viewNow.project).layers.find(
    (layer) => layer.transform.position.id === property.id,
  );
  const moving = positionLayer
    ? viewNow.preview?.layerId === positionLayer.id
      ? viewNow.preview
      : viewNow.preview?.others?.find((p) => p.layerId === positionLayer.id)
    : undefined;
  const shown =
    moving?.position ??
    (propertyPreview?.id === property.id
      ? evaluateProperty(propertyPreview.property, time)
      : store.getSnapshot().propertyPreviews?.find((p) => p.id === property.id)
        ? evaluateProperty(
            store
              .getSnapshot()
              .propertyPreviews!.find((p) => p.id === property.id)!,
            time,
          )
        : value);
  const mixed = (axis?: 'x' | 'y') => {
    const view = store.getSnapshot();
    const key = (
      {
        位置: 'position',
        缩放: 'scale',
        旋转: 'rotation',
        透明度: 'opacity',
      } as const
    )[label as '位置'];
    if (!key || view.selection.length < 2) return false;
    const vals = activeComposition(view.project)
      .layers.filter((l) => view.selection.includes(l.id))
      .map((layer) => {
        const p = layer.transform[key];
        const preview = view.propertyPreviews?.find((v) => v.id === p.id);
        const moving =
          key === 'position'
            ? view.preview?.layerId === layer.id
              ? view.preview
              : view.preview?.others?.find((v) => v.layerId === layer.id)
            : undefined;
        const v = moving?.position ?? evaluateProperty(preview ?? p, time);
        return axis ? (v as Vec2)[axis] : v;
      });
    return vals.some((v) => v !== vals[0]);
  };
  const hex = (a: readonly number[]) =>
    '#' +
    a
      .slice(0, 3)
      .map((v) =>
        Math.round(Math.max(0, Math.min(1, v)) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  return (
    <div
      onMouseOver={(event) => {
        if (controller.getSnapshot().activity?.phase !== 'active')
          activity(event.target, 'hover');
      }}
      onMouseLeave={() => {
        if (controller.getSnapshot().activity?.phase !== 'active')
          controller.activate();
      }}
      onFocusCapture={(event) => activity(event.target, 'active')}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          controller.activate();
      }}
      onPointerDownCapture={(event) => activity(event.target, 'active')}
      onPointerUpCapture={(event) => activity(event.target, 'hover')}
      className="animated-field"
      data-kind={typeof value === 'number' ? 'scalar' : 'vector'}
    >
      <div className="animated-field-heading">
        <span>
          {label}
          <small className="property-unit">{unit.replace(/[（）]/g, '')}</small>
        </span>
        <div className="property-actions">
          {vector && (
            <AxisLinkButton label={label} linked={linked} onClick={toggle} />
          )}
          <button
            aria-pressed={!!property.keyframes.length}
            title={`${property.keyframes.length ? '关闭' : '开启'}${label}动画`}
            aria-label={`${property.keyframes.length ? '关闭' : '开启'}${label}动画`}
            onClick={() => store.togglePropertyAnimation(property.id)}
          >
            <Icon name="clock" />
          </button>
          <button
            title={`记录${label}关键帧`}
            aria-label={`记录${label}关键帧`}
            disabled={current}
            onClick={() => store.recordPropertyKeyframe(property.id)}
          >
            <Icon name="diamond" />
          </button>
        </div>
      </div>
      {typeof value === 'number' ? (
        <NumberField
          revision={property}
          time={time}
          label={`${label}${unit}`}
          mixed={mixed()}
          value={value * factor}
          previewValue={typeof shown === 'number' ? shown * factor : undefined}
          min={min}
          max={max}
          onPreview={(n) => preview(n / factor)}
          onCancel={cancel}
          onCommit={(n) => edit(n / factor)}
          onError={(m) => store.setStatus(m, true)}
        />
      ) : Array.isArray(value) ? (
        color ? (
          <div>
            {' '}
            <input
              type="color"
              aria-label={label}
              value={hex(value)}
              onChange={(e) => {
                const h = e.target.value.slice(1);
                edit([
                  parseInt(h.slice(0, 2), 16) / 255,
                  parseInt(h.slice(2, 4), 16) / 255,
                  parseInt(h.slice(4, 6), 16) / 255,
                  value[3] ?? 1,
                ]);
              }}
            />
            <TextField
              label={`${label} HEX`}
              value={hex(value)}
              onCommit={(h) => {
                if (!/^#[0-9a-f]{6}$/i.test(h)) {
                  store.setStatus('请输入 #RRGGBB 颜色', true);
                  return;
                }
                edit([
                  parseInt(h.slice(1, 3), 16) / 255,
                  parseInt(h.slice(3, 5), 16) / 255,
                  parseInt(h.slice(5, 7), 16) / 255,
                  value[3] ?? 1,
                ]);
              }}
            />
          </div>
        ) : (
          <div className="field-grid">
            {value.map((v, i) => (
              <NumberField
                revision={property}
                time={time}
                key={i}
                compactLabel={['X', 'Y', 'Z', 'A'][i] ?? String(i + 1)}
                label={`${label} ${['X', 'Y', 'Z', 'A'][i] ?? i + 1}${unit}`}
                value={v * factor}
                previewValue={
                  Array.isArray(shown) ? shown[i]! * factor : undefined
                }
                min={min}
                max={max}
                onPreview={(n) => preview(updateAxis(i, n / factor))}
                onCancel={cancel}
                onCommit={(n) => edit(updateAxis(i, n / factor))}
                onError={(m) => store.setStatus(m, true)}
              />
            ))}
          </div>
        )
      ) : (
        <div className="field-grid">
          {(['x', 'y'] as const).map((k) => (
            <NumberField
              revision={property}
              time={time}
              key={k}
              compactLabel={k.toUpperCase()}
              label={`${label} ${k.toUpperCase()}${unit}`}
              mixed={mixed(k)}
              value={(value as Vec2)[k] * factor}
              previewValue={(shown as Vec2)[k] * factor}
              onPreview={(n) =>
                preview(updateAxis(k === 'x' ? 0 : 1, n / factor))
              }
              onCancel={cancel}
              onCommit={(n) => edit(updateAxis(k === 'x' ? 0 : 1, n / factor))}
              onError={(m) => store.setStatus(m, true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
