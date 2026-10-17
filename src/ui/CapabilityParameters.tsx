import type { AnimValue } from '../core/core-types';
import type { Property } from '../core/project-model';
import type { ParameterDefinition } from '../core/visual-capabilities';
import { evaluateProperty } from '../core/animation-engine';
import { AnimatedField } from './AnimatedField';
import { NumberField } from './fields';
import type { EditorStore } from './editor-store';
import { Icon } from './workspace/icons';
export function CapabilityParameters({
  store,
  parameters,
  properties,
  prefix = '',
}: {
  store: EditorStore;
  parameters: readonly ParameterDefinition[];
  properties: Readonly<Record<string, Property<AnimValue>>>;
  prefix?: string;
}) {
  return (
    <>
      {parameters.map((spec) => {
        const property = properties[spec.id];
        if (!property) return null;
        const label = prefix + spec.name,
          value = evaluateProperty(property, store.getSnapshot().time);
        const commit = (v: AnimValue) =>
          store.run('修改' + label, [store.valueCommand(property.id, v)]);
        if (spec.type === 'gradientStops') {
          const stops = value as readonly number[],
            preview = store.getSnapshot().propertyPreview;
          const shown =
            preview?.id === property.id
              ? (evaluateProperty(
                  preview.property,
                  store.getSnapshot().time,
                ) as readonly number[])
              : stops;
          const update = (index: number, n: number, live = false) => {
            const next = [...stops];
            next[index] = n;
            if (
              index % 5 === 0 &&
              ((index > 0 && n < next[index - 5]!) ||
                (index + 5 < next.length && n > next[index + 5]!))
            )
              return;
            if (live)
              store.setPropertyPreview({
                id: property.id,
                property: { ...property, baseValue: next, keyframes: [] },
              });
            else {
              store.setPropertyPreview(undefined);
              commit(next);
            }
          };
          return (
            <details key={spec.id} open>
              <summary>{label}</summary>
              <div className="property-actions">
                <button
                  aria-label="切换色标动画"
                  title="切换色标动画"
                  aria-pressed={!!property.keyframes.length}
                  onClick={() => store.togglePropertyAnimation(property.id)}
                >
                  <Icon name="clock" />
                </button>
                <button
                  aria-label="记录色标关键帧"
                  title="记录色标关键帧"
                  onClick={() => store.recordPropertyKeyframe(property.id)}
                >
                  <Icon name="diamond" />
                </button>
              </div>
              {Array.from({ length: stops.length / 5 }, (_, i) => (
                <div className="feature-card capability-gradient-stop" key={i}>
                  <span>色标 {i + 1}</span>
                  {['位置', '红', '绿', '蓝', '透明度'].map((part, k) => (
                    <NumberField
                      key={k}
                      label={`${label}${i + 1}${part}`}
                      compactLabel={part}
                      step={0.01}
                      value={stops[i * 5 + k]!}
                      previewValue={shown[i * 5 + k]}
                      min={0}
                      max={1}
                      revision={property}
                      time={store.getSnapshot().time}
                      onPreview={(n) => update(i * 5 + k, n, true)}
                      onCancel={() => store.setPropertyPreview(undefined)}
                      onCommit={(n) => update(i * 5 + k, n)}
                      onError={(m) => store.setStatus(m, true)}
                    />
                  ))}
                  <button
                    disabled={stops.length <= 10}
                    onClick={() =>
                      commit(stops.filter((_, j) => Math.floor(j / 5) !== i))
                    }
                  >
                    移除色标
                  </button>
                </div>
              ))}
              <button
                disabled={stops.length >= 160}
                onClick={() => {
                  const next = [...stops];
                  next.splice(
                    5,
                    0,
                    (stops[0]! + stops[5]!) / 2,
                    ...stops.slice(1, 5),
                  );
                  commit(next);
                }}
              >
                添加色标
              </button>
            </details>
          );
        }
        if (spec.type === 'enum' || spec.type === 'boolean')
          return (
            <div key={spec.id}>
              <label className="field">
                {label}
                <select
                  aria-label={label}
                  value={Number(value)}
                  onChange={(e) => commit(Number(e.target.value))}
                >
                  {(spec.options ?? ['关闭', '开启']).map((name, i) => (
                    <option key={i} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={() => store.recordPropertyKeyframe(property.id)}>
                记录{label}关键帧
              </button>
            </div>
          );
        return (
          <AnimatedField
            key={property.id}
            store={store}
            property={property}
            label={label}
            min={spec.min}
            max={spec.max}
            color={spec.type === 'color'}
            defaultLinked={false}
            integer={spec.type === 'integer'}
            step={
              spec.step ??
              (['vec2', 'vec3'].includes(spec.type) ||
              (spec.max ?? Infinity) <= 10
                ? 0.01
                : 1)
            }
            unit={spec.unit}
          />
        );
      })}
    </>
  );
}
