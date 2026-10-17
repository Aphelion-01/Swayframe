import { expect, it } from 'vitest';
import { mediaMetadata } from '../src/importers/media-metadata';
import { mediaMime } from '../src/shared/media-formats';
import { assetSchema } from '../src/core/project-schema';
import {
  CommandSystem,
  command,
  transaction,
} from '../src/core/command-system';
import {
  activeComposition,
  createDefaultProject,
  createLayer,
} from '../src/core/project-model';
import { saveProject, loadProject } from '../src/core/project-io';

it('decodes a real PCM WAV and saves an audio layer through an undoable transaction', async () => {
  const bytes = Buffer.alloc(44 + 48000 * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(48000, 24);
  bytes.writeUInt32LE(96000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(bytes.length - 44, 40);
  for (let i = 0; i < 48000; i++)
    bytes.writeInt16LE(
      Math.round(12000 * Math.sin((2 * Math.PI * 440 * i) / 48000)),
      44 + i * 2,
    );
  const media = await mediaMetadata(new Blob([bytes]));
  expect(media.kind).toBe('audio');
  expect(media.duration).toBeCloseTo(1);
  const asset = assetSchema.parse({
    id: crypto.randomUUID(),
    name: 'tone.wav',
    mimeType: 'audio/wav',
    dataUrl: 'data:audio/wav;base64,' + bytes.toString('base64'),
    media,
  });
  const p = createDefaultProject(),
    host = new CommandSystem(p),
    c = activeComposition(p);
  const layer = createLayer('audio', { assetId: asset.id });
  expect(
    host.executeTransaction(
      transaction('import', 'human', [
        command({ type: 'asset.add', asset }),
        command({ type: 'layer.create', compositionId: c.id, layer }),
      ]),
    ),
  ).toMatchObject({ ok: true });
  expect(
    activeComposition(loadProject(saveProject(host.getSnapshot()))).layers[0]
      ?.type,
  ).toBe('audio');
  host.undo();
  expect(host.getSnapshot().assets).toHaveLength(0);
});
it('accepts common media MIME types but rejects external and mismatched inline references', () => {
  for (const name of [
    'a.mp3',
    'a.flac',
    'a.ogg',
    'a.opus',
    'a.m4a',
    'a.aac',
    'a.mp4',
    'a.mov',
    'a.webm',
    'a.mkv',
    'a.ts',
    'a.bmp',
    'a.avif',
  ]) {
    const mime = mediaMime(name)!;
    const base = { id: crypto.randomUUID(), name, mimeType: mime };
    expect(
      assetSchema.safeParse({ ...base, dataUrl: `data:${mime};base64,AAAA` })
        .success,
    ).toBe(true);
    expect(
      assetSchema.safeParse({ ...base, dataUrl: 'https://example.com/file' })
        .success,
    ).toBe(false);
    expect(
      assetSchema.safeParse({ ...base, dataUrl: 'data:text/html;base64,AAAA' })
        .success,
    ).toBe(false);
  }
});
it('rejects corrupted media before inserting an asset', async () => {
  await expect(mediaMetadata(new Blob(['invalid media']))).rejects.toThrow();
});
