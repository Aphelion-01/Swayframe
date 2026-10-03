import { useState } from 'react';
import { DEMO_PROMPT } from '../core/agent-contracts';
import { bridgeFor } from './agent-controller';
import type { EditorStore } from './editor-store';

export function AgentPanel({ store }: { store: EditorStore }) {
  const [prompt, setPrompt] = useState(DEMO_PROMPT);
  return (
    <section className="agent-panel" aria-label="助手演示">
      <div className="agent-heading">
        <span>✦ 创作助手</span>
        <span>模拟</span>
      </div>
      <p>先生成可编辑的入场动画，再继续手动调整。</p>
      <textarea
        aria-label="助手提示词"
        rows={3}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <button
        className="agent-run"
        onClick={() => {
          store.cancelDrag();
          store.setPlaying(false);
          const result = bridgeFor(store).runDemo(prompt);
          if (result.ok) {
            store.select(result.layerId!);
            store.setTime(1);
            store.setStatus('助手已创建入场动画 · 可继续编辑');
          } else store.setStatus(result.error, true);
        }}
      >
        生成入场动画 ↗
      </button>
      <small>本地固定演示 · 无需密钥</small>
    </section>
  );
}
