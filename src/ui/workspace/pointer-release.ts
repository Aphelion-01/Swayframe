import { useEffect, useRef } from 'react';

/** Keep gestures alive when a controlled element loses native pointer capture. */
export function usePointerRelease(handlers: {
  active: () => boolean;
  move?: (event: PointerEvent) => void;
  finish: () => void;
  cancel: () => void;
}) {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (latest.current.active()) latest.current.move?.(event);
    };
    const finish = () => {
      if (latest.current.active()) latest.current.finish();
    };
    const cancel = () => {
      if (latest.current.active()) latest.current.cancel();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', cancel, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', cancel, true);
    };
  }, []);
}
