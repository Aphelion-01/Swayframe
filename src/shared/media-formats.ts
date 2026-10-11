/** Extensions are container hints; the decoder validates actual tracks and codecs. */
export const mediaTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  avif: 'image/avif',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  wave: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
  aifc: 'audio/aiff',
  m4b: 'audio/mp4',
  m4r: 'audio/mp4',
  opus: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  qt: 'video/quicktime',
  mts: 'video/mp2t',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  ts: 'video/mp2t',
  m2ts: 'video/mp2t',
};
export const mediaAccept = Object.keys(mediaTypes)
  .map((e) => '.' + e)
  .join(',');
export function mediaMime(name: string) {
  return mediaTypes[name.split('.').at(-1)?.toLowerCase() ?? ''];
}
