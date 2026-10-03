import { expect, it } from 'vitest';
import { zipArchive, crc32 } from '../src/core/zip-archive';
import { frameTimes } from '../src/renderers/png-export';
import { createRenderSnapshot } from '../src/core/renderer-core';
import {
  createDefaultProject,
  activeComposition,
} from '../src/core/project-model';
import { CommandSystem } from '../src/core/command-system';
it('PNG 序列帧数与秒时间一致，ZIP 保存原始字节和 CRC', () => {
  const data = new TextEncoder().encode('123456789');
  expect(crc32(data)).toBe(0xcbf43926);
  const zip = zipArchive([{ name: 'frames/000000.png', data }]),
    view = new DataView(zip.buffer);
  expect(view.getUint32(0, true)).toBe(0x04034b50);
  expect(view.getUint32(14, true)).toBe(crc32(data));
  expect(view.getUint32(18, true)).toBe(data.length);
  const nameLength = view.getUint16(26, true);
  expect(zip.slice(30 + nameLength, 30 + nameLength + data.length)).toEqual(
    data,
  );
  expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
  expect(frameTimes(0, 1, 30)).toHaveLength(30);
  expect(frameTimes(0, 0.1, 30)).toEqual([0, 1 / 30, 2 / 30]);
  expect(() => frameTimes(0, 0, 30)).toThrow();
});
it('冻结工程相同时间复用快照，选择与时间变化使快照失效', () => {
  const system = new CommandSystem(createDefaultProject()),
    p = system.getSnapshot(),
    c = activeComposition(p),
    a = createRenderSnapshot(c, 0, [], undefined, p);
  expect(createRenderSnapshot(c, 0, [], undefined, p)).toBe(a);
  expect(createRenderSnapshot(c, 1, [], undefined, p)).not.toBe(a);
  expect(createRenderSnapshot(c, 0, ['selection'], undefined, p)).not.toBe(a);
});
