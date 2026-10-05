import { IntelligenceService } from '../agent/intelligence';
import { activeComposition, layerProperties } from '../core/project-model';
import { agentLibraryFor, registerPresetTools } from '../agent/library';
import { referenceToolScope } from '../agent/references';
import type { AgentReference, ReferenceMode } from '../agent/references';
import { z } from 'zod';
import { idSchema } from '../core/project-schema';
import { AIError } from '../ai/contracts';
import {
  AgentSnapshotRenderer,
  VisualIntelligenceService,
  visualDiagnostics,
} from '../agent/vision';
import { registerCompositingTools } from '../agent/compositing-tools';
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
      registerCompositingTools(
        registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
      ),
      engine,
    );
  const library = agentLibraryFor(manager.storage);
  registerPresetTools(registry, library);
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
  const snapshotRenderer =
    typeof CanvasRenderingContext2D !== 'undefined'
      ? new AgentSnapshotRenderer()
      : undefined;
  const intelligence = new VisualIntelligenceService(manager);
  if (snapshotRenderer)
    registry.register(
      'renderFrame',
      '真实合成预览，最长边720像素；不会含选择框',
      z
        .object({
          compositionId: idSchema.optional(),
          time: z.number().nonnegative().optional(),
          scale: z.number().positive().max(1).optional(),
        })
        .strict(),
      'READ',
      {
        read: async (ctx, args, signal) => {
          const result = await snapshotRenderer.render(
            ctx.project,
            args.time ?? ctx.time,
            signal,
            args.compositionId,
            args.scale,
          );
          return manager.getSnapshot().settings.privacy.sendRenderPreview
            ? result
            : {
                width: result.width,
                height: result.height,
                privacy: '预览发送已关闭',
              };
        },
      },
    );
  let captured = input();
  const skills = skillsFor(manager.storage);
  let skillId = 'auto';
  let chosen: AgentSkill | undefined;
  let references: readonly AgentReference[] = [];
  let referenceMode: ReferenceMode = 'overall';
  let activeReferenceMode: ReferenceMode | undefined;
  const allowed = () =>
    referenceToolScope(registry, chosen?.allowedTools, activeReferenceMode);
  const professional = new IntelligenceService(manager);
  for (const name of [
    'analyzeLayout',
    'analyzeColor',
    'analyzeTypography',
    'analyzeMotion',
    'analyzeReference',
  ] as const) {
    registry.register(
      name,
      '只返回专业 Proposal，由 Agent 决定是否转换成共享命令',
      z.object({ goal: z.string().min(1).max(1000) }).strict(),
      'READ',
      {
        read: async (ctx, args, signal) => {
          const privacy = manager.getSnapshot().settings.privacy;
          const images: string[] = [];
          if (name === 'analyzeReference') {
            if (!references.length) throw Error('请先添加参考');
            if (!privacy.sendReferences) throw Error('隐私设置禁止发送参考');
            images.push(...references.flatMap((r) => r.frames));
          } else if (snapshotRenderer && privacy.sendRenderPreview) {
            try {
              manager.resolve('vision');
              images.push(
                (await snapshotRenderer.render(ctx.project, ctx.time, signal))
                  .image,
              );
            } catch (error) {
              if (!(error instanceof AIError && error.code === 'setup'))
                throw error;
            }
          }
          const readNames = new Set(
            registry.readDefinitions().map((t) => t.name),
          );
          const tools = registry
            .definitions(allowed())
            .filter((t) => !readNames.has(t.name));
          const proposal = await professional[name](
            {
              goal: args.goal,
              context: {
                scene: engine.build(
                  { ...captured, project: ctx.project, time: ctx.time },
                  8000,
                ),
                referenceMode: activeReferenceMode,
              },
              tools,
              images,
            },
            signal,
          );
          registry.validatePlan(proposal.plan, allowed());
          return proposal;
        },
      },
    );
  }
  let goal = '';
  const runtime: AgentRuntimePort = {
    ...(snapshotRenderer
      ? {
          render: async (project, signal) =>
            (
              await snapshotRenderer.render(
                project,
                Math.min(captured.time, activeComposition(project).duration),
                signal,
              )
            ).image,
          verify: async (project, signal) => {
            const currentTime = Math.min(
              captured.time,
              activeComposition(project).duration,
            );
            const diagnostics = visualDiagnostics(project, currentTime);
            const { image } = await snapshotRenderer.render(
              project,
              currentTime,
              signal,
            );
            if (!manager.getSnapshot().settings.privacy.sendRenderPreview)
              return {
                ok: true,
                message: '本地渲染通过；隐私设置禁止发送预览，未做模型视觉检查',
                image,
              };
            try {
              manager.resolve('vision');
            } catch (e) {
              if (e instanceof AIError && e.code === 'setup')
                return {
                  ok: true,
                  message: '本地渲染通过；未配置视觉模型，未做模型视觉检查',
                  image,
                };
              throw e;
            }
            const keyTimes = activeComposition(project)
              .layers.filter(
                (l) =>
                  !captured.selection.length ||
                  captured.selection.includes(l.id),
              )
              .flatMap((l) =>
                layerProperties(l).flatMap((p) =>
                  p.property.keyframes.map((k) => k.time),
                ),
              )
              .filter((t) => t <= activeComposition(project).duration);
            const times = [
              ...new Set(
                keyTimes.length
                  ? [Math.min(...keyTimes), Math.max(...keyTimes)]
                  : [],
              ),
            ].filter((t) => t !== currentTime);
            const images = [image];
            for (const time of times.slice(0, 2))
              images.push(
                (await snapshotRenderer.render(project, time, signal)).image,
              );
            const proposal = await intelligence.suggest(
              images,
              {
                goal,
                frameTimes: [currentTime, ...times.slice(0, 2)],
                context: engine.build(
                  { ...captured, project, time: currentTime },
                  8000,
                ),
                diagnostics,
                tools: registry.definitions(allowed()),
              },
              signal,
            );
            return {
              ...proposal,
              image,
              refinement: proposal.refinement ?? undefined,
            };
          },
        }
      : {}),
    project: store.commands.getSnapshot,
    setReferences: (value, mode) => {
      references = value;
      referenceMode = mode;
    },
    setSkill: (id) => {
      if (id !== 'auto') skills.choose('', id);
      skillId = id;
    },
    context: (prompt) => {
      activeReferenceMode =
        references.length &&
        manager.getSnapshot().settings.privacy.sendReferences
          ? referenceMode
          : undefined;
      goal = prompt;
      captured = input();
      chosen = skills.choose(
        prompt,
        skillId === 'auto'
          ? manager.getSnapshot().settings.agent.defaultSkill
          : skillId,
      );
      if (chosen.requiredCapabilities?.length) {
        const route = manager.resolve(
          activeReferenceMode ? 'vision' : 'planning',
        );
        const capabilities =
          manager.models.resolve(route.provider.id, route.model)
            ?.capabilities ?? [];
        if (
          chosen.requiredCapabilities.some((cap) => !capabilities.includes(cap))
        )
          throw new AIError(
            'setup',
            '当前模型不满足该 Skill 的能力要求，请调整模型路由',
          );
      }
      return {
        ...engine.build(
          captured,
          manager.getSnapshot().settings.agent.contextCharacters,
        ),
        skill: { id: chosen.id, instructions: chosen.instructions },
        references: manager.getSnapshot().settings.privacy.sendReferences
          ? references.map((r) => ({
              id: r.id,
              name: r.name,
              kind: r.kind,
              frames: r.frames.length,
            }))
          : [],
        referenceMode: references.length ? referenceMode : undefined,
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
              if (
                before.activeCompositionId !==
                store.commands.getSnapshot().activeCompositionId
              ) {
                store.setTime(0);
                store.select(null);
              }
              const previous = new Set(
                before.compositions.flatMap((c) => c.layers.map((l) => l.id)),
              );
              const added = store.commands
                .getSnapshot()
                .compositions.filter(
                  (c) =>
                    c.id === store.commands.getSnapshot().activeCompositionId,
                )
                .flatMap((c) => c.layers)
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
  let previousSession = '';
  agent.subscribe(() => {
    const session = agent.getSnapshot();
    if (
      ['completed', 'failed', 'cancelled'].includes(session.status) &&
      session.sessionId !== previousSession
    ) {
      previousSession = session.sessionId;
      if (manager.getSnapshot().settings.privacy.saveHistory)
        void library
          .record(store.commands.getSnapshot(), session)
          .catch(() => {});
    }
  });
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
