import { expect, it } from 'vitest';
import { rendererContentSecurityPolicy } from '../src/desktop/content-security';
it('桌面模型加载允许本地内嵌 glTF / blob 依赖，不允许远端或任意脚本', () => {
  const policy = rendererContentSecurityPolicy(),
    directives = Object.fromEntries(
      policy.split(';').map((s) => {
        const [key, ...values] = s.trim().split(/\s+/);
        return [key, values];
      }),
    );
  expect(directives['connect-src']).toEqual([
    "'self'",
    'swayframe-asset:',
    'blob:',
    'data:',
  ]);
  expect(directives['script-src']).toEqual(["'self'"]);
  expect(directives['object-src']).toEqual(["'none'"]);
  expect(policy).not.toMatch(/https?:|unsafe-eval|\*/);
  expect(rendererContentSecurityPolicy(true)).toContain('ws://127.0.0.1:5175');
});
