import { expect, it } from 'vitest';
import { CommandRegistry } from '../src/ui/workspace/command-registry';
it('executes current bindings, refuses disabled/unknown/group commands and detects duplicates', () => {
  let enabled = true,
    value = 0;
  const registry = new CommandRegistry(() => [
    {
      id: 'edit',
      label: '编辑',
      disabled: !enabled,
      action: () => {
        value++;
      },
    },
  ]);
  const entry = registry.entry('edit')!;
  enabled = false;
  entry.action();
  expect(value).toBe(0);
  enabled = true;
  expect(registry.execute('edit')).toBe(true);
  expect(value).toBe(1);
  expect(registry.execute('missing')).toBe(false);
  expect(() =>
    new CommandRegistry(() => [
      registry.get('edit')!,
      registry.get('edit')!,
    ]).definitions(),
  ).toThrow('重复命令');
});
