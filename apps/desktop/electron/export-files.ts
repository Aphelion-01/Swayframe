import fs from 'node:fs/promises';
import path from 'node:path';
import { crc32 } from '../../../src/core/zip-archive';
import { atomicWrite } from './files';
export function sequenceEntries(
  bytes: Uint8Array,
): { name: string; data: Uint8Array }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    entries: { name: string; data: Uint8Array }[] = [];
  let offset = 0,
    total = 0;
  while (
    offset + 30 <= bytes.length &&
    view.getUint32(offset, true) === 0x04034b50
  ) {
    const flags = view.getUint16(offset + 6, true),
      method = view.getUint16(offset + 8, true),
      crc = view.getUint32(offset + 14, true),
      size = view.getUint32(offset + 18, true),
      uncompressed = view.getUint32(offset + 22, true),
      nameLength = view.getUint16(offset + 26, true),
      extra = view.getUint16(offset + 28, true);
    if (flags !== 0x800 || method !== 0 || size !== uncompressed)
      throw new Error('Unsupported archive');
    const start = offset + 30 + nameLength + extra,
      end = start + size;
    if (end > bytes.length) throw new Error('Truncated archive');
    const name = new TextDecoder().decode(
      bytes.subarray(offset + 30, offset + 30 + nameLength),
    );
    if (!/^(frames\/\d{6}\.png|manifest\.json)$/.test(name))
      throw new Error('Unsafe archive path');
    const data = bytes.subarray(start, end);
    if (crc32(data) !== crc) throw new Error('Archive checksum mismatch');
    entries.push({ name, data });
    total += size;
    if (entries.length > 3001 || total > 512_000_000)
      throw new Error('Archive exceeds limit');
    offset = end;
  }
  if (!entries.length || !entries.some((e) => e.name === 'manifest.json'))
    throw new Error('Invalid sequence');
  return entries;
}
export async function writeExport(
  destination: string,
  bytes: Uint8Array,
  sequence: boolean,
) {
  if (sequence) {
    const entries = sequenceEntries(bytes);
    const directory = path.join(destination, `Swayframe-PNG-${Date.now()}`);
    await fs.mkdir(path.join(directory, 'frames'), { recursive: true });
    for (const entry of entries)
      await atomicWrite(path.join(directory, entry.name), entry.data);
  } else {
    if (
      bytes.length < 8 ||
      Buffer.from(bytes.subarray(0, 8)).toString('hex') !== '89504e470d0a1a0a'
    )
      throw new Error('Invalid PNG');
    await atomicWrite(destination, bytes);
  }
}
