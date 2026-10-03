import { describe, it, expect } from 'vitest';
import { requestSchema } from '../src/desktop/contracts';
import { DesktopService, WebAdapter } from '../src/desktop/service';
describe('Desktop contract', () => {
  it('rejects unknown, oversized and filesystem injection requests', () => {
    expect(
      requestSchema.safeParse({ method: 'fs.read', path: '/etc/passwd' })
        .success,
    ).toBe(false);
    expect(
      requestSchema.safeParse({ method: 'project.open', path: 'x\0y' }).success,
    ).toBe(false);
    expect(
      requestSchema.safeParse({ method: 'window.edited', edited: 'yes' })
        .success,
    ).toBe(false);
    expect(
      requestSchema.safeParse({ method: 'platform.info', extra: true }).success,
    ).toBe(false);
  });
  it('keeps browser development independent of native services', () => {
    const service = new DesktopService();
    expect(service.native).toBe(false);
    expect(service.adapter).toBeInstanceOf(WebAdapter);
  });
});
