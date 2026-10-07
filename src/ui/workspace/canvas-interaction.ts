/** One exclusive pointer interaction. Payload slots keep existing math owners small. */
export class CanvasInteractionState<T extends object> {
  state:
    { type: 'idle' } | { [K in keyof T]: { type: K; value: T[K] } }[keyof T] = {
    type: 'idle',
  };
  slot<K extends keyof T>(type: K) {
    const read = (): T[K] | undefined =>
      this.state.type === type
        ? (this.state as { type: K; value: T[K] }).value
        : undefined;
    const write = (value: T[K] | undefined) => {
      if (value !== undefined)
        this.state = { type, value } as typeof this.state;
      else if (this.state.type === type) this.state = { type: 'idle' };
    };
    return {
      get current() {
        return read();
      },
      set current(value: T[K] | undefined) {
        write(value);
      },
    };
  }
}
export const canvasInteractionTokens = Object.freeze({
  handleSize: 6,
  hitRadius: 8,
  rotationOffset: 14,
  snapThreshold: 6,
  marqueeThreshold: 3,
});

/** Canvas modifier registry; panel shortcuts stay in the shared keyboard registry. */
export const canvasInteractionModifiers = Object.freeze({
  snapBypass: (event: Pick<MouseEvent, 'ctrlKey' | 'metaKey'>) =>
    event.ctrlKey || event.metaKey,
  duplicate: (event: Pick<MouseEvent, 'altKey'>) => event.altKey,
  snapHint: 'Cmd/Ctrl 临时关闭',
});
