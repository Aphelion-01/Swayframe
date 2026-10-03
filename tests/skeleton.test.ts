import { describe, expect, it } from 'vitest';
import config from '../package.json';

describe('工程启动契约', () => {
  it('提供所有必需质量门禁和启动命令', () => {
    for (const name of ['dev', 'build', 'typecheck', 'lint', 'test']) {
      expect(config.scripts).toHaveProperty(name);
    }
  });
});
