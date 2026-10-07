import { contextKeys } from './workspace/context-keys';
import { features } from '../shared/feature-catalog';
import { useCommandScope } from './workspace/scoped-commands';
import {
  editorCommands,
  editorContributions,
  contributionItems,
} from './workspace/feature-contributions';
import type { CommandBinding } from './workspace/command-registry';
import { command } from '../core/command-system';
import { usePointerRelease } from './workspace/pointer-release';
import { ContextMenu, Modal, IconButton } from './workspace/primitives';
import { dispatchShortcut } from './workspace/shortcuts';
import { useInteractionCancel } from './workspace/interaction';
import {
  applyMotionCurveCommands,
  previewMotionCurve,
} from '../core/motion-curve-commands';
import { SpatialMotionEditor } from './SpatialMotionEditor';
import { useEffect, useRef, useState } from 'react';
import { useSvgMetrics } from './workspace/use-svg-metrics';
import { CurveWorkspace } from './workspace/CurveWorkspace';
import { Icon } from './workspace/icons';
import { useEditorSlice } from './use-editor-slice';
import type { Vec2, AnimValue } from '../core/core-types';
import type { Property } from '../core/project-model';
import { activeComposition } from '../core/project-model';
import {
  controlsFromSpeed,
  easePresets,
  sampleCurve,
  segmentControls,
  speedsFromControls,
  valueComponent,
  spatialEndpointDistances,
  propertySpeedUnit,
  components,
} from '../core/curve-model';
import { visibleProperties, propertyLabel } from './property-labels';
import { NumberField } from './fields';
import type { EditorStore } from './editor-store';

