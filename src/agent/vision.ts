import { z } from 'zod';
import type { Project } from '../core/project-model';
import { activeComposition } from '../core/project-model';
import { createRenderSnapshot } from '../core/renderer-core';
import { Canvas2DRenderer } from '../renderers/canvas2d';
import { compileGraph } from '../core/compositing-compiler';
import { getWorldBounds } from '../core/layer-bounds';
import { AIError } from '../ai/contracts';
import type { AIProviderManager } from '../ai/provider-manager';
import { agentPlanSchema } from './session';
import type { AgentPlan } from './session';
export const visualProposalSchema = z
  .object({
    ok: z.boolean(),
    message: z.string().min(1).max(2000),
    refinement: agentPlanSchema.nullable(),
  })
  .strict();
export type VisualProposal = z.infer<typeof visualProposalSchema>;
/** Per-action images are session data. This service can only return proposals. */
export class VisualIntelligenceService {
  constructor(private readonly manager: Pick<AIProviderManager, 'chat'>) {}
  async suggest(
    image: string | readonly string[],
    context: unknown,
    signal: AbortSignal,
    validateRefinement?: (plan: AgentPlan) => void,
  ): Promise<VisualProposal> {
    const request = {
      messages: [
        {
          role: 'system' as const,
          content:
            'Evaluate the actual rendered frames against the requested goal and supplied reference frames. Read imageOrder/referenceFrameCount in context; never confuse reference with actual output. Explicitly compare composition, geometry/faces, color/gradient, blur/feather, lighting/shadow, typography and hierarchy. Name actual differences in message; refinements must target existing IDs and preserve text when requested. Check clipping, readability, overlap, scale, color and blank output. Animation entrance may intentionally start offscreen. Return submitVisualAssessment only. For local refinement omit optional creation metadata; capability IDs must be exact registered IDs, never invent categories such as layer.fill. A refinement is a proposal with registered tools; never direct Scene writes, code or deletion. If acceptable set ok=true and refinement=null.',
        },
        {
          role: 'user' as const,
          content: JSON.stringify(context),
          images: typeof image === 'string' ? [image] : [...image],
        },
      ],
      tools: [
        {
          name: 'submitVisualAssessment',
          description:
            'Structured visual assessment and optional bounded refinement proposal',
          parameters: z.toJSONSchema(visualProposalSchema) as Record<
            string,
            unknown
          >,
        },
      ],
      toolChoice: 'submitVisualAssessment',
      stream: false,
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await this.manager.chat('vision', request, signal);
      try {
        if (
          response.toolCalls.length !== 1 ||
          response.toolCalls[0]?.name !== 'submitVisualAssessment'
        )
          throw new AIError('invalid_response', '视觉模型未返回完整检查结果');
        const proposal = visualProposalSchema.parse(
          response.toolCalls[0].arguments,
        );
        if (proposal.ok && proposal.refinement)
          throw new AIError('invalid_response', '视觉检查结果矛盾');
        if (proposal.refinement) validateRefinement?.(proposal.refinement);
        return Object.freeze(proposal);
      } catch (error) {
        signal.throwIfAborted();
        if (attempt === 1) throw error;
        request.messages.push({
          role: 'user',
          content:
            'Your visual assessment was rejected without applying its refinement: ' +
            (error instanceof Error ? error.message : String(error)) +
            '. Return one corrected submitVisualAssessment using the exact registered tool schemas and existing object IDs. Omit optional creation metadata for local parameter edits.',
          images: [],
        });
      }
    }
    throw new AIError('invalid_response', '视觉建议自动纠正后仍未通过');
  }
}
export class AgentSnapshotRenderer {
  async render(
    project: Project,
    time: number,
    signal: AbortSignal,
    compositionId = project.activeCompositionId,
    scale?: number,
    capturePixels = false,
  ) {
    signal.throwIfAborted();
    const c = project.compositions.find((c) => c.id === compositionId);
    if (!c || time < 0 || time > c.duration) throw Error('渲染合成或时间无效');
    const renderer = new Canvas2DRenderer(),
      canvas = document.createElement('canvas');
    try {
      await renderer.syncAssets(project.assets);
      signal.throwIfAborted();
      const s = Math.min(scale ?? 1, 720 / Math.max(c.width, c.height), 1);
      const snapshot = createRenderSnapshot(c, time, [], undefined, project);
      await renderer.prepareMedia(snapshot);
      signal.throwIfAborted();
      renderer.render(snapshot, canvas, 1, false, s);
      renderer.assertNoEffectErrors();
      if (!canvas.getContext('2d')) throw Error('画布渲染不可用');
      signal.throwIfAborted();
      const image = canvas.toDataURL('image/png');
      if (image.length > 2000000) throw Error('预览超过视觉请求大小限制');
      let pixelEvidence;
      if (capturePixels) {
        const ctx = canvas.getContext('2d')!;
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const bg = c.backgroundColor ?? {
          r: 17 / 255,
          g: 24 / 255,
          b: 39 / 255,
          a: 1,
        };
        let foregroundPixels = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (
            pixels[i + 3]! > 0 &&
            (Math.abs(pixels[i]! - bg.r * 255) > 3 ||
              Math.abs(pixels[i + 1]! - bg.g * 255) > 3 ||
              Math.abs(pixels[i + 2]! - bg.b * 255) > 3)
          )
            foregroundPixels++;
        pixelEvidence = {
          width: canvas.width,
          height: canvas.height,
          foregroundPixels,
        };
      }
      return {
        image,
        ...(pixelEvidence ? { pixelEvidence } : {}),
        width: canvas.width,
        height: canvas.height,
        time,
        compositionId,
      };
    } finally {
      renderer.dispose();
      canvas.width = canvas.height = 1;
    }
  }
}
export function visualDiagnostics(project: Project, time: number) {
  const c = activeComposition(project),
    snapshot = createRenderSnapshot(c, time, [], undefined, project);
  const warnings: string[] = [];
  for (const item of snapshot.layers) {
    if (!item.source.visible || item.active === false) continue;
    const graph = item.source.editor?.graph;
    if (graph && !compileGraph(graph).valid)
      throw Error('合成图无法渲染：' + item.source.name);
    const b = getWorldBounds(item, time);
    if (
      b &&
      (b.maxX < 0 || b.maxY < 0 || b.minX > c.width || b.minY > c.height)
    )
      warnings.push(item.source.name + ' 在画面之外（可能是入场动画）');
  }
  return {
    visibleLayers: snapshot.layers.filter(
      (l) => l.source.visible && l.active !== false,
    ).length,
    warnings: warnings.slice(0, 20),
  };
}
