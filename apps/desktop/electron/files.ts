import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadProject, saveProject } from '../../../src/core/project-io';
export function normalizePath(
  input: string,
  platform: NodeJS.Platform = process.platform,
): string {
  if (input.includes('\0')) throw new Error('Invalid path');
  const api = platform === 'win32' ? path.win32 : path.posix;
  if (!api.isAbsolute(input)) throw new Error('Absolute path required');
  return api.normalize(input);
}
export async function atomicWrite(
  file: string,
  data: string | Uint8Array,
): Promise<void> {
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${randomUUID()}.tmp`,
  );
  try {
    await fs.writeFile(temporary, data, { flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}
export async function readProject(file: string): Promise<string> {
  const stat = await fs.stat(file);
  if (stat.size > 20_000_000) throw new Error('工程文件超过 20 MB');
  return saveProject(loadProject(await fs.readFile(file, 'utf8')));
}
export async function writeProject(file: string, data: string): Promise<void> {
  await atomicWrite(file, saveProject(loadProject(data)));
}
export class FileGrants {
  readonly read = new Set<string>();
  readonly write = new Set<string>();
  grantRead(file: string) {
    const p = normalizePath(file);
    this.read.add(p);
    return p;
  }
  grantWrite(file: string) {
    const p = normalizePath(file);
    this.write.add(p);
    this.read.add(p);
    return p;
  }
  requireRead(file: string) {
    const p = normalizePath(file);
    if (!this.read.has(p)) throw new Error('Unapproved path');
    return p;
  }
  requireWrite(file: string) {
    const p = normalizePath(file);
    if (!this.write.has(p)) throw new Error('Unapproved path');
    return p;
  }
}
