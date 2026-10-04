import { skillsFor } from '../agent/skills';
import type { AgentSkill } from '../agent/skills';
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
  const skills = skillsFor(manager.storage);
  let skillId = 'auto';
  let chosen: AgentSkill | undefined;
  const allowed = () => chosen?.allowedTools;
  const runtime: AgentRuntimePort = {
    project: store.commands.getSnapshot,
    setSkill: (id) => {
      if (id !== 'auto') skills.choose('', id);
      skillId = id;
    },
    context: (prompt) => {
      captured = input();
      chosen = skills.choose(
        prompt,
        skillId === 'auto'
          ? manager.getSnapshot().settings.agent.defaultSkill
          : skillId,
      );
      return {
        ...engine.build(
          captured,
          manager.getSnapshot().settings.agent.contextCharacters,
        ),
        skill: { id: chosen.id, instructions: chosen.instructions },
      };
    },
    tools: () => registry.definitions(allowed()),
    readTools: () =>
      registry
        .readDefinitions()
        .filter((t) => !allowed() || allowed()!.includes(t.name)),
    permission: (name, args) => registry.permission(name, args, allowed()),
    validate: (plan) => registry.validatePlan(plan, allowed()),
    inspect: (name, args, signal) =>
      registry.read(
        name,
        args,
        { ...captured, project: captured.project },
        signal,
        allowed(),
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
        allowed(),
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
