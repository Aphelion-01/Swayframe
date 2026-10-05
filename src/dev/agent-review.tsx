/** Isolated UI acceptance fixture. Scripted MockProvider exercises real product services. */
import { useState, useSyncExternalStore, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AgentPanel } from '../ui/AgentPanel';
import { Canvas } from '../ui/Canvas';
import { Timeline } from '../ui/Timeline';
import { Inspector } from '../ui/Inspector';
import { ToolProvider } from '../ui/workspace/tools';
import { AISettings } from '../ui/ai/AISettings';
import { EditorStore } from '../ui/editor-store';
import { createNativeAgent } from '../ui/native-agent-controller';
import { AIProviderManager } from '../ai/provider-manager';
import { defaultAISettings, AIError } from '../ai/contracts';
import type { AIStorage } from '../ai/contracts';
import { createAIPlatform } from '../ai/platform';
import { MockAIProvider } from '../ai/mock-provider';
import {
  agentFixture,
  agentFixturePlan,
  agentCaseNames,
} from './agent-fixtures';
import { activeComposition } from '../core/project-model';
import { saveProject, loadProject } from '../core/project-io';
import '../ui/design-tokens.css';
import '../ui/base.css';
import '../ui/editor-theme.css';
import '../ui/ai/ai.css';
function bundle(index: number) {
  let settings = defaultAISettings();
  const data = new Map<string, unknown>();
  const storage: AIStorage = {
    loadSettings: async () => settings,
    saveSettings: async (s) => {
      settings = s;
    },
    setCredentials: async () => {},
    removeCredentials: async () => {},
    hasCredentials: async () => true,
    storageStatus: async () => 'memory-only',
    readData: async (k) => data.get(k) ?? null,
    writeData: async (k, v) => {
      data.set(k, v);
    },
  };
  const manager = new AIProviderManager(
      storage,
      createAIPlatform(undefined, true).transport,
    ),
    store = new EditorStore(agentFixture());
  const layers = activeComposition(store.commands.getSnapshot()).layers;
  store.select(layers[0]!.id);
  if (index === 4) store.select(layers[1]!.id, true);
  if (index === 2) store.select(layers[2]!.id);
  const { agent } = createNativeAgent(store, manager);
  const ready = (async () => {
    await manager.initialize();
    if (index === 7) return;
    if (index === 5) {
      const reference = document.createElement('canvas');
      reference.width = 720;
      reference.height = 405;
      const ctx = reference.getContext('2d')!;
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, 720, 405);
      ctx.fillStyle = '#4477aa';
      ctx.fillRect(220, 110, 140, 100);
      agent.setReferences(
        [
          {
            id: crypto.randomUUID(),
            name: 'QA-layout.png',
            kind: 'image',
            frames: [reference.toDataURL('image/png')],
          },
        ],
        'layout-only',
      );
      reference.width = reference.height = 1;
    }
    for (const [i, id] of [
      crypto.randomUUID(),
      crypto.randomUUID(),
    ].entries()) {
      if (i && index !== 6) continue;
      await manager.saveProvider({
        id,
        name: i ? 'QA Mock B' : 'QA Mock A',
        type: 'mock',
        baseUrl: 'https://example.invalid',
        enabled: true,
        defaultModel: 'qa-vision',
        models: [
          {
            id: 'qa-vision',
            name: 'QA vision',
            capabilities: ['text', 'vision'],
          },
        ],
      });
      manager.register(
        new MockAIProvider(id, 'QA', async (request, signal) => {
          if (index === 6 && i === 0)
            throw new AIError('rate_limit', 'QA 模拟限流');
          if (index === 8)
            await new Promise<void>((_r, reject) =>
              signal?.addEventListener(
                'abort',
                () => reject(new AIError('cancelled', '已停止')),
                { once: true },
              ),
            );
          if (request.toolChoice === 'submitVisualAssessment')
            return {
              text: '',
              model: 'qa-vision',
              toolCalls: [
                {
                  id: 'visual',
                  name: 'submitVisualAssessment',
                  arguments: {
                    ok: true,
                    message: `Mock 验证接收到 ${request.messages.at(-1)?.images?.length ?? 0} 帧真实渲染（模型响应为测试固定结果）`,
                    refinement: null,
                  },
                },
              ],
            };
          if (index === 2 && request.toolChoice === 'submitProposal')
            return {
              text: '只读文字设计建议',
              model: 'qa-vision',
              toolCalls: [
                {
                  id: 'professional',
                  name: 'submitProposal',
                  arguments: agentFixturePlan(
                    index,
                    store.commands.getSnapshot(),
                  ),
                },
              ],
            };
          if (index === 2 && !request.messages.some((m) => m.role === 'tool'))
            return {
              text: '先分析真实画面',
              model: 'qa-vision',
              toolCalls: [
                {
                  id: 'analyze',
                  name: 'analyzeTypography',
                  arguments: { goal: '改善标题大小、字距与层级' },
                },
              ],
            };
          return {
            text: 'QA structured plan',
            model: 'qa-vision',
            toolCalls: [
              {
                id: 'plan',
                name: 'submitPlan',
                arguments: agentFixturePlan(
                  index,
                  store.commands.getSnapshot(),
                ),
              },
            ],
          };
        }),
      );
    }
  })();
  return { store, manager, agent, ready };
}
function Review() {
  const [index, setIndex] = useState(0),
    [fixture, setFixture] = useState(() => bundle(0)),
    [settings, setSettings] = useState(false);
  const view = useSyncExternalStore(
      fixture.store.subscribe,
      fixture.store.getSnapshot,
    ),
    session = useSyncExternalStore(
      fixture.agent.subscribe,
      fixture.agent.getSnapshot,
    );
  useEffect(() => {
    void fixture.ready;
    return () => fixture.agent.stop();
  }, [fixture]);
  return (
    <ToolProvider>
      <div
        style={{
          height: '100vh',
          display: 'grid',
          gridTemplateRows: '42px minmax(0,1fr) 220px',
          background: 'var(--bg-app)',
        }}
      >
        <header
          className="qa-toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            position: 'relative',
            zIndex: 10,
            whiteSpace: 'nowrap',
          }}
        >
          <strong>Agent V1 · 独立 Mock 协议验收</strong>
          <select
            aria-label="Agent 验收场景"
            style={{ width: 180 }}
            value={index}
            onChange={(e) => {
              const next = Number(e.target.value);
              setIndex(next);
              setFixture(bundle(next));
            }}
          >
            {agentCaseNames.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
          <button onClick={() => setSettings(true)}>AI 设置</button>
          <button
            onClick={() => {
              const saved = fixture.store.save();
              fixture.store.load(saved);
            }}
          >
            保存并重新载入
          </button>
          <span>真实 Command / Renderer · 无第三方 API 调用</span>
        </header>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '320px minmax(0,1fr) 280px',
            minHeight: 0,
          }}
        >
          <div style={{ overflow: 'auto', padding: 12 }}>
            <AgentPanel
              store={fixture.store}
              agent={fixture.agent}
              manager={fixture.manager}
            />
          </div>
          <Canvas store={fixture.store} />
          <Inspector store={fixture.store} />
        </div>
        <Timeline store={fixture.store} />
        {settings && (
          <AISettings
            manager={fixture.manager}
            onClose={() => setSettings(false)}
          />
        )}
        <pre
          aria-label="Agent 验收诊断"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            maxWidth: 600,
            maxHeight: 70,
            overflow: 'auto',
            fontSize: 9,
            background: '#111',
            pointerEvents: 'none',
          }}
        >
          {JSON.stringify({
            status: session.status,
            undo: fixture.store.commands.undoStack.length,
            images: [session.beforeSnapshot, session.afterSnapshot].filter(
              Boolean,
            ).length,
            verification: session.verification,
            roundtrip:
              saveProject(loadProject(fixture.store.save())) ===
              fixture.store.save(),
            layers: activeComposition(view.project).layers.map((l) => ({
              name: l.name,
              type: l.type,
              keyframes: l.transform.position.keyframes.length,
              scale: l.transform.scale.baseValue,
              position: l.transform.position.baseValue,
              nodes: l.editor?.graph?.nodes.map((n) => n.type),
            })),
          })}
        </pre>
      </div>
    </ToolProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Review />);
