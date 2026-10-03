import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { atomicWrite } from './files';
import { loadProject, saveProject } from '../../../src/core/project-io';
import type { RecentProject, Recovery } from '../../../src/desktop/contracts';
const recentSchema = z
  .array(
    z
      .object({
        path: z.string().min(1).max(32768),
        displayName: z.string().min(1).max(200),
        lastOpenedAt: z.number().nonnegative(),
      })
      .strict(),
  )
  .max(20);
const recoverySchema = z
  .object({
    data: z.string().max(20_000_000),
    path: z.string().nullable(),
    timestamp: z.number().nonnegative(),
  })
  .strict();
export class DesktopPersistence {
  #queue: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string) {}
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const next = this.#queue.then(job, job);
    this.#queue = next.catch(() => {});
    return next;
  }
  async prepare() {
    await fs.mkdir(this.directory, { recursive: true });
  }
  async recents(): Promise<RecentProject[]> {
    let raw: unknown;
    try {
      raw = JSON.parse(
        await fs.readFile(path.join(this.directory, 'recent.json'), 'utf8'),
      );
    } catch {
      return [];
    }
    const parsed = recentSchema.safeParse(raw);
    if (!parsed.success) return [];
    return Promise.all(
      parsed.data.map(async (r) => ({
        ...r,
        missing: !(await fs
          .stat(r.path)
          .then((s) => s.isFile())
          .catch(() => false)),
      })),
    );
  }
  addRecent(file: string, name: string) {
    return this.enqueue(async () => {
      await this.prepare();
      const recents = await this.recents();
      const entries = [
        {
          path: file,
          displayName:
            name === '未命名工程' ? path.basename(file, '.swayframe') : name,
          lastOpenedAt: Date.now(),
        },
        ...recents
          .filter((r) => r.path !== file)
          .map(({ path, displayName, lastOpenedAt }) => ({
            path,
            displayName,
            lastOpenedAt,
          })),
      ].slice(0, 20);
      await atomicWrite(
        path.join(this.directory, 'recent.json'),
        JSON.stringify(recentSchema.parse(entries)),
      );
    });
  }
  removeRecent(file?: string) {
    return this.enqueue(async () => {
      await this.prepare();
      const entries = (await this.recents())
        .filter((r) => file !== undefined && r.path !== file)
        .map(({ path, displayName, lastOpenedAt }) => ({
          path,
          displayName,
          lastOpenedAt,
        }));
      await atomicWrite(
        path.join(this.directory, 'recent.json'),
        JSON.stringify(entries),
      );
    });
  }
  async readRecovery(): Promise<Recovery | null> {
    try {
      const parsed = recoverySchema.parse(
        JSON.parse(
          await fs.readFile(path.join(this.directory, 'recovery.json'), 'utf8'),
        ),
      );
      return { ...parsed, data: saveProject(loadProject(parsed.data)) };
    } catch {
      return null;
    }
  }
  writeRecovery(data: string, file: string | null) {
    return this.enqueue(async () => {
      const recovery = recoverySchema.parse({
        data: saveProject(loadProject(data)),
        path: file,
        timestamp: Date.now(),
      });
      await this.prepare();
      await atomicWrite(
        path.join(this.directory, 'recovery.json'),
        JSON.stringify(recovery),
      );
    });
  }
  clearRecovery() {
    return this.enqueue(async () => {
      await fs.rm(path.join(this.directory, 'recovery.json'), { force: true });
    });
  }
  log(category: string, message: string) {
    return this.enqueue(async () => {
      await this.prepare();
      const file = path.join(this.directory, 'desktop.log');
      if (
        await fs
          .stat(file)
          .then((s) => s.size > 2_000_000)
          .catch(() => false)
      )
        await fs.rename(file, file + '.1').catch(() => {});
      await fs.appendFile(
        file,
        `${new Date().toISOString()} [${category}] ${message.replace(/[\r\n]/g, ' ').slice(0, 5000)}\n`,
      );
    });
  }
}
