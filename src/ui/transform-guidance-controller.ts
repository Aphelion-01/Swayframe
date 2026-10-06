import { createTransformContext } from '../core/transform-resolvers';
import { createRenderSnapshot } from '../core/renderer-core';
import { activeComposition } from '../core/project-model';
import type {
  TransformInteractionSettings,
  TransformContext,
} from '../core/transform-context';
import type { GuideActivity } from '../core/transform-guidance';
import type { EditorStore } from './editor-store';
interface GuidanceState {
  activity?: GuideActivity;
  referencePreview?: TransformInteractionSettings;
  baseline?: TransformContext;
  ghost: boolean;
  suppressed?: boolean;
}
export class TransformGuidanceController {
  #state: GuidanceState = { ghost: false };
  #listeners = new Set<() => void>();
  #seen = new Set<string>();
  #timer?: ReturnType<typeof setTimeout>;
  constructor(readonly store: EditorStore) {
    let view = store.getSnapshot();
    store.subscribe(() => {
      const next = store.getSnapshot();
      if (
        next.project !== view.project ||
        next.time !== view.time ||
        next.selection.join('|') !== view.selection.join('|') ||
        next.transformSettings !== view.transformSettings
      ) {
        clearTimeout(this.#timer);
        this.#set({
          activity: undefined,
          baseline: undefined,
          referencePreview: undefined,
          ghost: false,
        });
      }
      view = next;
    });
  }
  getSnapshot = () => this.#state;
  subscribe = (fn: () => void) => {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  };
  #set(patch: Partial<GuidanceState>) {
    this.#state = { ...this.#state, ...patch };
    for (const fn of this.#listeners) fn();
  }
  activate(activity?: GuideActivity) {
    if (JSON.stringify(activity) === JSON.stringify(this.#state.activity))
      return;
    let baseline: TransformContext | undefined;
    if (activity?.phase === 'active') {
      const view = this.store.getSnapshot();
      baseline = createTransformContext(
        createRenderSnapshot(
          activeComposition(view.project),
          view.time,
          view.selection,
          undefined,
          view.project,
        ),
        view.selection,
        view.transformSettings,
        this.store.textMeasure,
      );
    }
    this.#set({ activity, baseline });
  }
  preview(settings?: Partial<TransformInteractionSettings>) {
    clearTimeout(this.#timer);
    this.#set({
      referencePreview: settings
        ? { ...this.store.getSnapshot().transformSettings, ...settings }
        : undefined,
      ghost: !!settings,
    });
  }
  suppress(value: boolean) {
    if (value !== !!this.#state.suppressed) this.#set({ suppressed: value });
  }
  committed() {
    const key = this.store.getSnapshot().transformSettings.pivotMode;
    const first = !this.#seen.has(key);
    this.#seen.add(key);
    this.#set({ referencePreview: undefined, ghost: first });
    if (first) {
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#set({ ghost: false }), 700);
    }
  }
}
const controllers = new WeakMap<EditorStore, TransformGuidanceController>();
export function guidanceFor(store: EditorStore) {
  let controller = controllers.get(store);
  if (!controller) {
    controller = new TransformGuidanceController(store);
    controllers.set(store, controller);
  }
  return controller;
}
