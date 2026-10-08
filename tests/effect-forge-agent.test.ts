import { expect, it } from 'vitest';
import { registerEffectForgeTools } from '../src/agent/effect-forge-tools';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import { AgentTransaction } from '../src/agent/transaction';
import { CommandSystem } from '../src/core/command-system';
import { EffectForgeWorkspace } from '../src/core/effect-forge';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { organicTextureSource } from '../src/core/effect-examples';
function setup() {
  const p = createDefaultProject(),
    layer = createLayer('rectangle'),
    host = new CommandSystem({
      ...p,
      compositions: [{ ...p.compositions[0]!, layers: [layer] }],
    }),
    workspace = new EffectForgeWorkspace(),
    registry = registerEffectForgeTools(new AgentToolRegistry(), workspace),
    ctx = { project: host.getSnapshot(), selection: [layer.id], time: 0 },
    signal = new AbortController().signal;
  return { layer, host, workspace, registry, ctx, signal };
}
it('searches native blur and radial gradient and adds native nodes through transaction without creating custom packages', async () => {
  const s = setup();
  for (const [query, id] of [
    ['blur', 'gaussianBlur'],
    ['radial', 'radialGradient'],
  ]) {
    const found = (await s.registry.read(
      'effect_search',
      { query },
      s.ctx,
      s.signal,
    )) as { matches: { id: string }[] };
    expect(found.matches.some((d) => d.id === id)).toBe(true);
    const tx = new AgentTransaction(s.host, s.registry, s.host.getSnapshot(), {
      selection: [s.layer.id],
      time: 0,
    });
    await tx.execute(
      'effect_addToLayer',
      { id, layerId: s.layer.id },
      s.signal,
    );
    expect(
      tx
        .getSnapshot()
        .compositions[0]!.layers[0]!.editor!.graph!.nodes.some(
          (n) => n.type === id,
        ),
    ).toBe(true);
  }
  expect(s.workspace.all()).toHaveLength(0);
});
it('generates a new declarative draft and applies only a previewed evaluated package through one undoable transaction', async () => {
  const s = setup(),
    source = organicTextureSource();
  source.program.instructions[0] = { op: 'v' };
  source.id = 'agentMadeTexture';
  source.name = 'Agent 自定义纹理';
  const created = (await s.registry.read(
    'effect_createDraft',
    { source },
    s.ctx,
    s.signal,
  )) as { draftId: string };
  const args = { draftId: created.draftId };
  expect(() =>
    s.registry.compile(
      'effect_applyDraft',
      { ...args, layerId: s.layer.id },
      s.ctx,
    ),
  ).toThrow();
  for (const name of ['effect_validate', 'effect_compile', 'effect_preview'])
    await s.registry.read(name, args, s.ctx, s.signal);
  await s.registry.read(
    'effect_evaluate',
    { ...args, note: '真实像素已生成；该测试不声称视觉创作目标通过' },
    s.ctx,
    s.signal,
  );
  const tx = new AgentTransaction(s.host, s.registry, s.host.getSnapshot(), {
    selection: [s.layer.id],
    time: 0,
  });
  await tx.execute(
    'effect_applyDraft',
    { ...args, layerId: s.layer.id },
    s.signal,
  );
  expect(
    s.host
      .getSnapshot()
      .compositions[0]!.layers[0]!.editor!.graph!.nodes.some(
        (n) => n.effectPackage,
      ),
  ).toBe(false);
  const result = tx.commit('应用程序化效果');
  expect(result.transactionId).toBeTruthy();
  expect(
    s.host
      .getSnapshot()
      .compositions[0]!.layers[0]!.editor!.graph!.nodes.some(
        (n) => n.effectPackage?.id === 'agentMadeTexture',
      ),
  ).toBe(true);
  expect(s.host.undo().ok).toBe(true);
  expect(
    s.host
      .getSnapshot()
      .compositions[0]!.layers[0]!.editor!.graph!.nodes.some(
        (n) => n.effectPackage,
      ),
  ).toBe(false);
  expect(s.host.redo().ok).toBe(true);
  const save = await s.registry.read(
    'effect_saveReusable',
    args,
    s.ctx,
    s.signal,
  );
  expect(save).toMatchObject({ requiresUserAcceptance: true });
});
