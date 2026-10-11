/** Decode uncompressed AIFF/AIFF-C PCM; reject unsupported compression explicitly. */
export function decodeAiffPcm(
  bytes: ArrayBuffer,
  context: Pick<BaseAudioContext, 'createBuffer'>,
): AudioBuffer {
  const view = new DataView(bytes);
  const text = (offset: number, n: number) =>
    new TextDecoder().decode(new Uint8Array(bytes, offset, n));
  if (
    view.byteLength < 12 ||
    text(0, 4) !== 'FORM' ||
    !['AIFF', 'AIFC'].includes(text(8, 4))
  )
    throw Error('非 PCM AIFF 文件');
  let channels = 0,
    frames = 0,
    bits = 0,
    rate = 0,
    start = 0,
    end = 0,
    little = false;
  for (let p = 12; p + 8 <= view.byteLength;) {
    const kind = text(p, 4),
      size = view.getUint32(p + 4),
      body = p + 8;
    if (body + size > view.byteLength) throw Error('AIFF 区块截断');
    if (kind === 'COMM') {
      if (size < 18) throw Error('AIFF 参数截断');
      channels = view.getUint16(body);
      frames = view.getUint32(body + 2);
      bits = view.getUint16(body + 6);
      const exp = view.getUint16(body + 8);
      const mant =
        view.getUint32(body + 10) * 4294967296 + view.getUint32(body + 14);
      rate = mant * Math.pow(2, (exp & 32767) - 16383 - 63);
      if (exp & 32768) throw Error('AIFF 采样率无效');
      if (text(8, 4) === 'AIFC') {
        if (size < 22) throw Error('AIFC 压缩标识缺失');
        const codec = text(body + 18, 4);
        little = codec === 'sowt';
        if (!['NONE', 'twos', 'sowt'].includes(codec))
          throw Error('不支持此 AIFF 压缩编码：' + codec);
      }
    }
    if (kind === 'SSND') {
      if (size < 8) throw Error('AIFF 音频块截断');
      start = body + 8 + view.getUint32(body);
      end = body + size;
    }
    p = body + size + (size % 2);
  }
  if (
    channels < 1 ||
    channels > 32 ||
    !frames ||
    !Number.isFinite(rate) ||
    rate < 8000 ||
    rate > 192000 ||
    ![8, 16, 24, 32].includes(bits) ||
    !start ||
    start + frames * channels * (bits / 8) > end ||
    frames * channels * 4 > 256000000
  )
    throw Error('AIFF 参数或数据无效/超限');
  const buffer = context.createBuffer(channels, frames, rate);
  for (let c = 0; c < channels; c++) {
    const out = buffer.getChannelData(c);
    for (let i = 0; i < frames; i++) {
      const p = start + (i * channels + c) * (bits / 8);
      const sample =
        bits === 8
          ? view.getInt8(p)
          : bits === 16
            ? view.getInt16(p, little)
            : bits === 32
              ? view.getInt32(p, little)
              : little
                ? (view.getInt8(p + 2) << 16) |
                  (view.getUint8(p + 1) << 8) |
                  view.getUint8(p)
                : (view.getInt8(p) << 16) |
                  (view.getUint8(p + 1) << 8) |
                  view.getUint8(p + 2);
      out[i] = sample / Math.pow(2, bits - 1);
    }
  }
  return buffer;
}
