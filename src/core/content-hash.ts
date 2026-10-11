/** SHA-256 over canonical JSON; independent of platform crypto and object key order. */
export function canonicalJSON(value: unknown): string {
  if (Array.isArray(value))
    return '[' + value.map(canonicalJSON).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) +
            ':' +
            canonicalJSON((value as Record<string, unknown>)[k]),
        )
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export function contentHash(value: unknown): string {
  const input = new TextEncoder().encode(canonicalJSON(value)),
    length = input.length,
    bytes = new Uint8Array(Math.ceil((length + 9) / 64) * 64);
  bytes.set(input);
  bytes[length] = 128;
  const view = new DataView(bytes.buffer);
  view.setUint32(bytes.length - 4, length * 8);
  const primes: number[] = [];
  for (let n = 2; primes.length < 64; n++) {
    if (primes.every((p) => n % p !== 0)) primes.push(n);
  }
  const constants = primes.map((p) => ((Math.cbrt(p) % 1) * 2 ** 32) >>> 0),
    h = primes.slice(0, 8).map((p) => ((Math.sqrt(p) % 1) * 2 ** 32) >>> 0);
  const rotr = (v: number, n: number) => (v >>> n) | (v << (32 - n)),
    w = new Uint32Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]!,
        b = w[i - 2]!;
      w[i] =
        w[i - 16]! +
        (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) +
        w[i - 7]! +
        (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10));
    }
    let [a, b, c, d, e, f, g, j] = h as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (let i = 0; i < 64; i++) {
      const t1 =
          (j +
            (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) +
            ((e & f) ^ (~e & g)) +
            constants[i]! +
            w[i]!) |
          0,
        t2 =
          ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) +
            ((a & b) ^ (a & c) ^ (b & c))) |
          0;
      j = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, j].forEach((n, i) => {
      h[i] = (h[i]! + n) >>> 0;
    });
  }
  return h.map((n) => n.toString(16).padStart(8, '0')).join('');
}
