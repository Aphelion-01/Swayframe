import { useEffect } from 'react';
/** A UI cancellation signal; never mutates Project or records history. */
export function useInteractionCancel(cancel: () => void) {
  useEffect(() => {
    const handler = () => cancel();
    window.addEventListener('motion:cancel', handler);
    window.addEventListener('blur', handler);
    return () => {
      window.removeEventListener('motion:cancel', handler);
      window.removeEventListener('blur', handler);
    };
  });
}
