import type { AnimValue, Vec2 } from '../core/core-types';
import type { Property } from '../core/project-model';
import { evaluateProperty } from '../core/animation-engine';
import { newId } from '../core/core-types';
import { command } from '../core/command-system';
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
  const time = store.getSnapshot().time,
    value = evaluateProperty(property, time),
    current = property.keyframes.some((k) => Math.abs(k.time - time) < 1e-8);
  const edit = (value: AnimValue) => {
    store.setPropertyPreview(undefined);
    return store.run(`修改${label}`, [store.valueCommand(property.id, value)]);
  };
  const preview = (value: AnimValue) =>
    store.setPropertyPreview({
      id: property.id,
      property: { ...property, baseValue: value, keyframes: [] },
    });
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
  const shown =
    propertyPreview?.id === property.id
      ? evaluateProperty(propertyPreview.property, time)
      : value;
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
    <div className="animated-field">
      <div className="animated-field-heading">
        <span>{label}</span>
        {vector && (
          <AxisLinkButton label={label} linked={linked} onClick={toggle} />
        )}
        <button
          title={`${property.keyframes.length ? '关闭' : '开启'}${label}动画`}
          aria-label={`${property.keyframes.length ? '关闭' : '开启'}${label}动画`}
          onClick={() => store.togglePropertyAnimation(property.id)}
        >
          ⏱
        </button>
        <button
          title={`记录${label}关键帧`}
          aria-label={`记录${label}关键帧`}
          disabled={current}
          onClick={() =>
            store.run(`记录${label}`, [
              command({
                type: 'keyframe.add',
                propertyId: property.id,
                keyframe: {
                  id: newId(),
                  time,
                  value,
                  interpolation: { type: 'linear' },
                },
              }),
            ])
          }
        >
          ◇
        </button>
      </div>
      {typeof value === 'number' ? (
        <NumberField
          revision={property}
          time={time}
          label={`${label}${unit}`}
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
              label={`${label} ${k.toUpperCase()}${unit}`}
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
