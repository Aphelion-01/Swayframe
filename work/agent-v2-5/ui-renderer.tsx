import { createRoot } from 'react-dom/client';
import { AgentV2Lab } from '../../src/ui/AgentV2Lab';
import { AIProviderManager } from '../../src/ai/provider-manager';
import { defaultAISettings } from '../../src/ai/contracts';
import { benchmarks } from '../../src/agent-v2/benchmarks';
import '../../src/ui/design-tokens.css';
import '../../src/ui/base.css';
import '../../src/ui/editor-theme.css';
const api = (window as any).ui;
const delay = (n) => new Promise((r) => setTimeout(r, n));
async function main() {
  try {
    const settings = defaultAISettings(),
      p = {
        id: crypto.randomUUID(),
        name: 'OFFLINE FIXTURE（不调用 API）',
        type: 'openai-compatible' as const,
        enabled: true,
        baseUrl: 'http://localhost',
        defaultModel: 'fixture',
        models: [
          { id: 'fixture', name: 'Fixture', capabilities: ['text' as const] },
        ],
      };
    settings.providers = [p];
    settings.defaultProviderId = p.id;
    const d = new Map();
    let calls = 0;
    const manager = new AIProviderManager(
      {
        loadSettings: async () => settings,
        saveSettings: async () => {},
        setCredentials: async () => {},
        removeCredentials: async () => {},
        hasCredentials: async () => true,
        storageStatus: async () => 'memory-only',
        readData: async (k) => d.get(k),
        writeData: async (k, v) => {
          d.set(k, v);
        },
      },
      {
        chat: async (_p, r) => {
          calls++;
          return {
            model: 'fixture',
            text: '',
            toolCalls: [
              {
                id: 'fixture',
                name: r.toolChoice!,
                arguments: benchmarks[1].intent,
              },
            ],
          };
        },
        listModels: async () => [],
        testConnection: async () => ({ ok: true, message: 'offline' }),
      },
    );
    await manager.initialize();
    createRoot(document.getElementById('root')!).render(
      <AgentV2Lab manager={manager} onClose={() => {}} />,
    );
    await delay(250);
    const button = (t) =>
      [...document.querySelectorAll<HTMLButtonElement>('button')].find(
        (b) => b.textContent === t,
      )!;
    const textarea = document.querySelector('textarea')!;
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )!.set!.call(textarea, '创建 Cubic 文字，字体 serif、字号96、白色。');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(100);
    const disabledDefault = button('执行隔离任务').disabled;
    document.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    await delay(100);
    button('执行隔离任务').click();
    for (let i = 0; i < 100 && button('接受到隔离工程').disabled; i++)
      await delay(50);
    const pending = !button('接受到隔离工程').disabled;
    const screenshots = [];
    for (const [w, h] of [
      [1280, 720],
      [1440, 900],
      [1920, 1080],
      [2560, 1440],
    ])
      screenshots.push(await api.shot(w, h));
    button('接受到隔离工程').click();
    await delay(100);
    const undoEnabled = !button('Undo').disabled;
    button('Undo').click();
    await delay(150);
    const redoEnabled = !button('Redo').disabled;
    button('Redo').click();
    await delay(150);
    await api.done({
      pass:
        disabledDefault && pending && undoEnabled && redoEnabled && calls === 1,
      disabledDefault,
      pending,
      undoEnabled,
      redoEnabled,
      fixtureModelRequests: calls,
      actualPaidRequests: 0,
      screenshots,
    });
  } catch (e) {
    await api.done({ pass: false, error: String(e) });
  }
}
void main();
