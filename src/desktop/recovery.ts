import type { DesktopAPI } from './contracts';
export class RecoveryScheduler {
  #timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    readonly api: DesktopAPI,
    readonly snapshot: () => { data: string; path: string | null },
    readonly onError: () => void,
    readonly delay = 1500,
  ) {}
  schedule() {
    this.cancel();
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      const state = this.snapshot();
      void this.api.recovery.write(state.data, state.path).catch(this.onError);
    }, this.delay);
  }
  cancel() {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
  }
  async clear() {
    this.cancel();
    await this.api.recovery.clear();
  }
  dispose() {
    this.cancel();
  }
}
