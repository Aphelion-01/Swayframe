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
  constructor(private readonly manager: AIProviderManager) {}
  async suggest(
    image: string | readonly string[],
    context: unknown,
    signal: AbortSignal,
  ): Promise<VisualProposal> {
    const response = await this.manager.chat(
      'vision',
      {
        messages: [
          {
            role: 'system',
            content:
              'Evaluate the actual rendered frame against the requested goal. Check clipping, readability, overlap, scale, color and blank output. Animation entrance may intentionally start offscreen. Return submitVisualAssessment only. A refinement is a proposal with registered tools; never direct Scene writes, code or deletion. If acceptable set ok=true and refinement=null.',
          },
          {
            role: 'user',
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
      },
      signal,
    );
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
    return Object.freeze(proposal);
  }
}
export class AgentSnapshotRenderer {
  async render(
    project: Project,
    time: number,
    signal: AbortSignal,
    compositionId = project.activeCompositionId,
    scale?: number,
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
      renderer.render(
        createRenderSnapshot(c, time, [], undefined, project),
        canvas,
        1,
        false,
        s,
      );
      if (!canvas.getContext('2d')) throw Error('画布渲染不可用');
      signal.throwIfAborted();
      const image = canvas.toDataURL('image/png');
      if (image.length > 2000000) throw Error('预览超过视觉请求大小限制');
      return {
        image,
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
