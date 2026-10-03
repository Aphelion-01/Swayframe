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
}) {
  const format = (v: number) => String(Number(v.toFixed(3)));
  const [draft, setDraft] = useState(format(value));
  useEffect(() => setDraft(format(value)), [value]);
  const cancelBlur = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<
    | {
        x: number;
        start: number;
        next: number;
        revision: unknown;
        time: number | undefined;
      }
    | undefined
  >(undefined);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const cancel = () => {
    drag.current = undefined;
    setDraft(format(value));
    onCancel?.();
  };
  useInteractionCancel(() => {
    if (drag.current) cancel();
  });
  const commit = () => {
    if (cancelBlur.current) {
      cancelBlur.current = false;
      return;
    }
    const next = Number(draft);
    if (!draft.trim() || !Number.isFinite(next) || next < min || next > max) {
      setDraft(format(value));
      onError(`${label}：请输入范围内的有效数值`);
      return;
    }
    if (Math.abs(next - value) > 1e-8) onCommit(next);
  };
  return (
    <label className="field">
      <span
        className="scrub-label"
        title="拖动调整 · Shift 大步长 · Alt 小步长 · 双击输入"
        tabIndex={0}
        onDoubleClick={() => {
          input.current?.focus();
          input.current?.select();
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            x: event.clientX,
            start: value,
            next: value,
            revision,
            time,
          };
        }}
        onPointerMove={(event) => {
          const d = drag.current;
          if (!d) return;
          if (d.revision !== revision || d.time !== time) {
            cancel();
            return;
          }
          d.next = clamp(
            d.start +
              (event.clientX - d.x) *
                step *
                (event.shiftKey ? 10 : event.altKey ? 0.1 : 1),
          );
          setDraft(format(d.next));
          onPreview?.(d.next);
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = undefined;
          if (d && (d.revision !== revision || d.time !== time)) {
            cancel();
            return;
          }
          if (d && Math.abs(d.next - d.start) > 1e-8) {
            onCancel?.();
            onCommit(d.next);
          } else onCancel?.();
        }}
        onPointerCancel={cancel}
        onLostPointerCapture={() => {
          if (drag.current) cancel();
        }}
      >
        {label}
      </span>
      <input
        ref={input}
        aria-label={label}
        type="number"
        step="any"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const next = clamp(
              Number(draft) +
                (event.key === 'ArrowUp' ? 1 : -1) *
                  step *
                  (event.shiftKey ? 10 : event.altKey ? 0.1 : 1),
            );
            setDraft(format(next));
            onCommit(next);
          }
          if (event.key === 'Enter') event.currentTarget.blur();
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
