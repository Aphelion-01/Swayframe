/** Opt-in integration check: configured model, synthetic scene, no library writes. */
import { app, nativeImage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NativeAIService } from '../apps/desktop/electron/ai-service';
import { compileEffect } from '../src/core/programmable-effect';
import { EffectForgeWorkspace } from '../src/core/effect-forge';
import { registerEffectForgeTools } from '../src/agent/effect-forge-tools';
import { AgentToolRegistry } from '../src/agent/tool-registry';
import { AgentTransaction } from '../src/agent/transaction';
import { CommandSystem } from '../src/core/command-system';
import { createDefaultProject, createLayer } from '../src/core/project-model';
import type { ChatRequest, ChatResponse } from '../src/ai/contracts';
async function main() {
  app.setName('Swayframe');
  console.log('live-check: starting');
  const output = path.resolve('outputs/effect-boundaries');
  await fs.mkdir(output, { recursive: true });
  await app.whenReady();
  const report: Record<string, unknown> = {
    syntheticScene: true,
    refinedExistingModelDraft: process.argv.includes('--refine'),
    libraryWritten: false,
    attempts: [],
  };
  try {
    const service = new NativeAIService(
      path.join(app.getPath('appData'), 'Swayframe'),
      undefined,
      false,
      async (url, init) => {
        const response = await fetch(url, init);
        report.httpStatus = response.status;
        if (!response.ok) {
          const detail = await response
            .clone()
            .json()
            .catch(() => ({}));
          report.providerDiagnostic = String(
            detail.error?.message ??
              detail.message ??
              detail.error?.code ??
              'unknown',
          )
            .replace(/Bearer\s+[^\s]+/gi, '[redacted]')
            .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
            .slice(0, 400);
        }
        return response;
      },
    );
    const settings = await service.settings();
    console.log('live-check: settings loaded');
    const provider = settings.providers.find(
      (p) => p.enabled && p.type !== 'mock',
    );
    if (!provider) throw Error('没有启用的真实服务');
    report.model = provider.defaultModel;
    const workspace = new EffectForgeWorkspace();
    const registry = registerEffectForgeTools(
      new AgentToolRegistry(),
      workspace,
    );
    const p = createDefaultProject(),
      layer = createLayer('rectangle');
    const host = new CommandSystem({
      ...p,
      compositions: [{ ...p.compositions[0]!, layers: [layer] }],
    });
    const ctx = { project: host.getSnapshot(), selection: [layer.id], time: 0 };
    const signal = new AbortController().signal;
    const messages: ChatRequest['messages'] = [
      {
        role: 'system',
        content:
          'You create validated Swayframe declarative pixel effects. Use effect_createDraft to return a new generator. No code or external resources. Instruction args are zero-based references to earlier instructions. Output rgba indices refer to instructions. noise takes 3 arguments; parameter references must exist. generator inputs=[], outputs=[{id:"out",name:"Image",type:"Image"}], dependencies=[]. Runtime declarative-pixel-v1. Format swayframe.effect.v1. Use a concise program below 40 instructions.',
      },
      {
        role: 'user',
        content:
          'Create an original animated blue-violet procedural wave texture with a SIMPLE single sinusoidal band (not layered). Keep fewer than 25 instructions. Expose density (float), speed (float), and two color parameters. Use u,v,time with sin and mix; opaque alpha. Color parameters MUST have type color and four normalized RGBA components between 0 and 1 (not 0..255). E.g. [0.15,0.3,0.9,1]. Every scalar instruction requires exact arity: sin/cos/abs/sqrt/floor 1; add/subtract/multiply/divide/min/max 2; clamp/mix/smoothstep/noise 3. All args reference earlier indices. All parameters animatable. id liveWaveTexture, version 1.0.0. Call effect_createDraft with the complete source.',
      },
    ];
    if (process.argv.includes('--refine')) {
      const previous = JSON.parse(
        await fs.readFile(path.join(output, 'live-model.sfe.json'), 'utf8'),
      );
      delete previous.contentHash;
      messages.push(
        { role: 'assistant', content: JSON.stringify(previous) },
        {
          role: 'user',
          content:
            'Refine the previous actual model-generated package. It is valid, animated, but its mix args are in the wrong order. mix(a,b,t) = a+(b-a)*t. Fix each mix instruction from [weight,colorA,colorB] to [colorA,colorB,weight]. Preserve all other instructions, parameter values, and RGBA indices. Return full source with effect_createDraft. This must stay between the two specified colors.',
        },
      );
    }
    let draftId: string | undefined;
    for (let attempt = 0; attempt < 3 && !draftId; attempt++) {
      console.log(`live-check: model request ${attempt + 1}`);
      const response = (await service.dispatch({
        method: 'ai.chat',
        providerId: provider.id,
        requestId: randomUUID(),
        request: {
          model: provider.defaultModel,
          messages,
          tools: registry.definitions(['effect_createDraft']),
          toolChoice: 'effect_createDraft',
          stream: false,
        },
      })) as ChatResponse;
      const call = response.toolCalls.find(
        (c) => c.name === 'effect_createDraft',
      );
      try {
        if (!call) throw Error('模型未返回要求的工具调用');
        const created = (await registry.read(
          call.name,
          call.arguments,
          ctx,
          signal,
        )) as { draftId: string };
        const candidate = workspace.get(created.draftId).package;
        if (candidate.parameters.filter((p) => p.type === 'color').length < 2)
          throw Error('两个颜色参数必须使用color类型和0..1 RGBA');
        const render = compileEffect(candidate);
        const pixels0 = render.render(
          {},
          { width: 192, height: 108, time: 0, frame: 0 },
        );
        const pixels1 = render.render(
          {},
          { width: 192, height: 108, time: 0.5, frame: 15 },
        );
        const samples = Array.from(pixels0).filter((_, i) => i % 4 === 0);
        if (Math.max(...samples) - Math.min(...samples) < 8)
          throw Error(
            '真实像素缺少空间变化；请修复输出索引、mix权重和归一化颜色',
          );
        if (pixels0.every((v, i) => v === pixels1[i]))
          throw Error('time参数未使真实像素产生动画，请将time*speed参与相位');
        const colors = candidate.parameters
          .filter((p) => p.type === 'color')
          .map((p) => p.defaultValue as number[]);
        if (
          pixels0.some(
            (v, i) =>
              i % 4 < 3 &&
              (v < Math.min(colors[0]![i % 4]!, colors[1]![i % 4]!) * 255 - 2 ||
                v > Math.max(colors[0]![i % 4]!, colors[1]![i % 4]!) * 255 + 2),
          )
        )
          throw Error(
            '颜色超出colorA与colorB范围，mix参数顺序必须是[colorA分量索引,colorB分量索引,0..1权重索引]',
          );
        report.pixelChecks = {
          spatialVariation: true,
          animated: true,
          colorBounds: true,
        };
        draftId = created.draftId;
        (report.attempts as unknown[]).push({
          attempt: attempt + 1,
          valid: true,
          usage: response.usage,
        });
      } catch (e) {
        await fs.writeFile(
          path.join(output, `model-attempt-${attempt + 1}.json`),
          JSON.stringify(call?.arguments ?? response.text, null, 2),
        );
        const diagnostic = e instanceof Error ? e.message : '验证失败';
        (report.attempts as unknown[]).push({
          attempt: attempt + 1,
          valid: false,
          diagnostic,
          usage: response.usage,
        });
        if (call)
          messages.push(
            {
              role: 'assistant',
              content: response.text,
              toolCalls: response.toolCalls.map((c) => ({
                id: c.id,
                name: c.name,
                arguments: JSON.stringify(c.arguments),
              })),
            },
            {
              role: 'tool',
              toolCallId: call.id,
              content: `Validation failed: ${diagnostic}. Correct the entire source.`,
            },
          );
        else
          messages.push(
            { role: 'assistant', content: response.text },
            { role: 'user', content: diagnostic },
          );
      }
    }
    if (!draftId) throw Error('三次模型输出均未通过验证');
    const args = { draftId };
    for (const name of ['effect_validate', 'effect_compile', 'effect_preview'])
      await registry.read(name, args, ctx, signal);
    const draft = workspace.get(draftId),
      preview = draft.preview!;
    await fs.writeFile(
      path.join(output, 'live-model.sfe.json'),
      JSON.stringify(draft.package, null, 2),
    );
    const bitmap = Buffer.from(preview.pixels);
    for (let i = 0; i < bitmap.length; i += 4) {
      const r = bitmap[i]!;
      bitmap[i] = bitmap[i + 2]!;
      bitmap[i + 2] = r;
    }
    await fs.writeFile(
      path.join(output, 'live-model.png'),
      nativeImage
        .createFromBitmap(bitmap, {
          width: preview.width,
          height: preview.height,
        })
        .toPNG(),
    );
    await registry.read(
      'effect_evaluate',
      { ...args, note: '真实模型生成，实际像素预览已输出；视觉检查另行记录。' },
      ctx,
      signal,
    );
    const tx = new AgentTransaction(host, registry, host.getSnapshot(), {
      selection: [layer.id],
      time: 0,
    });
    await tx.execute(
      'effect_applyDraft',
      { ...args, layerId: layer.id },
      signal,
    );
    const untouchedBeforeCommit = !host
      .getSnapshot()
      .compositions[0]!.layers[0]!.editor?.graph?.nodes.some(
        (n) => n.effectPackage,
      );
    tx.commit('真实模型效果验证');
    report.transaction = {
      untouchedBeforeCommit,
      applied: host
        .getSnapshot()
        .compositions[0]!.layers[0]!.editor?.graph?.nodes.some(
          (n) => n.effectPackage?.contentHash === draft.package.contentHash,
        ),
      undo: host.undo().ok,
      redo: host.redo().ok,
    };
    report.contentHash = draft.package.contentHash;
    report.success = true;
  } catch (e) {
    report.success = false;
    report.error = e instanceof Error ? e.message : '集成验证失败';
  } finally {
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(
      path.join(output, 'live-model-report.json'),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
    app.exit(report.success ? 0 : 1);
  }
}
void main();
