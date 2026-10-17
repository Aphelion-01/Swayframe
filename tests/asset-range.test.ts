import { expect, it } from 'vitest';
import { assetResponse } from '../apps/desktop/electron/asset-response';
it('本地媒体支持完整、指定、开放及后缀字节范围以支持时间跳转', async () => {
  const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
  for (const [range, status, data, contentRange] of [
    [null, 200, [0, 1, 2, 3, 4, 5], null],
    ['bytes=2-4', 206, [2, 3, 4], 'bytes 2-4/6'],
    ['bytes=4-', 206, [4, 5], 'bytes 4-5/6'],
    ['bytes=-2', 206, [4, 5], 'bytes 4-5/6'],
    ['bytes=0-999', 206, [0, 1, 2, 3, 4, 5], 'bytes 0-5/6'],
  ] as const) {
    const r = assetResponse(bytes, 'audio/mpeg', range);
    expect(r.status).toBe(status);
    expect([...new Uint8Array(await r.arrayBuffer())]).toEqual(data);
    expect(r.headers.get('Content-Range')).toBe(contentRange);
    expect(r.headers.get('Content-Length')).toBe(String(data.length));
  }
  for (const range of [
    'bytes=6-',
    'bytes=4-2',
    'bytes=-0',
    'bytes=',
    'bytes=0-1,4-5',
    'bytes=999999999999999999999-',
  ]) {
    const r = assetResponse(bytes, 'audio/flac', range);
    expect(r.status).toBe(416);
    expect(r.headers.get('Content-Range')).toBe('bytes */6');
  }
});
