import { it, expect } from 'vitest';
import { assertRepairTargets } from '../src/agent/recovery-controller';
import { AgentExecutionError } from '../src/agent/execution-error';
const error = (
  code: 'TOOL_ARGUMENT_INVALID' | 'OBJECT_REFERENCE_INVALID',
  field: string,
) =>
  new AgentExecutionError({
    code,
    phase: 'resolve',
    field,
    message: 'fixture',
    recoverable: true,
  });
it('argument recovery cannot silently redirect an existing layer, nested graph node or array target', () => {
  for (const [before, after] of [
    [
      { layerId: 'A', radius: -1 },
      { layerId: 'B', radius: 1 },
    ],
    [{ from: { nodeId: 'A' } }, { from: { nodeId: 'B' } }],
    [{ layerIds: ['A'] }, { layerIds: ['B'] }],
  ])
    expect(() =>
      assertRepairTargets(
        before,
        after,
        error('TOOL_ARGUMENT_INVALID', 'radius'),
      ),
    ).toThrow('无关');
});
it('only the actual failed reference field may be repaired; unrelated target stays fixed', () => {
  expect(() =>
    assertRepairTargets(
      { layerId: 'bad', nodeId: 'N' },
      { layerId: 'real', nodeId: 'N' },
      error('OBJECT_REFERENCE_INVALID', 'layerId'),
    ),
  ).not.toThrow();
  expect(() =>
    assertRepairTargets(
      { layerId: 'bad', nodeId: 'N' },
      { layerId: 'real', nodeId: 'M' },
      error('OBJECT_REFERENCE_INVALID', 'layerId'),
    ),
  ).toThrow();
});