export function GraphEditor({
  store,
  onClose,
  embedded = false,
  loop = true,
  onLoopChange,
}: {
  store: EditorStore;
  onClose: () => void;
  embedded?: boolean;
  loop?: boolean;
  onLoopChange?: (loop: boolean) => void;
}) {
  const view = useEditorSlice(store, [
      'project',
      'selection',
      'selectedProperties',
      'frames',
      'time',
      'playing',
      'propertyPreview',
      'propertyPreviews',
    ]),
    c = activeComposition(view.project),
    layer =
      c.layers.find((l) =>
        visibleProperties(l).some(
          (e) => e.property.id === view.selectedProperties[0],
        ),
      ) ?? c.layers.find((l) => l.id === view.selection[0]);
  const entries = layer ? visibleProperties(layer) : [];
  const [chosen, setChosen] = useState(''),
    [mode, setMode] = useState<'value' | 'speed'>('value'),
    [component, setComponent] = useState(0),
    [segmentId, setSegmentId] = useState('');
  const [focus, setFocus] = useState<
    'key' | 'segment' | 'out' | 'in' | undefined
  >();
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    type: 'key' | 'segment';
  }>();
  const gesture = useRef<
    | {
        which: 'out' | 'in';
        controls: { out: Vec2; in: Vec2 };
        project: unknown;
        key: string;
        domain: { start: number; end: number; min: number; max: number };
      }
    | undefined
  >(undefined);
  const {
    ref: svgRef,
    size: svgSize,
    measure: measureSvg,
  } = useSvgMetrics(680, 280);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const space = useRef(false);
  const panUsed = useRef(false);
  const [grabbing, setGrabbing] = useState(false);
  const pan = useRef<
    | {
        x: number;
        y: number;
        width: number;
        height: number;
        view: typeof viewport;
      }
    | undefined
  >(undefined);
  const zoomAt = (factor: number, x = 340, y = 140) => {
    setViewport((v) => {
      const zoom = Math.max(0.5, Math.min(8, v.zoom * factor));
      return {
        x: v.x + x / v.zoom - x / zoom,
        y: v.y + y / v.zoom - y / zoom,
        zoom,
      };
    });
  };
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      if (gesture.current || pan.current) return;
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (event.shiftKey) {
        setViewport((v) => ({ ...v, x: v.x + event.deltaY / v.zoom }));
        return;
      }
      zoomAt(
        Math.exp(-event.deltaY * 0.002),
        ((event.clientX - rect.left) / rect.width) * 680,
        ((event.clientY - rect.top) / rect.height) * 280,
      );
    };
    const release = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        if (
          space.current &&
          !panUsed.current &&
          !(e.target as Element)?.closest?.('input,textarea,select')
        )
          store.setPlaying(!store.getSnapshot().playing);
        space.current = false;
        setGrabbing(false);
      }
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keyup', release);
    return () => {
      svg.removeEventListener('wheel', wheel);
      window.removeEventListener('keyup', release);
    };
  }, [store, view.project, view.selection, view.selectedProperties]);
  useInteractionCancel(() => {
    gesture.current = undefined;
    if (pan.current) setViewport(pan.current.view);
    pan.current = undefined;
    space.current = false;
    setGrabbing(false);
    store.setPropertyPreviews(undefined);
  });
  const domainRef = useRef<
    { key: string; min: number; max: number } | undefined
  >(undefined);
  const fitCurve = () => {
    domainRef.current = undefined;
    setViewport({ x: 0, y: 0, zoom: 1 });
  };
  const pointerHandlers = useRef<{
    move: (event: PointerEvent) => void;
    finish: () => void;
  }>({
    move: () => {},
    finish: () => {},
  });
  usePointerRelease({
    active: () => !!gesture.current,
    move: (e) => pointerHandlers.current.move(e),
    finish: () => pointerHandlers.current.finish(),
    cancel: () => {
      gesture.current = undefined;
      store.setPropertyPreviews(undefined);
    },
  });
  const entry =
    entries.find(
      (e) =>
        e.property.id === chosen &&
        (!view.selectedProperties.length ||
          view.selectedProperties.includes(chosen)),
    ) ??
    entries.find((e) => e.property.id === view.selectedProperties[0]) ??
    entries.find((e) => e.property.id === view.frames[0]?.propertyId) ??
    entries.find((e) => e.property.keyframes.length > 0);
  const curveBindings = useRef<readonly CommandBinding[]>([]);
  curveBindings.current = [];
  useCommandScope(store, () => curveBindings.current);
  if (!entry)
    return (
      <GraphFrame embedded={embedded} onClose={onClose} empty>
        <section className="graph-empty" aria-label="曲线编辑器">
          <p>选择一个已动画属性以编辑曲线</p>
          <small>在时间轴选择属性，或先为属性开启动画。</small>
          <IconButton label="返回时间轴" onClick={onClose}>
            <Icon name="undo" />
          </IconButton>
        </section>
      </GraphFrame>
    );
  const pixelX = 680 / (svgSize.width * viewport.zoom),
    pixelY = 280 / (svgSize.height * viewport.zoom);
  const original = entry.property,
    p: Property<AnimValue> =
      view.propertyPreview?.id === original.id
        ? view.propertyPreview.property
        : (view.propertyPreviews?.find((v) => v.id === original.id) ??
          original);
  const frames = [...p.keyframes].sort((a, b) => a.time - b.time),
    candidate =
      frames.find((k) => k.id === segmentId) ??
      frames.find((k) => k.id === view.frames[0]?.keyframeId) ??
      frames[0],
    index = candidate
      ? Math.max(0, Math.min(frames.indexOf(candidate), frames.length - 2))
      : 0,
    left = frames[index],
    right = frames[index + 1];
  const domainKey = `${original.id}/${left?.id}/${right?.id}/${mode}/${component}`;
  const fixedDomain =
    domainRef.current?.key === domainKey ? domainRef.current : undefined;
  const start = frames[0]?.time ?? 0,
    end = Math.max(start + 1 / c.fps, frames.at(-1)?.time ?? c.duration);
  const unit = propertySpeedUnit(entry.key),
    factor = mode === 'speed' ? unit.factor : 1;
  const samples = sampleCurve(p, start, end, mode, component).map((s) => ({
      ...s,
      value: s.value * factor,
    })),
    vals = samples.map((v) => v.value),
    rawMin = Math.min(...vals),
    rawMax = Math.max(...vals),
    padding =
      rawMax > rawMin
        ? (rawMax - rawMin) * 0.15
        : Math.max(0.001, Math.abs(rawMin) * 0.001),
    min = fixedDomain?.min ?? rawMin - padding,
    max = fixedDomain?.max ?? rawMax + padding;
  const tickPrecision = Math.max(
    1,
    Math.min(6, Math.ceil(-Math.log10((max - min) / 4))),
  );
  const X = (t: number) => 50 + ((t - start) / (end - start)) * 580,
    Y = (v: number) => 235 - ((v - min) / (max - min)) * 205;
  const path = samples
    .map(
      (v, i) =>
        `${i ? 'L' : 'M'}${X(v.time).toFixed(2)},${Y(v.value).toFixed(2)}`,
    )
    .join(' ');
  const controls = left
    ? segmentControls(left, right)
    : { out: { x: 0.33, y: 0.33 }, in: { x: 0.67, y: 0.67 } };
  const apply = (
    ctrl: { out: Vec2; in: Vec2 },
    from = left,
    to = right,
    preview = false,
  ) => {
    if (!from || !to || layer?.locked) return;
    if (preview) {
      store.setPropertyPreviews(
        previewMotionCurve(
          view.project,
          [`${original.id}/${from.id}/${to.id}`],
          {
            type: 'cubic-bezier',
            x1: ctrl.out.x,
            y1: ctrl.out.y,
            x2: ctrl.in.x,
            y2: ctrl.in.y,
          },
        ),
      );
      return;
    }
    store.setPropertyPreviews(undefined);
    try {
      store.run(
        '修改动画曲线',
        applyMotionCurveCommands(
          view.project,
          [`${original.id}/${from.id}/${to.id}`],
          {
            type: 'cubic-bezier',
            x1: ctrl.out.x,
            y1: ctrl.out.y,
            x2: ctrl.in.x,
            y2: ctrl.in.y,
          },
        ),
      );
    } catch (e) {
      store.setStatus(e instanceof Error ? e.message : '曲线无效', true);
    }
  };
  const handlePoint = (which: 'out' | 'in') => {
    if (!left || !right) return { x: 0, y: 0 };
    const pt = controls[which],
      time = left.time + (right.time - left.time) * pt.x;
    let value =
      valueComponent(left.value, component) +
      (valueComponent(right.value, component) -
        valueComponent(left.value, component)) *
        pt.y;
    if (mode === 'speed') {
      const s = speedsFromControls(left, right);
      value = Math.abs(which === 'out' ? s.outSpeed : s.inSpeed) * factor;
    }
    return { x: X(time), y: Y(value) };
  };
  const speed = left && right ? speedsFromControls(left, right) : undefined;
  const selectedKey = frames.find((k) =>
    view.frames.some((r) => r.propertyId === p.id && r.keyframeId === k.id),
  );
  const selectedIndex = selectedKey ? frames.indexOf(selectedKey) : -1;
  const keyContext =
    selectedKey && focus !== 'segment' && focus !== 'out' && focus !== 'in';
  const pairFor = (field: string) => {
    if (!keyContext) return [left, right] as const;
    return field.startsWith('in')
      ? ([frames[selectedIndex - 1], selectedKey] as const)
      : ([selectedKey, frames[selectedIndex + 1]] as const);
  };
  const editSpeed = (
    field: 'outSpeed' | 'inSpeed' | 'outInfluence' | 'inInfluence',
    value: number,
    preview = false,
  ) => {
    const [from, to] = pairFor(field);
    if (!from || !to || layer?.locked) return;
    const n = {
      ...speedsFromControls(from, to),
      [field]: field.includes('Speed') ? value / factor : value,
    };
    const converted = controlsFromSpeed(
      from,
      to,
      n.outInfluence,
      n.inInfluence,
      n.outSpeed,
      n.inSpeed,
    );
    const old = segmentControls(from, to);
    const ctrl = field.startsWith('out')
      ? { out: converted.out, in: old.in }
      : { out: old.out, in: converted.in };
    if (preview)
      store.setPropertyPreviews(
        previewMotionCurve(
          view.project,
          [`${original.id}/${from.id}/${to.id}`],
          {
            type: 'cubic-bezier',
            x1: ctrl.out.x,
            y1: ctrl.out.y,
            x2: ctrl.in.x,
            y2: ctrl.in.y,
          },
        ),
      );
    else apply(ctrl, from, to);
  };
  const editKey = (field: 'time' | 'value', value: number, preview = false) => {
    if (!selectedKey || layer?.locked) return;
    const nextValue =
      field === 'time'
        ? value
        : typeof selectedKey.value === 'number'
          ? value
          : Array.isArray(selectedKey.value)
            ? selectedKey.value.map((v, i) => (i === component ? value : v))
            : { ...selectedKey.value, [component === 1 ? 'y' : 'x']: value };
    const patch =
      field === 'time' ? { time: value } : { value: nextValue as AnimValue };
    if (preview)
      store.setPropertyPreview({
        id: original.id,
        property: {
          ...original,
          keyframes: original.keyframes.map((k) =>
            k.id === selectedKey.id ? { ...k, ...patch } : k,
          ),
        },
      });
    else {
      store.setPropertyPreview(undefined);
      store.run('修改曲线关键帧', [
        command({
          type: 'keyframe.update',
          propertyId: original.id,
          keyframeId: selectedKey.id,
          patch,
        }),
      ]);
    }
  };
  const fitSelected = () => {
    const selected = frames.filter((k) =>
      view.frames.some((r) => r.propertyId === p.id && r.keyframeId === k.id),
    );
    if (!selected.length) return;
    const x1 = X(selected[0]!.time),
      x2 = X(selected.at(-1)!.time);
    const ys = selected.map((k) =>
      Y(
        mode === 'value'
          ? valueComponent(k.value, component)
          : sampleCurve(p, k.time, k.time, 'speed', 0, 1)[0]!.value * factor,
      ),
    );
    const lowY = Math.min(...ys),
      highY = Math.max(...ys);
    const zoom = Math.max(
      0.5,
      Math.min(
        8,
        580 / Math.max(72, x2 - x1),
        205 / Math.max(26, highY - lowY),
      ),
    );
    const centerY = (lowY + highY) / 2;
    setViewport({
      x: (x1 + x2) / 2 - 340 / zoom,
      y: centerY - 140 / zoom,
      zoom,
    });
  };
  const presetIds: Record<string, string> = {
    linear: 'linear',
    'ease-in': 'easeIn',
    'ease-out': 'easeOut',
    'ease-both': 'easeInOut',
  };
  const presetItems = features
    .all()
    .filter((f) => f.parentId === 'interpolation' && f.id !== 'hold')
    .map((f) => [f.id, f.title] as const);
  const usePreset = (key: string) => {
    if (key === 'linear') {
      if (!left || !right || layer?.locked) return;
      store.setPropertyPreviews(undefined);
      store.run(
        '线性插值',
        applyMotionCurveCommands(
          view.project,
          [`${original.id}/${left.id}/${right.id}`],
          { type: 'linear' },
        ),
      );
    } else {
      const preset = easePresets[key]!;
      if (preset.type === 'bezier') apply(preset);
    }
  };
  curveBindings.current = [
    {
      id: 'motion.edit-segment',
      label: '编辑缓动',
      contexts: ['curvegraph'],
      disabled: !left || !right,
      action: () =>
        window.dispatchEvent(
          new CustomEvent('motion:motion-curve', {
            detail: { segmentId: `${p.id}/${left?.id}/${right?.id}` },
          }),
        ),
    },
    {
      id: 'motion.reset-segment',
      label: '重置缓动',
      contexts: ['curvegraph'],
      disabled: !left || !right || layer?.locked,
      action: () => usePreset('linear'),
    },
    ...presetItems.map(([id, label]) => ({
      id,
      label,
      contexts: ['curvegraph'] as const,
      disabled: !selectedKey || !right || layer?.locked,
      action: () => usePreset(presetIds[id]!),
    })),
    {
      id: 'hold',
      label: '保持',
      contexts: ['curvegraph'],
      disabled: !selectedKey || layer?.locked,
      action: () => {
        if (selectedKey)
          store.run('保持关键帧', [
            command({
              type: 'keyframe.update',
              propertyId: p.id,
              keyframeId: selectedKey.id,
              patch: { interpolation: { type: 'hold' } },
            }),
          ]);
      },
    },
    {
      id: 'copy-easing',
      label: '复制缓动',
      contexts: ['curvegraph'],
      disabled: !left || !right,
      action: () =>
        store.motionCurveClipboard.copy({
          type: 'cubic-bezier',
          x1: controls.out.x,
          y1: controls.out.y,
          x2: controls.in.x,
          y2: controls.in.y,
        }),
    },
    {
      id: 'paste-easing',
      label: '粘贴缓动',
      contexts: ['curvegraph'],
      disabled:
        !left || !right || !store.motionCurveClipboard.read() || layer?.locked,
      action: () => {
        const curve = store.motionCurveClipboard.read();
        if (curve && left && right)
          store.run(
            '粘贴缓动',
            applyMotionCurveCommands(
              view.project,
              [`${original.id}/${left.id}/${right.id}`],
              curve,
            ),
          );
      },
    },
  ];
  const curveCommands = () => editorCommands(store, {}, () => 'curvegraph');
  const selectSegmentAt = (clientX: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const time =
      start +
      ((viewport.x +
        ((clientX - rect.left) * 680) /
          Math.max(1, rect.width) /
          viewport.zoom -
        50) /
        580) *
        (end - start);
    setSegmentId(
      (
        frames.find(
          (k, i) =>
            i < frames.length - 1 &&
            k.time <= time &&
            frames[i + 1]!.time >= time,
        ) ?? left
      )?.id ?? '',
    );
    setFocus('segment');
  };
  const curveKey = domainKey;
  const endGesture = () => {
    const g = gesture.current;
    gesture.current = undefined;
    if (g && g.project === store.getSnapshot().project && g.key === curveKey)
      apply(g.controls);
    else store.setPropertyPreviews(undefined);
  };
  pointerHandlers.current = {
    finish: endGesture,
    move: (e) => {
      const g = gesture.current;
      const which = g?.which;
      if (!g || !which || !left || !right) return;
      if (g.project !== view.project || g.key !== curveKey) {
        gesture.current = undefined;
        store.setPropertyPreviews(undefined);
        return;
      }
      const svg = svgRef.current!,
        rect = svg.getBoundingClientRect(),
        x =
          viewport.x +
          ((e.clientX - rect.left) * 680) /
            Math.max(1, rect.width) /
            viewport.zoom,
        y =
          viewport.y +
          ((e.clientY - rect.top) * 280) /
            Math.max(1, rect.height) /
            viewport.zoom,
        time =
          g.domain.start + ((x - 50) / 580) * (g.domain.end - g.domain.start),
        val = g.domain.min + ((235 - y) / 205) * (g.domain.max - g.domain.min),
        duration = right.time - left.time;
      const px = Math.max(
        0.001,
        Math.min(0.999, (time - left.time) / duration),
      );
      let py = 0;
      if (mode === 'value') {
        const delta =
          valueComponent(right.value, component) -
          valueComponent(left.value, component);
        py = delta
          ? (val - valueComponent(left.value, component)) / delta
          : which === 'out'
            ? 0
            : 1;
      } else {
        const delta = spatialEndpointDistances(left, right)[which];
        const direction =
          Math.sign(which === 'out' ? speed!.outVelocity : speed!.inVelocity) ||
          1;
        py =
          which === 'out'
            ? delta
              ? ((Math.max(0, val) / factor) * direction * duration * px) /
                delta
              : 0
            : delta
              ? 1 -
                ((Math.max(0, val) / factor) *
                  direction *
                  duration *
                  (1 - px)) /
                  delta
              : 1;
      }
      const ctrl = {
        ...g.controls,
        [which]: { x: px, y: Math.max(-10, Math.min(10, py)) },
      };
      g.controls = ctrl;
      store.setPropertyPreviews(
        previewMotionCurve(
          view.project,
          [`${original.id}/${left.id}/${right.id}`],
          {
            type: 'cubic-bezier',
            x1: ctrl.out.x,
            y1: ctrl.out.y,
            x2: ctrl.in.x,
            y2: ctrl.in.y,
          },
        ),
      );
    },
  };
  return (
    <GraphFrame embedded={embedded} onClose={onClose}>
      <section
        className="graph-dialog"
        aria-label="曲线编辑器"
        tabIndex={0}
        onKeyDown={(e) => {
          if (
            e.code === 'Space' &&
            !(e.target as Element).closest('input,textarea,select')
          )
            e.stopPropagation();
          if (
            dispatchShortcut(e.nativeEvent, [
              ...['1', '2'].map((key) => ({
                id: `graph-mode-${key}`,
                label: key === '1' ? '值曲线' : '速度曲线',
                key,
                contexts: ['curvegraph'] as const,
                action: () => {
                  setMode(key === '1' ? 'value' : 'speed');
                  fitCurve();
                },
              })),
              {
                id: 'curve-pan',
                label: '曲线平移',
                key: 'space',
                contexts: ['curvegraph'],
                action: () => {
                  panUsed.current = false;
                  space.current = true;
                  setGrabbing(true);
                },
              },
              ...['f', 'home'].map((key) => ({
                id: `curve-fit-${key}`,
                label: '适应曲线视图',
                key,
                contexts: ['curvegraph'] as const,
                action: fitCurve,
              })),
              ...['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].map(
                (key) => ({
                  id: `curve-pan-${key}`,
                  label: '曲线视图移动',
                  key,
                  contexts: ['curvegraph'] as const,
                  action: () =>
                    setViewport((v) => ({
                      ...v,
                      x:
                        v.x +
                        (key === 'arrowleft'
                          ? -20
                          : key === 'arrowright'
                            ? 20
                            : 0) /
                          v.zoom,
                      y:
                        v.y +
                        (key === 'arrowup'
                          ? -20
                          : key === 'arrowdown'
                            ? 20
                            : 0) /
                          v.zoom,
                    })),
                }),
              ),
            ])
          )
            e.preventDefault();
        }}
      >
        <CurveWorkspace
          toolbar={
            <>
              <IconButton
                label="返回时间轴"
                onClick={() => {
                  store.setPropertyPreviews(undefined);
                  onClose();
                }}
              >
                <Icon name="undo" />
              </IconButton>
              <select
                aria-label="曲线属性"
                value={entry.property.id}
                onChange={(e) => {
                  store.selectProperties([e.target.value]);
                  setChosen(e.target.value);
                  setSegmentId('');
                  setComponent(0);
                  setFocus(undefined);
                  fitCurve();
                }}
              >
                {entries.map((e) => (
                  <option key={e.property.id} value={e.property.id}>
                    {propertyLabel(e.key, layer)}
                  </option>
                ))}
              </select>
              {mode === 'value' && components(p.baseValue).length > 1 && (
                <select
                  aria-label="曲线分量"
                  value={component}
                  onChange={(e) => {
                    setComponent(Number(e.target.value));
                    fitCurve();
                  }}
                >
                  {components(p.baseValue).map((_, i) => (
                    <option key={i} value={i}>
                      {(entry.key.includes('fill') ||
                      entry.key.includes('color')
                        ? ['R', 'G', 'B', 'A']
                        : ['X', 'Y', 'Z'])[i] ?? '值'}
                    </option>
                  ))}
                </select>
              )}
              <div
                className="curve-segmented"
                role="group"
                aria-label="曲线模式"
              >
                {(['value', 'speed'] as const).map((m) => (
                  <button
                    key={m}
                    aria-pressed={mode === m}
                    onClick={() => {
                      setMode(m);
                      fitCurve();
                    }}
                  >
                    {m === 'value' ? '值曲线' : '速度曲线'}
                  </button>
                ))}
              </div>
              <div className="curve-ease" role="group" aria-label="插值">
                {presetItems.map(([key, label]) => (
                  <button
                    key={key}
                    disabled={!selectedKey || !right || layer?.locked}
                    onClick={() => curveCommands().execute(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <IconButton label="适应曲线视图" shortcut="F" onClick={fitCurve}>
                <Icon name="fit" />
              </IconButton>
              <IconButton
                label="重置曲线视图"
                onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
              >
                <Icon name="undo" />
              </IconButton>
            </>
          }
          inspector={
            <>
              <strong>
                {keyContext
                  ? '关键帧'
                  : focus === 'in'
                    ? '入切线'
                    : focus === 'out'
                      ? '出切线'
                      : focus === 'segment'
                        ? '动画区间'
                        : '图表设置'}
              </strong>
              <small>
                {propertyLabel(entry.key, layer)} ·{' '}
                {mode === 'speed' ? unit.label : '属性值'}
              </small>
              <fieldset
                className="curve-inspector-editable"
                disabled={layer?.locked}
              >
                {keyContext && (
                  <>
                    <NumberField
                      label="关键帧时间（秒）"
                      value={selectedKey.time}
                      min={0}
                      max={c.duration}
                      step={1 / c.fps}
                      revision={original}
                      time={view.time}
                      onPreview={(v) => editKey('time', v, true)}
                      onCancel={() => store.setPropertyPreview(undefined)}
                      onCommit={(v) => editKey('time', v)}
                      onError={(m) => store.setStatus(m, true)}
                    />
                    <NumberField
                      label="关键帧数值"
                      value={valueComponent(selectedKey.value, component)}
                      revision={original}
                      time={view.time}
                      onPreview={(v) => editKey('value', v, true)}
                      onCancel={() => store.setPropertyPreview(undefined)}
                      onCommit={(v) => editKey('value', v)}
                      onError={(m) => store.setStatus(m, true)}
                    />
                    <small>插值 · {selectedKey.interpolation.type}</small>
                  </>
                )}
                {(keyContext || focus) && right && (
                  <div className="graph-fields">
                    {(
                      [
                        'outInfluence',
                        'inInfluence',
                        'outSpeed',
                        'inSpeed',
                      ] as const
                    ).map((field) => {
                      const side = field.startsWith('out') ? 'out' : 'in';
                      if ((focus === 'out' || focus === 'in') && focus !== side)
                        return null;
                      const [from, to] = pairFor(field);
                      if (!from || !to) return null;
                      const data = speedsFromControls(from, to);
                      const label = {
                        outInfluence: '出影响比例（%）',
                        inInfluence: '入影响比例（%）',
                        outSpeed: '出速度',
                        inSpeed: '入速度',
                      }[field];
                      return (
                        <NumberField
                          key={field}
                          label={label}
                          revision={original}
                          time={view.time}
                          value={
                            data[field] * (field.includes('Speed') ? factor : 1)
                          }
                          min={field.includes('Influence') ? 0.1 : 0}
                          max={field.includes('Influence') ? 100 : undefined}
                          onPreview={(v) => editSpeed(field, v, true)}
                          onCancel={() => store.setPropertyPreviews(undefined)}
                          onCommit={(v) => editSpeed(field, v)}
                          onError={(m) => store.setStatus(m, true)}
                        />
                      );
                    })}
                  </div>
                )}
                {focus === 'segment' && left && right && (
                  <div className="graph-fields">
                    {(['x1', 'y1', 'x2', 'y2'] as const).map((key, i) => (
                      <NumberField
                        key={key}
                        label={key.toUpperCase()}
                        revision={original}
                        time={view.time}
                        value={
                          [
                            controls.out.x,
                            controls.out.y,
                            controls.in.x,
                            controls.in.y,
                          ][i]!
                        }
                        min={key.startsWith('x') ? 0 : -10}
                        max={key.startsWith('x') ? 1 : 10}
                        step={0.01}
                        onCancel={() => store.setPropertyPreviews(undefined)}
                        onPreview={(v) =>
                          apply(
                            {
                              ...controls,
                              [i < 2 ? 'out' : 'in']: {
                                ...controls[i < 2 ? 'out' : 'in'],
                                [i % 2 ? 'y' : 'x']: v,
                              },
                            },
                            left,
                            right,
                            true,
                          )
                        }
                        onCommit={(v) =>
                          apply({
                            ...controls,
                            [i < 2 ? 'out' : 'in']: {
                              ...controls[i < 2 ? 'out' : 'in'],
                              [i % 2 ? 'y' : 'x']: v,
                            },
                          })
                        }
                        onError={(m) => store.setStatus(m, true)}
                      />
                    ))}
                  </div>
                )}
              </fieldset>
              {frames.length > 2 && (
                <label>
                  区间
                  <select
                    aria-label="曲线关键帧区间"
                    value={left?.id ?? ''}
                    onChange={(e) => {
                      setSegmentId(e.target.value);
                      setFocus('segment');
                    }}
                  >
                    {frames.slice(0, -1).map((k, i) => (
                      <option key={k.id} value={k.id}>
                        K{i + 1} → K{i + 2}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!focus && !keyContext && (
                <p>选择菱形关键帧、曲线区间或圆形手柄，编辑精确参数。</p>
              )}
              <button onClick={fitCurve}>适应全部关键帧</button>
              <button disabled={!selectedKey} onClick={fitSelected}>
                适应选中关键帧
              </button>
              {left && right && entry.key === 'transform.position' && (
                <details>
                  <summary>空间路径</summary>
                  <SpatialMotionEditor
                    store={store}
                    property={original}
                    left={left}
                    right={right}
                  />
                </details>
              )}
            </>
          }
          footer={
            <>
              <IconButton
                label={view.playing ? '暂停曲线预览' : '播放曲线预览'}
                shortcut="Space"
                onClick={() => store.setPlaying(!view.playing)}
              >
                <Icon name={view.playing ? 'pause' : 'play'} />
              </IconButton>
              <IconButton
                label="停止曲线预览"
                onClick={() => {
                  store.setPlaying(false);
                  store.setTime(0);
                }}
              >
                <Icon name="stop" />
              </IconButton>
              {onLoopChange && (
                <IconButton
                  label="曲线循环播放"
                  aria-pressed={loop}
                  onClick={() => onLoopChange(!loop)}
                >
                  <Icon name="loop" />
                </IconButton>
              )}
              <input
                className="curve-scrubber"
                aria-label="曲线预览时间"
                type="range"
                min={0}
                max={c.duration}
                step={1 / c.fps}
                value={view.time}
                onChange={(e) => store.setTime(Number(e.target.value))}
              />
              <output>{view.time.toFixed(3)} s</output>
              <span className="curve-nav-hint">
                滚轮缩放 · Shift 滚轮横移 · 空格/中键平移
              </span>
              <IconButton label="缩小曲线视图" onClick={() => zoomAt(1 / 1.25)}>
                −
              </IconButton>
              <output>{Math.round(viewport.zoom * 100)}%</output>
              <IconButton label="放大曲线视图" onClick={() => zoomAt(1.25)}>
                ＋
              </IconButton>
            </>
          }
        >
          <div className="curve-canvas">
            <svg
              ref={measureSvg}
              viewBox={`${viewport.x} ${viewport.y} ${680 / viewport.zoom} ${280 / viewport.zoom}`}
              preserveAspectRatio="none"
              tabIndex={0}
              style={{
                touchAction: 'none',
                cursor: grabbing ? 'grab' : 'default',
              }}
              onPointerDown={(e) => {
                if (e.button === 0 && !space.current) {
                  panUsed.current = false;
                  if (e.target === e.currentTarget) {
                    setFocus(undefined);
                    store.selectFrames([]);
                  }
                }
                if (e.button !== 1 && !(e.button === 0 && space.current))
                  return;
                e.preventDefault();
                e.currentTarget.focus();
                e.currentTarget.setPointerCapture(e.pointerId);
                const rect = e.currentTarget.getBoundingClientRect();
                pan.current = {
                  x: e.clientX,
                  y: e.clientY,
                  width: rect.width,
                  height: rect.height,
                  view: viewport,
                };
              }}
              onPointerMove={(e) => {
                const p = pan.current;
                if (p) {
                  panUsed.current =
                    Math.hypot(e.clientX - p.x, e.clientY - p.y) > 3;
                  setViewport({
                    ...p.view,
                    x:
                      p.view.x -
                      ((e.clientX - p.x) * 680) /
                        Math.max(1, p.width) /
                        p.view.zoom,
                    y:
                      p.view.y -
                      ((e.clientY - p.y) * 280) /
                        Math.max(1, p.height) /
                        p.view.zoom,
                  });
                }
              }}
              onPointerUp={() => {
                pan.current = undefined;
              }}
              onPointerCancel={() => {
                if (pan.current) setViewport(pan.current.view);
                pan.current = undefined;
              }}
              onLostPointerCapture={() => {
                if (pan.current) setViewport(pan.current.view);
                pan.current = undefined;
              }}
              className="graph-svg"
              role="img"
              aria-label={mode === 'speed' ? '动画速度曲线' : '动画值曲线'}
            >
              {Array.from({ length: 21 }, (_, i) => (
                <line
                  key={`time-${i}`}
                  pointerEvents="none"
                  x1={50 + i * 29}
                  x2={50 + i * 29}
                  y1={30}
                  y2={235}
                  stroke="var(--border-subtle)"
                  opacity={i % 5 ? 0.35 : 0.8}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {[1, 2, 3].map((i) => (
                <text
                  key={`time-label-${i}`}
                  transform={`translate(${50 + i * 145} 268) scale(${pixelX} ${pixelY})`}
                  fill="var(--text-muted)"
                  fontSize="10"
                  pointerEvents="none"
                >
                  {(start + ((end - start) * i) / 4).toFixed(2)} s
                </text>
              ))}
              {[0, 1, 2, 3, 4].map((i) => (
                <g key={i}>
                  <line
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                    x1="50"
                    x2="630"
                    y1={30 + (i * 205) / 4}
                    y2={30 + (i * 205) / 4}
                    stroke="var(--border-subtle)"
                  />
                  <text
                    x="0"
                    y="0"
                    transform={`translate(4 ${30 + (i * 205) / 4 + 4 * pixelY}) scale(${pixelX} ${pixelY})`}
                    fill="var(--text-muted)"
                    fontSize="10"
                  >
                    {(max - (i * (max - min)) / 4).toFixed(tickPrecision)}
                  </text>
                </g>
              ))}
              <path
                d={frames.length > 1 ? path : ''}
                onClick={(e) => selectSegmentAt(e.clientX)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  selectSegmentAt(e.clientX);
                  setMenu({ x: e.clientX, y: e.clientY, type: 'segment' });
                }}
                stroke="var(--accent-primary)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                fill="none"
              />
              {frames.map((k, i) => {
                const y = Y(
                  mode === 'speed'
                    ? sampleCurve(p, k.time, k.time, 'speed', 0, 1)[0]!.value *
                        factor
                    : valueComponent(k.value, component),
                );
                const selected = view.frames.some(
                  (r) => r.keyframeId === k.id && r.propertyId === p.id,
                );
                return (
                  <g
                    key={k.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`关键帧 K${i + 1}`}
                    aria-pressed={selected}
                    transform={`translate(${X(k.time)} ${y}) scale(${pixelX} ${pixelY})`}
                    onClick={(e) => {
                      if (space.current || panUsed.current) return;
                      setSegmentId(k.id);
                      setFocus('key');
                      store.setTime(k.time);
                      const ref = { propertyId: p.id, keyframeId: k.id };
                      if (e.shiftKey || e.ctrlKey || e.metaKey)
                        store.selectFrame(ref, true);
                      else store.selectFrames([ref]);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setFocus('key');
                        store.selectFrames([
                          { propertyId: p.id, keyframeId: k.id },
                        ]);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      store.selectFrame({ propertyId: p.id, keyframeId: k.id });
                      setSegmentId(k.id);
                      setFocus('key');
                      setMenu({ x: e.clientX, y: e.clientY, type: 'key' });
                    }}
                  >
                    <rect
                      x={-10}
                      y={-10}
                      width={20}
                      height={20}
                      fill="transparent"
                    />
                    <path
                      d="M0 -5L5 0 0 5 -5 0Z"
                      fill={
                        selected
                          ? 'var(--accent-primary)'
                          : 'var(--background-secondary)'
                      }
                      stroke={
                        selected
                          ? 'var(--accent-primary)'
                          : 'var(--text-primary)'
                      }
                    />
                  </g>
                );
              })}
              {left &&
                right &&
                (['out', 'in'] as const).map((which) => {
                  const actual = handlePoint(which),
                    h = {
                      x: Math.max(
                        viewport.x + 10 * pixelX,
                        Math.min(
                          viewport.x + 680 / viewport.zoom - 10 * pixelX,
                          actual.x,
                        ),
                      ),
                      y: Math.max(
                        viewport.y + 10 * pixelY,
                        Math.min(
                          viewport.y + 280 / viewport.zoom - 10 * pixelY,
                          actual.y,
                        ),
                      ),
                    },
                    key = which === 'out' ? left : right;
                  return (
                    <g key={which}>
                      <line
                        vectorEffect="non-scaling-stroke"
                        pointerEvents="none"
                        x1={X(key.time)}
                        y1={Y(
                          mode === 'speed'
                            ? (which === 'out'
                                ? speed!.outSpeed
                                : speed!.inSpeed) * factor
                            : valueComponent(key.value, component),
                        )}
                        x2={h.x}
                        y2={h.y}
                        stroke="var(--warning)"
                      />
                      <ellipse
                        role="slider"
                        aria-label={
                          which === 'out' ? '出切线手柄' : '入切线手柄'
                        }
                        aria-valuenow={controls[which].x}
                        data-offscreen={h.x !== actual.x || h.y !== actual.y}
                        tabIndex={0}
                        cx={h.x}
                        cy={h.y}
                        rx={4 * pixelX}
                        ry={4 * pixelY}
                        fill="var(--warning)"
                        style={{ cursor: 'move', touchAction: 'none' }}
                        onPointerDown={(e) => {
                          if (e.button !== 0 || space.current || layer?.locked)
                            return;
                          e.stopPropagation();
                          setFocus(which);
                          store.setPlaying(false);
                          e.currentTarget.focus();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          domainRef.current = { key: curveKey, min, max };
                          gesture.current = {
                            which,
                            controls,
                            project: view.project,
                            key: curveKey,
                            domain: { start, end, min, max },
                          };
                        }}
                        onKeyDown={(e) => {
                          if (layer?.locked) return;
                          if (
                            [
                              'ArrowLeft',
                              'ArrowRight',
                              'ArrowUp',
                              'ArrowDown',
                            ].includes(e.key)
                          ) {
                            e.preventDefault();
                            const pt = controls[which];
                            apply({
                              ...controls,
                              [which]: {
                                x: Math.max(
                                  0,
                                  Math.min(
                                    1,
                                    pt.x +
                                      (e.key === 'ArrowRight'
                                        ? 0.01
                                        : e.key === 'ArrowLeft'
                                          ? -0.01
                                          : 0),
                                  ),
                                ),
                                y:
                                  pt.y +
                                  (e.key === 'ArrowUp'
                                    ? 0.02
                                    : e.key === 'ArrowDown'
                                      ? -0.02
                                      : 0),
                              },
                            });
                          }
                        }}
                      />
                    </g>
                  );
                })}
              <line
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
                x1={X(view.time)}
                x2={X(view.time)}
                y1="20"
                y2="240"
                stroke="var(--danger)"
              />
              <text
                x="0"
                y="0"
                transform={`translate(50 268) scale(${pixelX} ${pixelY})`}
                fill="var(--text-muted)"
                fontSize="11"
              >
                {start.toFixed(2)} 秒
              </text>
              <text
                x="0"
                y="0"
                transform={`translate(580 268) scale(${pixelX} ${pixelY})`}
                fill="var(--text-muted)"
                fontSize="11"
              >
                {end.toFixed(2)} 秒
              </text>
            </svg>
            {!frames.length && (
              <p className="curve-empty-hint">
                该属性尚无关键帧。请先在时间轴开启动画。
              </p>
            )}
            {frames.length === 1 && (
              <p className="curve-empty-hint">
                已有 1 个关键帧。添加第二个关键帧后即可编辑曲线。
              </p>
            )}
          </div>
        </CurveWorkspace>
        {menu && (
          <ContextMenu
            {...menu}
            onClose={() => setMenu(undefined)}
            items={
              menu.type === 'key'
                ? editorContributions(store, 'context.keyframe', 'curvegraph')
                : contributionItems('motion.segmentContext', curveCommands(), {
                    ...contextKeys(view, 'curvegraph'),
                    hasMotionTarget: !!left && !!right,
                  })
            }
          />
        )}
      </section>
    </GraphFrame>
  );
}

function GraphFrame({
  embedded,
  onClose,
  children,
  empty = false,
}: {
  embedded: boolean;
  onClose: () => void;
  empty?: boolean;
  children: import('react').ReactNode;
}) {
  return embedded ? (
    <div className={`graph-inline ${empty ? 'is-empty' : ''}`}>{children}</div>
  ) : (
    <Modal onClose={onClose}>{children}</Modal>
  );
}
