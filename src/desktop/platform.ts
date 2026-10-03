export type PrimaryModifier = 'Meta' | 'Control';
export function primaryModifier(platform: string): PrimaryModifier {
  return platform === 'darwin' ? 'Meta' : 'Control';
}
let current: PrimaryModifier | undefined;
export function setShortcutPlatform(platform: string) {
  current = primaryModifier(platform);
}
export function hasPrimaryModifier(
  event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey'>,
) {
  return current === 'Meta'
    ? event.metaKey && !event.ctrlKey
    : current === 'Control'
      ? event.ctrlKey && !event.metaKey
      : event.metaKey || event.ctrlKey;
}

export function shortcutLabel(label: string | undefined): string | undefined {
  return current === 'Control'
    ? label
        ?.replace(/⌘/g, 'Ctrl+')
        .replace(/⇧/g, 'Shift+')
        .replace(/⌥/g, 'Alt+')
    : label;
}
