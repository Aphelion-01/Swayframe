/** Inline glTF buffers are data URLs; this grants no network destination. */
export function rendererContentSecurityPolicy(development = false) {
  return (
    "default-src 'self'; script-src 'self'" +
    (development ? " 'unsafe-inline'" : '') +
    "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: swayframe-asset:; connect-src 'self' swayframe-asset: blob: data:" +
    (development ? ' ws://127.0.0.1:5175' : '') +
    "; worker-src 'self' blob:; object-src 'none'; base-uri 'self'"
  );
}
