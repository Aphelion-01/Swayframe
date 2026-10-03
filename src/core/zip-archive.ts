export interface ZipEntry {
  readonly name: string;
  readonly data: Uint8Array;
}
const table = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = table[(crc ^ byte) & 255]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function header(
  size: number,
  values: readonly (readonly [number, number, 2 | 4])[],
): Uint8Array {
  const bytes = new Uint8Array(size),
    view = new DataView(bytes.buffer);
  for (const [offset, value, width] of values)
    if (width === 2) view.setUint16(offset, value, true);
    else view.setUint32(offset, value, true);
  return bytes;
}
function concat(chunks: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
export function zipArchive(
  entries: readonly ZipEntry[],
): Uint8Array<ArrayBuffer> {
  if (entries.length > 65535) throw new Error('文件数超出 ZIP 范围');
  const local: Uint8Array[] = [],
    central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = new TextEncoder().encode(e.name),
      crc = crc32(e.data),
      size = e.data.length;
    const lh = header(30, [
      [0, 0x04034b50, 4],
      [4, 20, 2],
      [6, 0x800, 2],
      [14, crc, 4],
      [18, size, 4],
      [22, size, 4],
      [26, name.length, 2],
    ]);
    local.push(lh, name, e.data);
    central.push(
      header(46, [
        [0, 0x02014b50, 4],
        [4, 20, 2],
        [6, 20, 2],
        [8, 0x800, 2],
        [16, crc, 4],
        [20, size, 4],
        [24, size, 4],
        [28, name.length, 2],
        [42, offset, 4],
      ]),
      name,
    );
    offset += lh.length + name.length + size;
  }
  const directory = concat(central),
    end = header(22, [
      [0, 0x06054b50, 4],
      [8, entries.length, 2],
      [10, entries.length, 2],
      [12, directory.length, 4],
      [16, offset, 4],
    ]);
  return concat([...local, directory, end]);
}
