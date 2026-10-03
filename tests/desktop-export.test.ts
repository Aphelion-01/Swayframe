import { it, expect } from 'vitest';
import { sequenceEntries } from '../apps/desktop/electron/export-files';
import { zipArchive } from '../src/core/zip-archive';
it('accepts current sequence format and rejects traversal, checksum damage and unknown entries', () => {
  const entries = [
    { name: 'frames/000000.png', data: new Uint8Array([1, 2]) },
    { name: 'manifest.json', data: new TextEncoder().encode('{}') },
  ];
  expect(sequenceEntries(zipArchive(entries)).map((e) => e.name)).toEqual(
    entries.map((e) => e.name),
  );
  expect(() =>
    sequenceEntries(
      zipArchive([
        { name: '../escape', data: new Uint8Array() },
        { name: 'manifest.json', data: new Uint8Array() },
      ]),
    ),
  ).toThrow('Unsafe');
  const zip = zipArchive(entries);
  zip[30 + 'frames/000000.png'.length] = 99;
  expect(() => sequenceEntries(zip)).toThrow('checksum');
});
