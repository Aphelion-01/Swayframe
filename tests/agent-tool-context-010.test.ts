import { it, expect } from 'vitest';
import { ToolContextLoader } from '../src/agent/tool-context';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { registerSemanticActions } from '../src/agent/semantic-actions';
it('loads relevant authoritative contracts, dynamically expands, and never widens permissions', () => {
  const r = registerSemanticActions(
    registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
  );
  const loader = new ToolContextLoader(r);
  const allowed = r
    .catalog()
    .map((t) => t.name)
    .filter((t) => t !== 'deleteLayer');
  loader.begin('创建 Cubic 标题', allowed);
  expect(loader.definitions().some((t) => t.name === 'createText')).toBe(true);
  expect(loader.definitions().some((t) => t.name === 'createPath')).toBe(false);
  expect(loader.metrics().selectedSchemaCharacters).toBeLessThan(
    loader.metrics().fullSchemaCharacters,
  );
  loader.load(['createPath', 'deleteLayer']);
  expect(loader.definitions().some((t) => t.name === 'createPath')).toBe(true);
  expect(loader.definitions().some((t) => t.name === 'deleteLayer')).toBe(
    false,
  );
});
