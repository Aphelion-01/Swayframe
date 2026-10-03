import { AgentBridge } from '../core/agent-contracts';
import type { EditorStore } from './editor-store';

export const bridgeFor = (store: EditorStore): AgentBridge =>
  new AgentBridge({
    getProjectSnapshot: store.commands.getSnapshot,
    executeTransaction: (tx) => store.commands.executeTransaction(tx),
    getCurrentTime: () => store.getSnapshot().time,
    getSelection: () => store.getSnapshot().selection,
    undoLastTransaction: () => store.commands.undo(),
  });
