import { usePointerRelease } from './workspace/pointer-release';
import { useInteractionCancel } from './workspace/interaction';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

export function NumberField({
  label,
  value,
  onCommit,
  onError,
  min = -Infinity,
  max = Infinity,
  step = 1,
  onPreview,
  onCancel,
  revision,
  time,
  previewValue,
  compactLabel,
  mixed = false,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  onError: (message: string) => void;
  min?: number;
  max?: number;
  step?: number;
  onPreview?: (value: number) => void;
  onCancel?: () => void;
  revision?: unknown;
  time?: number;
  previewValue?: number;
  compactLabel?: string;
  mixed?: boolean;
}) {
  const format = (v: number) => String(Number(v.toFixed(3)));
  const [draft, setDraft] = useState(format(value));
  const draftRef = useRef(draft);
  const updateDraft = (text: string) => {
    draftRef.current = text;
    setDraft(text);
  };
  const input = useRef<HTMLInputElement>(null);
  const cancelBlur = useRef(false);
  const editing = useRef<
    { revision: unknown; time: number | undefined; initial: number } | undefined
  >(undefined);
  const drag = useRef<
    | {
        coordinate: number;
        start: number;
        initial: number;
        next: number;
        vertical: boolean;
        moved: boolean;
        revision: unknown;
        time: number | undefined;
      }
    | undefined
  >(undefined);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const valid = (text: string) =>
    text.trim() !== '' &&
    Number.isFinite(Number(text)) &&
    Number(text) >= min &&
    Number(text) <= max;
  const cancel = () => {
    drag.current = undefined;
    editing.current = undefined;
    updateDraft(format(value));
    onCancel?.();
  };
  const stale = (capture: { revision: unknown; time: number | undefined }) =>
    capture.revision !== revision || capture.time !== time;
  useEffect(() => {
    if (!editing.current && !drag.current)
      updateDraft(format(previewValue ?? value));
  }, [value, previewValue]);
  useEffect(() => {
    const capture = drag.current ?? editing.current;
    if (capture && stale(capture)) {
      cancelBlur.current = true;
      cancel();
    }
  }, [revision, time]);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useEffect(
    () => () => {
      if (drag.current || editing.current) cancelRef.current?.();
    },
    [],
  );
  useInteractionCancel(() => {
    if (drag.current || editing.current) {
      cancelBlur.current = true;
      cancel();
    }
  });
  const commit = () => {
    if (drag.current) return;
    if (cancelBlur.current) {
      cancelBlur.current = false;
      return;
    }
    const capture = editing.current;
    editing.current = undefined;
    if (capture && stale(capture)) {
      cancel();
      return;
    }
    const text = draftRef.current;
    onCancel?.();
    if (!valid(text)) {
      updateDraft(format(value));
      onError(`${label}：请输入范围内的有效数值`);
      return;
    }
    const next = Number(text);
    if (Math.abs(next - (capture?.initial ?? value)) > 1e-8) onCommit(next);
  };
  const beginDrag = (
    event: React.PointerEvent<HTMLElement>,
    vertical: boolean,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    if (!vertical) event.currentTarget.focus();
    cancelBlur.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = valid(draftRef.current) ? Number(draftRef.current) : value;
    drag.current = {
      coordinate: vertical ? event.clientY : event.clientX,
      start,
      initial: value,
      next: start,
      vertical,
      moved: false,
      revision,
      time,
    };
  };
  const moveDrag = (
    event: Pick<
      PointerEvent,
      'clientX' | 'clientY' | 'shiftKey' | 'altKey' | 'preventDefault'
    >,
  ) => {
    const d = drag.current;
    if (!d) return;
    if (stale(d)) {
      cancel();
      return;
    }
    const delta = d.vertical
      ? d.coordinate - event.clientY
      : event.clientX - d.coordinate;
    if (!d.moved && Math.abs(delta) < 3) return;
    d.moved = true;
    event.preventDefault();
    d.next = clamp(
      d.start + delta * step * (event.shiftKey ? 10 : event.altKey ? 0.1 : 1),
    );
    updateDraft(format(d.next));
    onPreview?.(d.next);
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = undefined;
    if (!d) return;
    if (stale(d)) {
      cancel();
      return;
    }
    if (!d.moved) {
      if (d.vertical) {
        input.current?.focus();
        input.current?.select();
      }
      return;
    }
    editing.current = undefined;
    onCancel?.();
    if (Math.abs(d.next - d.initial) > 1e-8) onCommit(d.next);
    cancelBlur.current = true;
    input.current?.blur();
  };
  usePointerRelease({
    active: () => !!drag.current,
    move: moveDrag,
    finish: endDrag,
    cancel,
  });
  const dragEvents = {
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: cancel,
  };
  return (
    <label className="field">
      <span
        className="scrub-label"
        data-compact-label={compactLabel}
        aria-hidden={compactLabel !== undefined ? true : undefined}
        title="拖动调整 · Shift 大步长 · Alt 小步长 · 双击输入"
        tabIndex={compactLabel !== undefined ? -1 : 0}
        onDoubleClick={() => {
          input.current?.focus();
          input.current?.select();
        }}
        onPointerDown={(event) => beginDrag(event, false)}
        {...dragEvents}
      >
        {label}
      </span>
      <input
        ref={input}
        className="scrub-value"
        aria-label={label}
        title={
          mixed
            ? '混合值（Mixed）· 输入或拖动统一调整'
            : '向上拖动增大 · 向下拖动减小 · 点击输入 · Shift 大步长 · Alt 小步长'
        }
        type="number"
        step="any"
        value={mixed && !editing.current && !drag.current ? '' : draft}
        placeholder={mixed ? '—' : undefined}
        onPointerDown={(event) => beginDrag(event, true)}
        {...dragEvents}
        onFocus={() => {
          cancelBlur.current = false;
        }}
        onChange={(event) => {
          cancelBlur.current = false;
          editing.current ??= { revision, time, initial: value };
          const text = event.target.value;
          updateDraft(text);
          if (valid(text)) onPreview?.(Number(text));
          else onCancel?.();
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            editing.current ??= { revision, time, initial: value };
            const next = clamp(
              (valid(draftRef.current) ? Number(draftRef.current) : value) +
                (event.key === 'ArrowUp' ? 1 : -1) *
                  step *
                  (event.shiftKey ? 10 : event.altKey ? 0.1 : 1),
            );
            updateDraft(format(next));
            onPreview?.(next);
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
            cancelBlur.current = true;
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            cancelBlur.current = true;
            cancel();
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function TextField({
  label,
  value,
  onCommit,
  multiline = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  const input = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (autoFocus) {
      input.current?.focus();
      input.current?.select();
    }
  }, [autoFocus]);
  const props = {
    'aria-label': label,
    value: draft,
    ref: (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      input.current = el;
    },
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(event.target.value),
    onBlur: () => {
      if (cancelled.current) {
        cancelled.current = false;
        return;
      }
      if (draft !== value) onCommit(draft);
    },
    onKeyDown: (
      event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      if (event.nativeEvent.isComposing) return;
      if (
        event.key === 'Enter' &&
        (!multiline || event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        event.currentTarget.blur();
      }
      if (event.key === 'Escape') {
        cancelled.current = true;
        setDraft(value);
        event.currentTarget.blur();
      }
    },
  };
  return (
    <label className="field text-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          {...props}
          rows={3}
          title="Enter 换行 · Cmd/Ctrl+Enter 提交 · Esc 取消"
        />
      ) : (
        <input {...props} />
      )}
    </label>
  );
}
