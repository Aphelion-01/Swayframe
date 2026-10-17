import {
  verifyExecutionState,
  verifyPixelEvidence,
} from '../agent/execution-verification';
import { expectsVisibleForeground } from '../agent/execution-verification';
import { ToolContextLoader } from '../agent/tool-context';
import { providerCapabilityProfile } from '../ai/provider-profile';
import { NativeSkillRuntime } from '../agent/native-skill-runtime';
import { registerSemanticActions } from '../agent/semantic-actions';
import { RecoveryController } from '../agent/recovery-controller';
import { creationGraphContext } from '../agent/creation-context';
import { UserEffectLibrary } from '../core/effect-library';
import {
  registerCreationTools,
  resolveCreationDetails,
} from '../agent/creation-planner';
import {
  resolveExecutionScope,
  validateCreationScope,
  creationDiff,
} from '../agent/creation-scope';
import type { ExecutionScope } from '../agent/creation-contracts';
import { compileGraph } from '../core/compositing-compiler';
import { registerEffectForgeTools } from '../agent/effect-forge-tools';
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
import { assertLegacyRuntime } from './agent-runtime-selection';
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
  registerSemanticActions(registry);
  registerEffectForgeTools(
    registry,
    undefined,
    (pixels, width, height) => {
      if (!manager.getSnapshot().settings.privacy.sendRenderPreview)
        return undefined;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      const image = ctx.createImageData(width, height);
      image.data.set(pixels);
      ctx.putImageData(image, 0, 0);
      return canvas.toDataURL('image/png');
    },
    () => new UserEffectLibrary(localStorage).all(),
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
  const intelligence = new VisualIntelligenceService({
    chat: (_task, request, signal, onText) =>
      recovery.chat(manager, 'visual', 'vision', request, signal, onText),
  });
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
  let executionScope: ExecutionScope | undefined;
  const allowed = () => {
    const reference = referenceToolScope(
      registry,
      chosen?.allowedTools,
      activeReferenceMode,
    );
    const available = registry
      .catalog()
      .filter((t) => !reference || reference.includes(t.name));
    return available
      .filter(
        (t) =>
          t.permission === 'READ' ||
          (!executionScope || executionScope.kind === 'FULL_COMPOSITION'
            ? ![
                'createComposition',
                'deleteComposition',
                'openComposition',
              ].includes(t.name)
            : executionScope.kind === 'PARAMETER_ONLY'
              ? ['setNodeParameter', 'effect_setParameter'].includes(t.name)
              : [
                  'setNodeParameter',
                  'effect_setParameter',
                  'enableNode',
                  'renameGraphNode',
                  'setNodePosition',
                  'createNode',
                  'deleteNode',
                  'connectNodes',
                  'disconnectEdge',
                ].includes(t.name)),
      )
      .map((t) => t.name);
  };
  const professional = new IntelligenceService(manager);
  let recovery = new RecoveryController();
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
          const tools = contracts
            .definitions()
            .filter((t) => !readNames.has(t.name));
          const proposal = await professional[name](
            {
              goal: args.goal,
              recovery,
              context: {
                scene: engine.build(
                  { ...captured, project: ctx.project, time: ctx.time },
                  8000,
                ),
                referenceMode: activeReferenceMode,
              },
              tools,
              images,
              validatePlan: (plan) => {
                registry.validatePlan(plan, allowed(), ctx);
                resolveCreationDetails(plan, registry, creation.capabilities());
              },
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
  const creation = registerCreationTools(
    registry,
    () => new UserEffectLibrary(localStorage).all(),
    () =>
      manager
        .getSnapshot()
        .settings.providers.filter((p) => p.enabled)
        .map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          model: p.defaultModel,
        })),
  );
  const nativeSkills = new NativeSkillRuntime(registry);
  const contracts = new ToolContextLoader(registry);
  const readToolNames = new Set(registry.readDefinitions().map((t) => t.name));
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
            const referenceFrames = manager.getSnapshot().settings.privacy
              .sendReferences
              ? references.flatMap((r) => r.frames)
              : [];
            const proposal = await intelligence.suggest(
              [...referenceFrames, ...images],
              {
                goal,
                referenceFrameCount: referenceFrames.length,
                referenceMode: activeReferenceMode,
                imageOrder:
                  'reference frames first, actual rendered frames after',
                frameTimes: [currentTime, ...times.slice(0, 2)],
                context: engine.build(
                  { ...captured, project, time: currentTime },
                  8000,
                ),
                diagnostics,
                tools: registry.definitions(allowed()),
              },
              signal,
              (plan) => runtime.validate(plan, project),
            );
            return {
              ...proposal,
              image,
              refinement: proposal.refinement ?? undefined,
            };
          },
        }
      : {}),
    executionMetadata: () => ({
      skillIds: nativeSkills
        .context()
        .map((s) => ({ id: s.id, version: s.version, hash: s.hash })),
      selectedCapabilities: contracts.metrics().loadedToolNames,
      registeredTools: registry.catalog().map((t) => t.name),
      availableCapabilities: creation.capabilities().map((c) => c.id),
    }),
    verifyExecution: async (base, draft, evidence, signal) => {
      const verified = verifyExecutionState(
        registry,
        base,
        draft,
        evidence,
        nativeSkills.validationRules(),
      );
      if (snapshotRenderer) {
        const c = activeComposition(draft);
        const times = [
          ...new Set([
            Math.min(captured.time, c.duration),
            ...c.layers
              .flatMap((l) =>
                layerProperties(l).flatMap((p) =>
                  p.property.keyframes.map((k) => k.time),
                ),
              )
              .sort((a, b) => a - b)
              .slice(-1),
          ]),
        ];
        for (const t of times) {
          const rendered = await snapshotRenderer.render(
            draft,
            t,
            signal,
            undefined,
            undefined,
            true,
          );
          const expectsForeground = expectsVisibleForeground(draft, t);
          if (rendered.pixelEvidence)
            verifyPixelEvidence(rendered.pixelEvidence, !!expectsForeground);
          else throw Error('真实渲染缺少像素证据');
        }
        verified.render = { status: 'PASSED', frames: times.length };
      }
      return verified;
    },
    project: store.commands.getSnapshot,
    setExecutionScope: (scope) => {
      executionScope = resolveExecutionScope(
        store.commands.getSnapshot(),
        scope ?? {
          kind: 'FULL_COMPOSITION',
          compositionId: store.commands.getSnapshot().activeCompositionId,
        },
      );
    },
    creationContext: () => ({
      scope: executionScope,
      strategy: ['modify-existing', 'reuse', 'compose', 'generate', 'forge'],
      capabilities: creation
        .capabilities()
        .filter(
          (c) =>
            c.availability === 'available' &&
            c.category !== 'command' &&
            c.category !== 'inspection' &&
            c.executionTools.some((tool) => allowed().includes(tool)),
        )
        .map((c) => ({
          id: c.id,
          executionTools: c.executionTools,
        })),
      ...creationGraphContext(captured.project, executionScope),
      unavailable: ['full Node Groups', 'image/video generation nodes'],
    }),
    setRecoveryController: (controller) => {
      recovery = controller;
    },
    preparePlan: (plan) => ({
      ...plan,
      creation: resolveCreationDetails(plan, registry, creation.capabilities()),
    }),
    reviewDraft: (base, next) => {
      const scope = executionScope ?? {
        kind: 'FULL_COMPOSITION' as const,
        compositionId: base.activeCompositionId,
      };
      validateCreationScope(base, next, scope);
      for (const l of activeComposition(next).layers)
        if (l.editor?.graph) {
          const old = activeComposition(base).layers.find((v) => v.id === l.id)
            ?.editor?.graph;
          if (old !== l.editor.graph) {
            const result = compileGraph(l.editor.graph);
            if (!result.valid)
              throw Error(result.diagnostics.map((d) => d.message).join('；'));
          }
        }
      return creationDiff(base, next, scope);
    },
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
      const nativeSkillContext = nativeSkills.route(
        prompt,
        manager.getSnapshot().settings.agent.nativeSkills !== false,
        manager.getSnapshot().settings.agent.disabledNativeSkills,
      );
      contracts.begin(
        prompt,
        allowed(),
        activeComposition(captured.project).layers.length === 0,
      );
      return {
        planningPreference: manager.planningPreference(),
        nativeSkills: nativeSkillContext.map((s) => ({
          id: s.id,
          version: s.version,
          hash: s.hash,
          instructions: s.instructions,
          actions: s.workflow.actions,
        })),
        availableTools: contracts.overview(),
        contextMetrics: contracts.metrics(),
        providerProfiles: manager
          .getSnapshot()
          .settings.providers.filter((p) => p.enabled)
          .map((p) => providerCapabilityProfile(p, p.defaultModel)),
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
    recoveryContext: (project) =>
      engine.build(
        { ...captured, project },
        manager.getSnapshot().settings.agent.contextCharacters,
      ),
    tools: () => contracts.definitions(),
    readTools: () =>
      contracts.definitions().filter((t) => readToolNames.has(t.name)),
    permission: (name, args) => registry.permission(name, args, allowed()),
    validate: (plan, project) => {
      nativeSkills.validate(plan, project ?? captured.project);
      registry.validatePlan(
        plan,
        allowed(),
        {
          ...captured,
          project: project ?? captured.project,
        },
        (base, next) => {
          if (executionScope) validateCreationScope(base, next, executionScope);
        },
      );
      resolveCreationDetails(plan, registry, creation.capabilities());
    },
    inspect: async (name, args, signal) => {
      const result = await registry.read(
        name,
        args,
        { ...captured, project: captured.project },
        signal,
        allowed(),
      );
      if (
        name === 'inspectToolContract' &&
        typeof args === 'object' &&
        args &&
        'names' in args &&
        Array.isArray(args.names)
      )
        contracts.load(
          args.names.filter((n): n is string => typeof n === 'string'),
        );
      return result;
    },
    begin: (project, authorization) => {
      assertLegacyRuntime(store);
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
        (base, next) => {
          if (executionScope) validateCreationScope(base, next, executionScope);
        },
      );
    },
  };
  const agent = new AgentOrchestrator(
    runtime,
    manager,
    () => manager.getSnapshot().settings,
  );
  const legacyRun = agent.run.bind(agent);
  agent.run = (...args) => {
    assertLegacyRuntime(store);
    return legacyRun(...args);
  };
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
