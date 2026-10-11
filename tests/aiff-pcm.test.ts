import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { decodeAiffPcm } from '../src/importers/aiff-pcm';
it('decodes a real AIFF PCM fixture with its sample rate and nonzero samples, rejects truncated chunks', () => {
  const raw = readFileSync('tests/fixtures/media/tone.aiff');
  const bytes = new Uint8Array(raw).buffer;
  const channels: Float32Array[] = [];
  let actual: { channels: number; frames: number; rate: number } | undefined;
  const context = {
    createBuffer: (count: number, length: number, rate: number) => {
      actual = { channels: count, frames: length, rate };
      for (let i = 0; i < count; i++) channels.push(new Float32Array(length));
      return { getChannelData: (c: number) => channels[c] } as AudioBuffer;
    },
  };
  decodeAiffPcm(bytes, context);
  expect(actual).toEqual({ channels: 1, frames: 48000, rate: 48000 });
  expect(Math.max(...channels[0]!)).toBeGreaterThan(0.3);
  expect(() => decodeAiffPcm(bytes.slice(0, 100), context)).toThrow('截断');
});
