import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { usePointerRelease } from './pointer-release';
import { useInteractionCancel } from './interaction';
/** Navigation lives entirely in view coordinates, independent of animation data. */
export function useCurveNavigation(
  ref: RefObject<SVGSVGElement | null>,
  width: number,
  height: number,
  togglePlayback: () => void,
) {
  const toggle = useEffectEvent(togglePlayback);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const space = useRef(false),
    used = useRef(false);
  const pan = useRef<
    { x: number; y: number; rect: DOMRect; view: typeof viewport } | undefined
  >(undefined);
  const zoomAt = (factor: number, x = width / 2, y = height / 2) =>
    setViewport((v) => {
      const zoom = Math.max(0.5, Math.min(8, v.zoom * factor));
      return {
        x: v.x + x / v.zoom - x / zoom,
        y: v.y + y / v.zoom - y / zoom,
        zoom,
      };
    });
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (e.shiftKey)
        setViewport((v) => ({ ...v, x: v.x + e.deltaY / v.zoom }));
      else
        zoomAt(
          Math.exp(-e.deltaY * 0.002),
          ((e.clientX - r.left) * width) / r.width,
          ((e.clientY - r.top) * height) / r.height,
        );
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => svg.removeEventListener('wheel', wheel);
  }, [ref, width, height]);
  useEffect(() => {
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (space.current && !used.current) toggle();
      space.current = false;
    };
    window.addEventListener('keyup', up);
    return () => window.removeEventListener('keyup', up);
  }, []);
  const cancel = () => {
    if (pan.current) setViewport(pan.current.view);
    pan.current = undefined;
    space.current = false;
  };
  usePointerRelease({
    active: () => !!pan.current,
    move: (e) => {
      const p = pan.current;
      if (!p) return;
      used.current = Math.hypot(e.clientX - p.x, e.clientY - p.y) > 3;
      setViewport({
        ...p.view,
        x: p.view.x - ((e.clientX - p.x) * width) / p.rect.width / p.view.zoom,
        y:
          p.view.y - ((e.clientY - p.y) * height) / p.rect.height / p.view.zoom,
      });
    },
    finish: () => {
      pan.current = undefined;
    },
    cancel,
  });
  useInteractionCancel(cancel);
  return {
    viewport,
    zoomAt,
    fit: () => setViewport({ x: 0, y: 0, zoom: 1 }),
    space,
    onKeyDown: (e: ReactKeyboardEvent) => {
      if ((e.target as Element).closest('input,textarea,select')) return;
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        space.current = true;
        used.current = false;
      }
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setViewport({ x: 0, y: 0, zoom: 1 });
      }
    },
    onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.button !== 1 && !(e.button === 0 && space.current)) return;
      e.preventDefault();
      e.currentTarget.focus();
      e.currentTarget.setPointerCapture(e.pointerId);
      pan.current = {
        x: e.clientX,
        y: e.clientY,
        rect: e.currentTarget.getBoundingClientRect(),
        view: viewport,
      };
    },
  };
}
