import { createRenderSnapshot } from '../core/renderer-core';
import { getWorldBounds } from '../core/layer-bounds';
import { evaluateProperty } from '../core/animation-engine';
import { compileGraph } from '../core/compositing-compiler';
import {
  activeComposition,
  layerProperties,
  type Project,
} from '../core/project-model';
import type { Command } from '../core/command-system';
import { AgentExecutionError } from './execution-error';
import type { AgentToolRegistry } from './tool-registry';
export interface ExecutionEvidence {
  commands: readonly Command[];
  bindings: Record<string, Record<string, string>>;
}
export interface ExecutionVerification {
  command: { status: 'PASSED'; count: number };
  scene: { status: 'PASSED'; graphCount: number; animationSamples: number };
  render: { status: 'PASSED' | 'NOT_VERIFIED'; frames: number };
  visual: { status: 'PASSED' | 'NOT_VERIFIED'; reason: string };
  skillRules: readonly string[];
}
export function verifyExecutionState(
  registry: AgentToolRegistry,
  base: Project,
  draft: Project,
  evidence: ExecutionEvidence,
  skillRules: readonly string[] = [],
): ExecutionVerification {
  registry.verifyResults(evidence.commands, draft, base);
  let graphCount = 0,
    animationSamples = 0;
  for (const layer of activeComposition(draft).layers) {
    if (layer.editor?.graph) {
      graphCount++;
      const result = compileGraph(layer.editor.graph);
      if (!result.valid)
        throw new AgentExecutionError({
          code: 'RESULT_VERIFICATION_FAILED',
          phase: 'verify',
          recoverable: false,
          message: '合成图结果无效：' + layer.name,
          cause: { diagnostics: result.diagnostics },
        });
    }
    for (const { property } of layerProperties(layer))
      for (const k of property.keyframes) {
        for (const t of [
          k.time,
          ...property.keyframes
            .filter((n) => n.time > k.time)
            .slice(0, 1)
            .map((n) => (k.time + n.time) / 2),
        ]) {
          const value = evaluateProperty(property, t);
          animationSamples++;
          const finite = (v: unknown): boolean =>
            typeof v === 'number'
              ? Number.isFinite(v)
              : Array.isArray(v)
                ? v.every(finite)
                : v && typeof v === 'object'
                  ? Object.values(v).every(finite)
                  : false;
          if (!finite(value))
            throw new AgentExecutionError({
              code: 'RESULT_VERIFICATION_FAILED',
              phase: 'verify',
              field: property.id,
              recoverable: false,
              message: '动画结果不是有效有限数值',
            });
        }
      }
  }
  return {
    command: { status: 'PASSED', count: evidence.commands.length },
    scene: { status: 'PASSED', graphCount, animationSamples },
    render: { status: 'NOT_VERIFIED', frames: 0 },
    visual: { status: 'NOT_VERIFIED', reason: '未执行独立视觉比较' },
    skillRules,
  };
}
export function verifyPixelEvidence(
  evidence: { width: number; height: number; foregroundPixels: number },
  expectsForeground: boolean,
) {
  if (
    evidence.width <= 0 ||
    evidence.height <= 0 ||
    (expectsForeground && evidence.foregroundPixels === 0)
  )
    throw new AgentExecutionError({
      code: 'RESULT_VERIFICATION_FAILED',
      phase: 'render',
      recoverable: false,
      message: 'Scene 已更新但实际渲染为空，未提交修改',
    });
}

/** A conservative blank-frame assertion, never treats intentional fades or complex
 * compositing as missing content. Other scenes still receive actual pixel/render evidence. */
export function expectsVisibleForeground(project: Project, time: number) {
  const c = activeComposition(project);
  const snapshot = createRenderSnapshot(c, time, [], undefined, project);
  const visible = snapshot.layers.filter(
    (l) => l.active !== false && l.source.visible && l.opacity > 0,
  );
  if (visible.length !== 1) return false;
  const item = visible[0]!,
    l = item.source;
  if (
    l.editor?.is3D ||
    l.editor?.parentId ||
    l.editor?.graph?.nodes.some(
      (n) => !['source', 'output'].includes(n.type),
    ) ||
    l.editor?.masks.length ||
    l.editor?.effects?.length ||
    (l.editor?.gradient && l.editor.gradient !== 'none') ||
    !('fill' in l) ||
    item.scale.x === 0 ||
    item.scale.y === 0
  )
    return false;
  if (l.type === 'text' && !l.text.trim()) return false;
  const fill = l.editor?.properties.fill
    ? evaluateProperty(l.editor.properties.fill, time)
    : [l.fill.r, l.fill.g, l.fill.b, l.fill.a];
  if (!Array.isArray(fill) || (fill[3] ?? 0) <= 0) return false;
  const bg = c.backgroundColor ?? {
    r: 17 / 255,
    g: 24 / 255,
    b: 39 / 255,
    a: 1,
  };
  if (
    Math.max(
      Math.abs(fill[0]! - bg.r),
      Math.abs(fill[1]! - bg.g),
      Math.abs(fill[2]! - bg.b),
    ) < 0.05
  )
    return false;
  const b = getWorldBounds(item, time);
  return (
    b.maxX - b.minX > 4 &&
    b.maxY - b.minY > 4 &&
    b.minX >= 0 &&
    b.minY >= 0 &&
    b.maxX < c.width &&
    b.maxY < c.height
  );
}
