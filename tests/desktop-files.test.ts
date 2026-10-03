import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  FileGrants,
  normalizePath,
  writeProject,
  readProject,
} from '../apps/desktop/electron/files';
import { createDefaultProject } from '../src/core/project-model';
import { saveProject, loadProject } from '../src/core/project-io';
describe('Native project IO', () => {
  it('round-trips validated projects at Unicode paths and preserves valid file on failure', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'swayframe-'));
    try {
      const file = path.join(dir, '中文 空格 🌙.swayframe'),
        project = createDefaultProject();
      await writeProject(file, saveProject(project));
      expect(loadProject(await readProject(file))).toEqual(project);
      await expect(writeProject(file, '{broken')).rejects.toThrow();
      expect(loadProject(await readProject(file))).toEqual(project);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
  it('normalizes Windows and macOS paths without filesystem access', () => {
    expect(
      normalizePath('C:\\Users\\中文 空格\\..\\动画.swayframe', 'win32'),
    ).toBe('C:\\Users\\动画.swayframe');
    expect(normalizePath('/tmp/中文/../🌙.swayframe', 'darwin')).toBe(
      '/tmp/🌙.swayframe',
    );
    expect(() => normalizePath('../secret')).toThrow();
  });
  it('restricts IO to approved capabilities', () => {
    const grants = new FileGrants();
    expect(() => grants.requireRead('/etc/passwd')).toThrow();
    grants.grantRead('/tmp/a');
    expect(grants.requireRead('/tmp/a')).toBe('/tmp/a');
    expect(() => grants.requireWrite('/tmp/a')).toThrow();
  });
});
