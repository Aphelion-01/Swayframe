import { useEffect, useEffectEvent } from 'react';
/** A UI cancellation signal; never mutates Project or records history. */
export function useInteractionCancel(cancel: () => void) {
  const latestCancel = useEffectEvent(cancel);
  useEffect(() => {
    const handler = () => latestCancel();
    window.addEventListener('motion:cancel', handler);
    window.addEventListener('blur', handler);
    return () => {
      window.removeEventListener('motion:cancel', handler);
      window.removeEventListener('blur', handler);
    };
  }, []);
}
