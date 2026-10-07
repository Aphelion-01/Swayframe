import { useState } from 'react';
export type AxisLinkMode = 'offset' | 'ratio';
export function linkedAxisValues(
  values: readonly number[],
  index: number,
  next: number,
  linked: boolean,
  mode: AxisLinkMode,
): number[] {
  const result = [...values];
  result[index] = next;
  if (!linked || index > 1 || values.length < 2) return result;
  const other = index === 0 ? 1 : 0;
  const start = values[index]!;
  result[other] =
    mode === 'ratio' && Math.abs(start) > 1e-8
      ? values[other]! * (next / start)
      : values[other]! + next - start;
  return result;
}
export function readAxisLink(id: string, defaultLinked = true): boolean {
  try {
    const saved = localStorage.getItem(`swayframe.axis-link.${id}`);
    return saved === null ? defaultLinked : saved !== 'false';
  } catch {
    return defaultLinked;
  }
}
export function useAxisLink(id: string, defaultLinked = true) {
  const [state, setState] = useState(() => ({
    id,
    defaultLinked,
    linked: readAxisLink(id, defaultLinked),
  }));
  const linked =
    state.id === id && state.defaultLinked === defaultLinked
      ? state.linked
      : readAxisLink(id, defaultLinked);
  const toggle = () => {
    setState({ id, defaultLinked, linked: !linked });
    try {
      localStorage.setItem(`swayframe.axis-link.${id}`, String(!linked));
    } catch {
      /* preferences are optional */
    }
  };
  return { linked, toggle };
}
export function AxisLinkButton({
  label,
  linked,
  onClick,
}: {
  label: string;
  linked: boolean;
  onClick: () => void;
}) {
  const title = `${linked ? '解除' : '启用'}${label} X/Y 链接`;
  return (
    <button
      type="button"
      className={`axis-link-button ${linked ? 'is-linked' : ''}`}
      aria-label={title}
      title={title}
      aria-pressed={linked}
      onClick={onClick}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 13a5 5 0 0 0 7 .1l3-3a5 5 0 0 0-7-7l-2 2" />
        <path d="M14 11a5 5 0 0 0-7-.1l-3 3a5 5 0 0 0 7 7l2-2" />
        {!linked && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}
