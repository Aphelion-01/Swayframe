import type { MenuItem } from './primitives';

export interface CommandBinding extends MenuItem {
  contexts?: readonly import('./shortcuts').FocusContext[];
  id: string;
}
/** Local command bindings are recreated from live state before every execution. */
export class CommandRegistry {
  constructor(private readonly resolve: () => readonly CommandBinding[]) {}
  definitions() {
    const entries = this.resolve();
    const ids = new Set<string>();
    for (const entry of entries) {
      if (ids.has(entry.id)) throw new Error(`重复命令：${entry.id}`);
      ids.add(entry.id);
    }
    return entries;
  }
  get(id: string) {
    return this.definitions().find((entry) => entry.id === id);
  }
  execute(id: string): boolean {
    const command = this.get(id);
    if (
      !command ||
      command.disabled ||
      (command.children &&
        ['create-object', 'interpolation', 'align', 'layer-color'].includes(id))
    )
      return false;
    command.action();
    return true;
  }
  entry(id: string): MenuItem | undefined {
    const command = this.get(id);
    return command
      ? {
          ...command,
          ...(command.children
            ? {
                children: command.children.map((child) => ({
                  ...child,
                  action: () => {
                    const current = this.get(id)?.children?.find((c) =>
                      child.id ? c.id === child.id : c.label === child.label,
                    );
                    if (current && !current.disabled) current.action();
                  },
                })),
              }
            : {}),
          action: () => {
            this.execute(id);
          },
        }
      : undefined;
  }
}
