import { isDeepStrictEqual } from 'node:util';
import { creationGraphContext } from '../src/agent/creation-context';
/** Opt-in real Provider test on an isolated synthetic scene. Never writes the library. */
import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NativeAIService } from '../apps/desktop/electron/ai-service';
import { ProjectContextEngine } from '../src/agent/context-engine';
import { AgentOrchestrator } from '../src/agent/orchestrator';
import { AgentTransaction } from '../src/agent/transaction';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import {
  registerCoreWriteTools,
  registerAnimationTools,
} from '../src/agent/write-tools';
import { registerReadTools } from '../src/agent/read-tools';
import { registerCompositingTools } from '../src/agent/compositing-tools';
import {
  registerCreationTools,
  resolveCreationDetails,
} from '../src/agent/creation-planner';
import {
  resolveExecutionScope,
  validateCreationScope,
  creationDiff,
} from '../src/agent/creation-scope';
import type { ExecutionScope } from '../src/agent/creation-contracts';
import {
  createDefaultProject,
  activeComposition,
  createLayer,
} from '../src/core/project-model';
import { CommandSystem } from '../src/core/command-system';
import { compileGraph } from '../src/core/compositing-compiler';
import { saveProject, loadProject } from '../src/core/project-io';
import type { ChatResponse } from '../src/ai/contracts';
import type { AgentRuntimePort } from '../src/agent/session';
async function main() {
  app.setName('Swayframe');
  await app.whenReady();
  const nodeOnly = process.argv.includes('--node');
  const streaming = process.argv.includes('--stream');
  const output = path.resolve(
    streaming
      ? 'outputs/agent-creation/live-stream-regression'
      : nodeOnly
        ? 'outputs/agent-creation/live-node'
        : 'outputs/agent-creation/live-followup',
  );
  await fs.mkdir(output, { recursive: true });
  const report: Record<string, unknown> = {
    syntheticScene: true,
    libraryWritten: false,
    requests: [],
  };
  const timer = setTimeout(() => {
    report.success = false;
    report.error = 'Provider validation timeout';
    void fs
      .writeFile(
        path.join(output, 'live-report.json'),
        JSON.stringify(report, null, 2),
      )
      .finally(() => app.exit(1));
  }, 180000);
  try {
    const service = new NativeAIService(
      path.join(app.getPath('appData'), 'Swayframe'),
    );
    const settings = await service.settings();
    const route = settings.routing.planning ?? settings.routing.general;
    const provider = settings.providers.find(
      (p) =>
        p.enabled &&
        p.type !== 'mock' &&
        p.id === (route?.providerId ?? settings.defaultProviderId),
    );
    if (!provider) throw Error('没有启用的真实 Provider');
    report.providerType = provider.type;
    const model = route?.modelId ?? provider.defaultModel;
    report.model = model;
    const base = createDefaultProject(),
      camera = createLayer('camera'),
      target = createLayer('rectangle'),
      nodeId = randomUUID();
    const host = new CommandSystem({
      ...base,
      compositions: [
        {
          ...base.compositions[0]!,
          layers: nodeOnly ? [camera, target] : [camera],
        },
      ],
    });
    const registry = registerReadTools(
      registerCompositingTools(
        registerAnimationTools(registerCoreWriteTools(new AgentToolRegistry())),
      ),
    );
    const creation = registerCreationTools(registry);
    if (nodeOnly) {
      const setup = new AgentTransaction(host, registry, host.getSnapshot(), {
        time: 0,
        selection: [],
      });
      const signal = new AbortController().signal;
      await setup.execute(
        'createNode',
        { layerId: target.id, type: 'gaussianBlur', nodeId },
        signal,
      );
      await setup.execute(
        'setNodeParameter',
        { nodeId, key: 'radius', value: 20 },
        signal,
      );
      setup.commit('Synthetic fixture');
    }
    let scope: ExecutionScope = {
      kind: 'FULL_COMPOSITION',
      compositionId: base.activeCompositionId,
    };
    const focusedTools = [
      'createLayer',
      'createText',
      'createRectangle',
      'setPosition',
      'setFill',
      'setOpacity',
      'addKeyframe',
      'setInterpolation',
      'createNode',
      'setNodeParameter',
      'connectNodes',
      'disconnectEdge',
      'setGraphOutput',
      'renameGraphNode',
      'layoutGraph',
      'inspectGraph',
      'inspectGraphNode',
      'inspectGraphBranch',
      'getCanvasInfo',
      'listLayers',
      'inspectLayer',
      'discoverCapabilities',
    ];
    const allowed = () =>
      nodeOnly
        ? ['setNodeParameter']
        : scope.kind === 'FULL_COMPOSITION'
          ? registry
              .definitions()
              .map((d) => d.name)
              .filter((n) => focusedTools.includes(n))
              .filter(
                (n) =>
                  ![
                    'createComposition',
                    'deleteComposition',
                    'openComposition',
                  ].includes(n),
              )
          : registry
              .definitions()
              .map((d) => d.name)
              .filter(
                (n) =>
                  (focusedTools.includes(n) &&
                    registry.readDefinitions().some((d) => d.name === n)) ||
                  [
                    'setNodeParameter',
                    'effect_setParameter',
                    'enableNode',
                    'renameGraphNode',
                    'setNodePosition',
                  ].includes(n),
              );
    const context = () => ({
      project: host.getSnapshot(),
      time: 0,
      selection: [],
    });
    const runtime: AgentRuntimePort = {
      project: host.getSnapshot,
      context: () => new ProjectContextEngine().build(context(), 8000),
      tools: () => registry.definitions(allowed()),
      readTools: () =>
        nodeOnly
          ? []
          : registry
              .readDefinitions()
              .filter((d) => allowed().includes(d.name)),
      inspect: (name, args, signal) =>
        registry.read(name, args, context(), signal, allowed()),
      setExecutionScope: (input) => {
        scope = resolveExecutionScope(
          host.getSnapshot(),
          input ?? {
            kind: 'FULL_COMPOSITION',
            compositionId: host.getSnapshot().activeCompositionId,
          },
        );
      },
      creationContext: () => ({
        scope,
        capabilities: creation
          .capabilities()
          .filter((c) =>
            nodeOnly
              ? c.id.toLowerCase().includes('gaussian')
              : c.category !== 'command' && c.category !== 'motion-preset',
          ),
        ...creationGraphContext(host.getSnapshot(), scope, 8000),
      }),
      permission: (name, args) => registry.permission(name, args, allowed()),
      validate: (p, project) =>
        registry.validatePlan(
          p,
          allowed(),
          {
            project: project ?? host.getSnapshot(),
            time: 0,
            selection: [],
          },
          (base, next) => {
            if (scope) validateCreationScope(base, next, scope);
          },
        ),
      preparePlan: (p) => ({
        ...p,
        creation: resolveCreationDetails(p, registry, creation.capabilities()),
      }),
      begin: (p, authorization) =>
        new AgentTransaction(
          host,
          registry,
          p,
          { time: 0, selection: [] },
          authorization?.destructiveConfirmed,
          allowed(),
          (a, b) => validateCreationScope(a, b, scope),
        ),
      reviewDraft: (a, b) => {
        validateCreationScope(a, b, scope);
        for (const l of activeComposition(b).layers)
          if (l.editor?.graph && !compileGraph(l.editor.graph).valid)
            throw Error('Graph compile failed');
        return creationDiff(a, b, scope);
      },
    };
    const agent = new AgentOrchestrator(
      runtime,
      {
        chat: async (_task, request, signal) => {
          signal?.throwIfAborted();
          console.log('Real Provider planning request');
          const response = (await service.dispatch({
            method: 'ai.chat',
            providerId: provider.id,
            requestId: randomUUID(),
            request: {
              ...request,
              model,
              stream: streaming,
            },
          })) as ChatResponse;
          (report.requests as unknown[]).push({
            usage: response.usage,
            toolCalls: response.toolCalls.map((c) => c.name),
            readArguments: response.toolCalls
              .filter((c) => c.name !== 'submitPlan')
              .map((c) => ({ name: c.name, arguments: c.arguments })),
          });
          return response;
        },
      },
      () => ({
        ...settings,
        agent: { ...settings.agent, mode: 'AGENT', streaming },
      }),
    );
    const run = async (prompt: string, input?: ExecutionScope) => {
      const before = host.getSnapshot();
      await agent.run(prompt, input);
      const state = agent.getSnapshot();
      if (state.error || !state.currentPlan)
        throw Error(state.error ?? '没有计划');
      await fs.writeFile(
        path.join(output, input ? 'live-branch-plan.json' : 'live-plan.json'),
        JSON.stringify(state.currentPlan, null, 2),
      );
      await agent.preview(state.currentPlan.id);
      const preview = agent.getSnapshot();
      if (preview.error || !preview.creationProposal)
        throw Error(preview.error ?? '没有预览方案');
      if (host.getSnapshot() !== before)
        throw Error('Preview mutated formal scene');
      await fs.writeFile(
        path.join(
          output,
          input ? 'live-branch-proposal.json' : 'live-proposal.json',
        ),
        JSON.stringify(preview.creationProposal, null, 2),
      );
      await agent.apply(state.currentPlan.id);
      if (agent.getSnapshot().status !== 'completed')
        throw Error(agent.getSnapshot().error ?? '提交失败');
    };
    if (nodeOnly) {
      const before = host.getSnapshot();
      await run(
        '仅将所选Gaussian Blur节点的radius从20改为35，复用已有节点，不改变其他内容。',
        {
          kind: 'PARAMETER_ONLY',
          compositionId: before.activeCompositionId,
          layerId: target.id,
          nodeIds: [nodeId],
        },
      );
      const final = host.getSnapshot();
      const diff = creationDiff(before, final, scope);
      if (
        diff.parameters.length !== 1 ||
        diff.parameters[0]?.before !== 20 ||
        diff.parameters[0]?.after !== 35
      )
        throw Error('Expected exactly radius 20→35');
      if (!isDeepStrictEqual(loadProject(saveProject(final)), final))
        throw Error('Roundtrip mismatch');
      await fs.writeFile(
        path.join(output, 'live-final.swayframe'),
        saveProject(final),
      );
      host.undo();
      if (JSON.stringify(host.getSnapshot()) !== JSON.stringify(before))
        throw Error('Undo mismatch');
      report.node = {
        radius: 35,
        previewDidNotMutate: true,
        scopeProtected: true,
        singleUndo: true,
        saveReload: true,
      };
      report.success = true;
      return;
    }
    await run(
      '在当前合成创建蓝色径向渐变背景，背景同一Graph中接入柔和Glow（不是给文字加Glow），另建原生可编辑文字SWAYFRAME，文字在0至1秒从下方移动到画面中心，同时0至0.4秒淡入。只使用原生radialGradient和glow，无需噪声、图片、Forge或新建合成。背景使用solid图层，width1920 height1080，位置960,540以覆盖全画布。节点语义命名并自动布局，不修改已有摄像机。',
    );
    const created = host.getSnapshot();
    const text = activeComposition(created).layers.find(
      (l) => l.type === 'text',
    );
    const background = activeComposition(created).layers.find((l) =>
      l.editor?.graph?.nodes.some((n) => n.type === 'radialGradient'),
    );
    const glow = background?.editor?.graph?.nodes.find(
      (n) => n.type === 'glow',
    );
    if (
      !text ||
      text.text !== 'SWAYFRAME' ||
      text.transform.position.keyframes.length < 2 ||
      !glow ||
      !background
    )
      throw Error('模型未完成原生文字/动画/渐变/Glow验收');
    await fs.writeFile(
      path.join(output, 'live-created.swayframe'),
      saveProject(created),
    );
    report.creation = {
      editableText: true,
      nativeAnimation: true,
      gradient: true,
      glow: true,
      transactions: host.undoStack.length,
    };
    await run(
      '只把这个背景分支的径向渐变改为紫色，并将已有Glow强度amount稍微调低。必须保留已有节点ID和连接，只修改已有参数，别添加或删除节点，不改文字、动画或摄像机。',
      {
        kind: 'SELECTED_BRANCH',
        compositionId: created.activeCompositionId,
        layerId: background.id,
        nodeIds: [glow.id],
      },
    );
    const final = host.getSnapshot();
    if (
      JSON.stringify(
        activeComposition(final).layers.find((l) => l.id === text.id),
      ) !== JSON.stringify(text)
    )
      throw Error('文字发生改变');
    if (
      JSON.stringify(
        activeComposition(final).layers.find((l) => l.id === camera.id),
      ) !== JSON.stringify(camera)
    )
      throw Error('摄像机发生改变');
    const loaded = loadProject(saveProject(final));
    if (!isDeepStrictEqual(loaded, final)) throw Error('Roundtrip mismatch');
    await fs.writeFile(
      path.join(output, 'live-final.swayframe'),
      saveProject(final),
    );
    host.undo();
    if (JSON.stringify(host.getSnapshot()) !== JSON.stringify(created))
      throw Error('Undo mismatch');
    report.branch = {
      preservedTextAndAnimation: true,
      preservedCamera: true,
      previewDidNotMutate: true,
      singleUndo: true,
      saveReload: true,
    };
    report.success = true;
  } catch (error) {
    report.success = false;
    report.error =
      error instanceof Error
        ? error.message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
        : 'Live integration failed';
  } finally {
    clearTimeout(timer);
    await fs.writeFile(
      path.join(output, 'live-report.json'),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
    app.exit(report.success ? 0 : 1);
  }
}
void main();
