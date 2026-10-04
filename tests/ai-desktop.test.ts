import { expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
vi.mock('electron', () => ({ safeStorage: {} }));
import { NativeAIService } from '../apps/desktop/electron/ai-service';
import type { SecretEncryption } from '../apps/desktop/electron/ai-service';
import { defaultAISettings } from '../src/ai/contracts';
import { requestSchema } from '../src/desktop/contracts';
const id = '00000000-0000-4000-8000-000000000111';
function encryption(): SecretEncryption {
  const key = randomBytes(32);
  return {
    available: async () => true,
    encrypt: async (data) => {
      const iv = randomBytes(12),
        cipher = createCipheriv('aes-256-gcm', key, iv);
      const bytes = Buffer.concat([cipher.update(data), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), bytes]);
    },
    decrypt: async (bytes) => {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        bytes.subarray(0, 12),
      );
      decipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString();
    },
  };
}
it('persists encrypted credentials separately, restores on reopen and does not return plaintext through settings', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sf-ai-'));
  try {
    const secure = encryption();
    const service = new NativeAIService(dir, secure);
    const settings = defaultAISettings();
    settings.providers = [
      {
        id,
        name: 'test',
        type: 'openai-compatible',
        baseUrl: 'https://example.com/v1',
        enabled: true,
        defaultModel: 'model',
        models: [],
      },
    ];
    await service.dispatch({ method: 'ai.settings.save', settings });
    await service.dispatch({
      method: 'ai.credentials.set',
      providerId: id,
      credentials: {
        apiKey: 'SECRET_NOT_IN_METADATA',
        headers: { 'X-Private': 'PRIVATE_HEADER' },
      },
    });
    const bytes = await fs.readFile(path.join(dir, 'ai', `secret-${id}.bin`));
    expect(bytes.toString()).not.toContain('SECRET_NOT_IN_METADATA');
    expect(bytes.toString()).not.toContain('PRIVATE_HEADER');
    expect(
      (await fs.stat(path.join(dir, 'ai', `secret-${id}.bin`))).mode & 0o777,
    ).toBe(0o600);
    expect(JSON.stringify(await service.settings())).not.toContain('SECRET');
    const reopened = new NativeAIService(dir, secure);
    expect(
      await reopened.dispatch({ method: 'ai.credentials.has', providerId: id }),
    ).toBe(true);
    await reopened.dispatch({
      method: 'ai.credentials.remove',
      providerId: id,
    });
    expect(
      await reopened.dispatch({ method: 'ai.credentials.has', providerId: id }),
    ).toBe(false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
it('fails closed in production, uses only transient development secrets, and rejects arbitrary IPC paths/settings secrets', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sf-ai-'));
  try {
    const unavailable: SecretEncryption = {
      available: async () => false,
      encrypt: async () => {
        throw Error();
      },
      decrypt: async () => {
        throw Error();
      },
    };
    const production = new NativeAIService(dir, unavailable, false);
    await expect(
      production.dispatch({
        method: 'ai.credentials.set',
        providerId: id,
        credentials: { apiKey: 'secret', headers: {} },
      }),
    ).rejects.toThrow('安全存储');
    const development = new NativeAIService(dir, unavailable, true);
    await development.dispatch({
      method: 'ai.credentials.set',
      providerId: id,
      credentials: { apiKey: 'secret', headers: {} },
    });
    expect(await development.dispatch({ method: 'ai.storage.status' })).toBe(
      'memory-only',
    );
    expect(
      await new NativeAIService(dir, unavailable, true).dispatch({
        method: 'ai.credentials.has',
        providerId: id,
      }),
    ).toBe(false);
    expect(
      requestSchema.safeParse({ method: 'ai.data.read', key: '../../secret' })
        .success,
    ).toBe(false);
    expect(
      requestSchema.safeParse({
        method: 'ai.settings.save',
        settings: { ...defaultAISettings(), apiKey: 'secret' },
      }).success,
    ).toBe(false);
    await expect(
      production.dispatch({
        method: 'ai.chat',
        providerId: id,
        requestId: crypto.randomUUID(),
        request: {
          model: 'model',
          messages: [{ role: 'user', content: 'test' }],
        },
      }),
    ).rejects.toThrow('服务尚未配置');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
