import { hasPrimaryModifier } from '../../desktop/platform';
export type FocusContext =
  | 'curvegraph'
  | 'compositing'
  | 'canvas'
  | 'timeline'
  | 'layers'
  | 'text'
  | 'numeric'
  | 'global';
export interface Shortcut {
  id: string;
  label: string;
  key: string;
  modifier?: boolean;
  shift?: boolean;
  contexts?: readonly FocusContext[];
  inInput?: boolean;
  action: (event: KeyboardEvent, context: FocusContext) => void;
}
export function focusContext(target: EventTarget | null): FocusContext {
  const element = target instanceof Element ? target : document.activeElement;
  if (
    element instanceof HTMLElement &&
    (element.matches('input,textarea,select') || element.isContentEditable)
  )
    return element instanceof HTMLInputElement && element.type === 'number'
      ? 'numeric'
      : 'text';
  if (element?.closest('.graph-dialog,.motion-curve-panel'))
    return 'curvegraph';
  if (element?.closest('.compositing-graph')) return 'compositing';
  if (element?.matches('.scrub-label')) return 'numeric';
  if (element?.closest('.timeline-panel')) return 'timeline';
  if (element?.closest('.canvas-panel')) return 'canvas';
  if (element?.closest('.layers-panel')) return 'layers';
  return 'global';
}
export function dispatchShortcut(
  event: KeyboardEvent,
  shortcuts: readonly Shortcut[],
): boolean {
  if (event.defaultPrevented || event.isComposing) return false;
  const context = focusContext(event.target),
    modifier = hasPrimaryModifier(event);
  const key = event.code === 'Space' ? 'space' : event.key.toLowerCase();
  const shortcut = shortcuts.find(
    (item) =>
      item.key === key &&
      !!item.modifier === modifier &&
      (item.shift === undefined || item.shift === event.shiftKey) &&
      (!item.contexts || item.contexts.includes(context)) &&
      (item.inInput || !['text', 'numeric'].includes(context)),
  );
  if (!shortcut) return false;
  event.preventDefault();
  shortcut.action(event, context);
  return true;
}
