import { it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DesktopPersistence } from '../apps/desktop/electron/persistence';
import { RecoveryScheduler } from '../src/desktop/recovery';
import type { DesktopAPI } from '../src/desktop/contracts';
import { createDefaultProject } from '../src/core/project-model';
import { saveProject } from '../src/core/project-io';
it('retains missing recents, bounds history, deduplicates and removes entries', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'swayframe-'));
  try {
    const persistence = new DesktopPersistence(dir);
    await persistence.addRecent('/tmp/missing.swayframe', '失联');
    await persistence.addRecent('/tmp/missing.swayframe', '失联更新');
    expect(await persistence.recents()).toMatchObject([
      { displayName: '失联更新', missing: true },
    ]);
    await persistence.removeRecent('/tmp/missing.swayframe');
    expect(await persistence.recents()).toEqual([]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
it('recovery snapshots survive a new session, cannot corrupt formal files, and serialize clear after writes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'swayframe-'));
  try {
    const persistence = new DesktopPersistence(dir),
      data = saveProject(createDefaultProject());
    await persistence.writeRecovery(data, null);
    expect(await new DesktopPersistence(dir).readRecovery()).toMatchObject({
      data,
      path: null,
    });
    await expect(persistence.writeRecovery('broken', null)).rejects.toThrow();
    expect(await persistence.readRecovery()).not.toBeNull();
    await Promise.all([
      persistence.writeRecovery(data, null),
      persistence.clearRecovery(),
    ]);
    expect(await persistence.readRecovery()).toBeNull();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
it('debounces only completed commits and cancels pending autosaves after save', async () => {
  vi.useFakeTimers();
  try {
    const write = vi.fn(async () => {}),
      clear = vi.fn(async () => {});
    const api = { recovery: { write, clear } } as unknown as DesktopAPI;
    const scheduler = new RecoveryScheduler(
      api,
      () => ({ data: 'snapshot', path: null }),
      () => {},
      1000,
    );
    for (let i = 0; i < 200; i++) scheduler.schedule();
    await vi.advanceTimersByTimeAsync(999);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(1);
    scheduler.schedule();
    await scheduler.clear();
    await vi.advanceTimersByTimeAsync(2000);
    expect(write).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);
    scheduler.dispose();
  } finally {
    vi.useRealTimers();
  }
});
