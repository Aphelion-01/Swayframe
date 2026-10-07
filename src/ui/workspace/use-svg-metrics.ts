import { useCallback, useRef, useState } from 'react';
/** Keep marks a constant screen size while the plot fills its dock. */
export function useSvgMetrics(width: number, height: number) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width, height });
  const measure = useCallback((svg: SVGSVGElement | null) => {
    ref.current = svg;
    if (!svg) return;
    const update = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width && rect.height)
        setSize((previous) =>
          previous.width === rect.width && previous.height === rect.height
            ? previous
            : { width: rect.width, height: rect.height },
        );
    };
    update();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(update);
    observer?.observe(svg);
    return () => observer?.disconnect();
  }, []);
  return { ref, size, measure };
}
