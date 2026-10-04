// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  AgentSnapshotRenderer,
  VisualIntelligenceService,
  visualDiagnostics,
} from '../src/agent/vision';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import { AIProviderManager } from '../src/ai/provider-manager';
import { createAIPlatform } from '../src/ai/platform';
import { MockAIProvider } from '../src/ai/mock-provider';
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
it('actual shared renderer produces bounded snapshot without handles and cleans resources', async () => {
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    transform: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    'data:image/png;base64,AAAA',
  );
  const p = createDefaultProject(),
    layer = createLayer('solid');
  const project = {
    ...p,
    compositions: [{ ...p.compositions[0]!, layers: [layer] }],
  };
  const result = await new AgentSnapshotRenderer().render(
    project,
    0,
    new AbortController().signal,
  );
  expect(result).toMatchObject({ width: 720, height: 405 });
  expect(ctx.scale).toHaveBeenCalledWith(0.375, 0.375);
  expect(ctx.fillRect).toHaveBeenCalledTimes(2);
  expect(ctx.restore).toHaveBeenCalled();
});
it('vision service receives real image and returns only validated Proposal, never mutates project', async () => {
  const platform = createAIPlatform(undefined, true),
    manager = new AIProviderManager(platform.storage, platform.transport);
  await manager.initialize();
  const id = crypto.randomUUID();
  await manager.saveProvider({
    id,
    name: 'Vision Mock',
    type: 'mock',
    baseUrl: 'https://example.invalid',
    enabled: true,
    defaultModel: 'vision',
    models: [
      { id: 'vision', name: 'vision', capabilities: ['vision', 'text'] },
    ],
  });
  const handler = vi.fn(async () => ({
    text: '',
    model: 'vision',
    toolCalls: [
      {
        id: 'check',
        name: 'submitVisualAssessment',
        arguments: { ok: true, message: 'Readable', refinement: null },
      },
    ],
  }));
  manager.register(new MockAIProvider(id, 'Mock', handler));
  const p = createDefaultProject(),
    original = JSON.stringify(p);
  const proposal = await new VisualIntelligenceService(manager).suggest(
    'data:image/png;base64,AAAA',
    { goal: 'Title', context: p.name },
    new AbortController().signal,
  );
  expect(proposal.ok).toBe(true);
  expect(handler).toHaveBeenCalled();
  expect(handler.mock.calls[0]).toBeDefined();
  expect(JSON.stringify(p)).toBe(original);
  expect(Object.isFrozen(proposal)).toBe(true);
});
it('offscreen entrance is a warning, not a fake successful vision result', () => {
  const p = createDefaultProject(),
    l = createLayer('rectangle', { position: { x: -1000, y: 540 } });
  const diagnostics = visualDiagnostics(
    { ...p, compositions: [{ ...p.compositions[0]!, layers: [l] }] },
    0,
  );
  expect(diagnostics.warnings[0]).toContain('之外');
});
