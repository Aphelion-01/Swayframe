import { getAIApplication } from '../ai/application';
import type { AIProviderManager } from '../ai/provider-manager';
import { AgentOrchestrator } from '../agent/orchestrator';
import { ProjectContextEngine } from '../agent/context-engine';
import { AgentToolRegistry } from '../agent/tool-registry';
import { registerReadTools } from '../agent/read-tools';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../agent/write-tools';
import { AgentTransaction } from '../agent/transaction';
import type { AgentRuntimePort } from '../agent/session';
import type { EditorStore } from './editor-store';
const agents = new WeakMap<EditorStore, AgentOrchestrator>();
export function createNativeAgent(
  store: EditorStore,
  manager: AIProviderManager = getAIApplication(),
) {
  const engine = new ProjectContextEngine(),
    registry = registerReadTools(
      registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
      engine,
    );
  const input = () => {
    const view = store.getSnapshot();
    return {
      project: store.commands.getSnapshot(),
      selection: view.selection,
      time: view.time,
      propertyId: view.frames[0]?.propertyId,
      transform: view.transformSettings,
      measure: store.textMeasure,
      recentCommands: store.commands.undoStack.slice(-5).map((h) => ({
        label: h.transaction.label,
        source: h.transaction.source,
      })),
    };
  };
  let captured = input();
  const runtime: AgentRuntimePort = {
    project: store.commands.getSnapshot,
    context: () => {
      captured = input();
      return engine.build(
        captured,
        manager.getSnapshot().settings.agent.contextCharacters,
      );
    },
    tools: () => registry.definitions(),
    readTools: () => registry.readDefinitions(),
    permission: (name, args) => registry.permission(name, args),
    validate: (plan) => registry.validatePlan(plan),
    inspect: (name, args, signal) =>
      registry.read(
        name,
        args,
        { ...captured, project: captured.project },
        signal,
      ),
    begin: (project, authorization) => {
      if (project !== captured.project) throw Error('工程上下文已变化');
      store.cancelDrag();
      store.setPlaying(false);
      return new AgentTransaction(
        {
          getSnapshot: store.commands.getSnapshot,
          executeTransaction: (tx) => {
            const before = store.commands.getSnapshot();
            const result = store.commands.executeTransaction(tx);
            if (result.ok) {
              const previous = new Set(
                before.compositions.flatMap((c) => c.layers.map((l) => l.id)),
              );
              const added = store.commands
                .getSnapshot()
                .compositions.flatMap((c) => c.layers)
                .filter((l) => !previous.has(l.id));
              if (added[0]) store.select(added[0].id);
            }
            return result;
          },
          applyWorkspace: (settings) => store.setTransformSettings(settings),
        },
        registry,
        project,
        captured,
        authorization?.destructiveConfirmed ?? false,
      );
    },
  };
  const agent = new AgentOrchestrator(
    runtime,
    manager,
    () => manager.getSnapshot().settings,
  );
  return { agent, registry, runtime };
}
export function nativeAgentFor(store: EditorStore) {
  let agent = agents.get(store);
  if (!agent) {
    agent = createNativeAgent(store).agent;
    agents.set(store, agent);
  }
  return agent;
}
