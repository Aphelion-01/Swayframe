import type { DesktopAPI } from './contracts';
export class ElectronAdapter {
  constructor(readonly api: DesktopAPI) {}
  readonly native = true;
}
export class WebAdapter {
  readonly native = false;
  readonly api = undefined;
}
export class DesktopService {
  readonly adapter: ElectronAdapter | WebAdapter;
  constructor(api?: DesktopAPI) {
    this.adapter = api ? new ElectronAdapter(api) : new WebAdapter();
  }
  get native() {
    return this.adapter.native;
  }
  get api() {
    return this.adapter.api;
  }
}
export const desktopService = new DesktopService(
  typeof window === 'undefined' ? undefined : window.swayframe?.desktop,
);
