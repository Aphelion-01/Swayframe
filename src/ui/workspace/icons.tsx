import type { SVGProps } from 'react';
export type IconName =
  | 'fit'
  | 'polygon'
  | 'star'
  | 'path'
  | 'solid'
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'ellipse'
  | 'pen'
  | 'text'
  | 'search'
  | 'play'
  | 'pause'
  | 'stop'
  | 'start'
  | 'loop'
  | 'snap'
  | 'undo'
  | 'redo'
  | 'eye'
  | 'eye-off'
  | 'lock'
  | 'unlock'
  | 'more'
  | 'panel-left'
  | 'panel-right'
  | 'panel-bottom'
  | 'chevron'
  | 'close'
  | 'clock'
  | 'diamond'
  | 'anchor'
  | 'cube'
  | 'image'
  | 'comp'
  | 'camera'
  | 'null'
  | 'assistant'
  | 'folder'
  | 'save'
  | 'export';
const paths: Record<IconName, string> = {
  fit: 'M6 2H2v4 M10 2h4v4 M2 10v4h4 M14 10v4h-4 M5 5h6v6H5Z',
  polygon: 'M8 2l6 4v6l-6 3-6-3V6Z',
  star: 'M8 1l2 4 4.5.6-3.3 3.2.8 4.5L8 11.2l-4 2.1.8-4.5L1.5 5.6 6 5Z',
  path: 'M2 12C3 1 13 15 14 4 M1 11h2v2H1Z M13 3h2v2h-2Z',
  solid: 'M2 2h12v12H2Z M3 12L12 3 M3 8l5-5 M8 13l5-5',
  select: 'M3 2.5 12 8l-4 .9-1.9 4.3Z M8 9l3 4',
  hand: 'M5.5 8V4a1 1 0 0 1 2 0v3 M7.5 6V3a1 1 0 0 1 2 0v4 M9.5 6V4a1 1 0 0 1 2 0v4 M11.5 7V6a1 1 0 0 1 2 0v4c0 2.5-1.5 4-4 4H8c-1.5 0-2.3-.7-3-1.8L2.5 9a1 1 0 0 1 1.6-1.2L5.5 9',
  rectangle: 'M3 3h10v10H3Z',
  ellipse: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11',
  pen: 'M4 11 3 13l2-1 7-7-2-2Z M9 4l3 3 M3 13l3-1',
  text: 'M3 3h10 M8 3v10 M5.5 13h5',
  search: 'M7 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9 M10.5 10.5l3 3',
  play: 'M5 3.5 12 8l-7 4.5Z',
  pause: 'M5.5 3v10 M10.5 3v10',
  stop: 'M4 4h8v8H4Z',
  start: 'M3 3v10 M12 3.5 5 8l7 4.5Z',
  loop: 'M12.5 6a5 5 0 0 0-9-1 M3.5 10a5 5 0 0 0 9 1 M2 2v3.5h3.5 M14 14v-3.5h-3.5',
  snap: 'M4 3v6a4 4 0 0 0 8 0V3 M4 6h2 M10 6h2 M6 3v5 M10 3v5',
  undo: 'M5 3 2 6l3 3 M2 6h7a4 4 0 0 1 0 8',
  redo: 'M11 3l3 3-3 3 M14 6H7a4 4 0 0 0 0 8',
  eye: 'M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4-6.5-4-6.5-4 M8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  'eye-off':
    'M2 2l12 12 M6 4.3A7 7 0 0 1 8 4c4 0 6.5 4 6.5 4a12 12 0 0 1-2 2 M10 11.7A7 7 0 0 1 8 12c-4 0-6.5-4-6.5-4a12 12 0 0 1 2-2',
  lock: 'M4 7h8v7H4Z M5.5 7V4a2.5 2.5 0 0 1 5 0v3 M8 10v1',
  unlock: 'M4 7h8v7H4Z M5.5 7V4a2.5 2.5 0 0 1 5 0 M8 10v1',
  more: 'M3 8h.01 M8 8h.01 M13 8h.01',
  'panel-left': 'M2 2.5h12v11H2Z M6 2.5v11',
  'panel-right': 'M2 2.5h12v11H2Z M10 2.5v11',
  'panel-bottom': 'M2 2.5h12v11H2Z M2 9.5h12',
  chevron: 'M5.5 3l5 5-5 5',
  close: 'M4 4l8 8 M12 4l-8 8',
  clock: 'M8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10 M8 5v3l2 1 M6 1h4',
  diamond: 'M8 2l6 6-6 6-6-6Z',
  anchor: 'M8 2v12 M2 8h12 M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  cube: 'M8 1l6 3v8l-6 3-6-3V4Z M2 4l6 3 6-3 M8 7v8',
  image: 'M2 3h12v10H2Z M3 11l3-3 2 2 2-3 3 4 M5 5h.01',
  comp: 'M2 3h12v10H2Z M5 3v10 M11 3v10',
  camera: 'M2 5h8v7H2Z M10 7l4-2v7l-4-2',
  null: 'M3 3h10v10H3Z M8 5v6 M5 8h6',
  assistant: 'M8 2l1.5 4.5L14 8l-4.5 1.5L8 14 6.5 9.5 2 8l4.5-1.5Z',
  folder: 'M2 4h5l1.5 2H14v7H2Z',
  save: 'M3 2h8l2 2v10H3Z M5 2v4h5V2 M5 10h6v4',
  export: 'M8 10V2 M5 5l3-3 3 3 M3 9v5h10V9',
};
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      {...props}
      className={`ui-icon ${props.className ?? ''}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
