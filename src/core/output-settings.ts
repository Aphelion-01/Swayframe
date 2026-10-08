import type { Composition } from './project-model';
export const frameRates = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120];
export const resolutionPresets = [
  { id: '720p', label: 'HD 720p · 16:9', width: 1280, height: 720 },
  { id: '1080p', label: 'Full HD 1080p · 16:9', width: 1920, height: 1080 },
  { id: '1440p', label: 'QHD 1440p · 16:9', width: 2560, height: 1440 },
  { id: '2k', label: 'DCI 2K · 256:135', width: 2048, height: 1080 },
  { id: '4k', label: 'UHD 4K · 16:9', width: 3840, height: 2160 },
  { id: 'dci4k', label: 'DCI 4K · 256:135', width: 4096, height: 2160 },
  { id: '8k', label: 'UHD 8K · 16:9', width: 7680, height: 4320 },
  { id: 'vertical', label: '竖屏短视频 · 9:16', width: 1080, height: 1920 },
  { id: 'vertical4k', label: '竖屏 UHD · 9:16', width: 2160, height: 3840 },
  { id: 'square', label: '社交方形 · 1:1', width: 1080, height: 1080 },
  { id: 'portrait', label: '社交人像 · 4:5', width: 1080, height: 1350 },
  { id: 'wide', label: '超宽屏 · 21:9', width: 2560, height: 1080 },
];
export interface OutputSettings {
  width: number;
  height: number;
  fps: number;
  fit: 'contain' | 'cover' | 'stretch';
  transparent: boolean;
  background: string;
}
export const defaultOutputSettings = (c: Composition): OutputSettings => ({
  width: c.width,
  height: c.height,
  fps: c.fps,
  fit: 'contain',
  transparent: false,
  background: '#000000',
});
export function validateOutputSettings(s: OutputSettings) {
  if (
    ![s.width, s.height].every(
      (n) => Number.isInteger(n) && n >= 2 && n <= 8192,
    ) ||
    s.width * s.height > 34_000_000
  )
    throw Error('输出尺寸必须是 2–8192 的整数，总像素不超过 3400 万');
  if (!Number.isFinite(s.fps) || s.fps < 1 || s.fps > 240)
    throw Error('输出帧率必须在 1–240 之间');
  if (
    !['contain', 'cover', 'stretch'].includes(s.fit) ||
    !/^#[0-9a-f]{6}$/i.test(s.background)
  )
    throw Error('输出适配或背景颜色无效');
}
export function outputRect(sw: number, sh: number, s: OutputSettings) {
  const scale =
    s.fit === 'cover'
      ? Math.max(s.width / sw, s.height / sh)
      : Math.min(s.width / sw, s.height / sh);
  const width = s.fit === 'stretch' ? s.width : sw * scale,
    height = s.fit === 'stretch' ? s.height : sh * scale;
  return {
    x: (s.width - width) / 2,
    y: (s.height - height) / 2,
    width,
    height,
  };
}
