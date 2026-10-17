import { validateIntent } from '../../src/agent-v2/planner';
import { createRoot } from 'react-dom/client';
import { AgentV2Lab } from '../../src/ui/AgentV2Lab';
import { AIProviderManager } from '../../src/ai/provider-manager';
import { defaultAISettings } from '../../src/ai/contracts';
const fixture = {
  goal: 'Offline text and recovery',
  actions: [
    {
      id: 'title',
      type: 'createText',
      content: 'Cubic',
      fontFamily: 'serif',
      fontSize: 48,
      color: { r: 1, g: 1, b: 1, a: 1 },
    },
    {
      id: 'font',
      type: 'setProperty',
      target: { kind: 'result', actionId: 'title' },
      property: 'fontSize',
      value: 96,
    },
    {
      id: 'opacity',
      type: 'setProperty',
      target: { kind: 'result', actionId: 'title' },
      property: 'opacity',
      value: 2,
    },
  ],
};
import '../../src/ui/design-tokens.css';
import '../../src/ui/base.css';
import '../../src/ui/editor-theme.css';
const api = (window as any).ui;
const delay = (n) => new Promise((r) => setTimeout(r, n));
async function main() {
  try {
    validateIntent(fixture);
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
    let calls = 0,
      failing = false;
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
                arguments:
                  r.toolChoice === 'repairAction'
                    ? { ...fixture.actions[2], value: failing ? 2 : 0.5 }
                    : fixture,
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
    if (!pending)
      throw Error(
        'No validated result: ' +
          document.querySelector('[role=alert]')?.textContent,
      );
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
    failing = true;
    button('执行隔离任务').click();
    for (let i = 0; i < 100 && !button('检查未完成草稿'); i++) await delay(50);
    const failedInspection =
      !!button('检查未完成草稿') && button('接受到隔离工程').disabled;
    button('检查未完成草稿').click();
    await delay(200);
    screenshots.push(await api.shot(1280, 720, 'failed-prefix'));
    const preservedInput = textarea.value.includes('Cubic');
    const partialLabel =
      document.body.textContent!.includes('仅供检查，不代表任务通过');
    await api.done({
      pass:
        disabledDefault &&
        pending &&
        undoEnabled &&
        redoEnabled &&
        calls === 4 &&
        failedInspection &&
        preservedInput &&
        partialLabel,
      disabledDefault,
      pending,
      undoEnabled,
      redoEnabled,
      fixtureModelRequests: calls,
      actualPaidRequests: 0,
      failedInspection,
      preservedInput,
      partialLabel,
      screenshots,
    });
  } catch (e) {
    await api.done({
      pass: false,
      error: String(e),
      body: document.body.innerText.slice(0, 12000),
    });
  }
}
void main();
