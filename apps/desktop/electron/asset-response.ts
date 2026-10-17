/** Chromium media seeks issue byte-range requests, including suffix ranges. */
export function assetResponse(
  bytes: Uint8Array,
  mime: string,
  range: string | null,
) {
  const size = bytes.byteLength;
  const headers = new Headers({
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
  });
  if (!range) {
    headers.set('Content-Length', String(size));
    return new Response(new Uint8Array(bytes), { headers });
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const first = match?.[1],
    last = match?.[2];
  let start = first ? Number(first) : Math.max(0, size - Number(last));
  let end = first
    ? last
      ? Math.min(Number(last), size - 1)
      : size - 1
    : size - 1;
  if (
    !match ||
    (!first && !last) ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start >= size ||
    end < start ||
    (!first && Number(last) === 0)
  ) {
    headers.set('Content-Range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  start = Math.max(0, start);
  end = Math.min(size - 1, end);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(new Uint8Array(bytes.slice(start, end + 1)), {
    status: 206,
    headers,
  });
}
